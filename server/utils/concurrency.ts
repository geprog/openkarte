/**
 * Open data portals ban source IPs that burst. A cold cache for the lakes layer
 * fans out to one `package_show` per dataset (49) plus a resource download per
 * match, and `collection` datasets fan out again per relationship — well over a
 * hundred parallel requests if left unbounded.
 *
 * Two limits apply, because they guard against different things:
 *
 * - `MAX_CONCURRENT_REQUESTS` bounds how many requests are open at once, which
 *   is what keeps slow downloads from piling up into a connection burst.
 * - `MIN_REQUEST_INTERVAL_MS` bounds the request *rate*. The concurrency cap
 *   alone does not: the portal answers `package_show` in roughly 25 ms, so four
 *   in flight still issues well over a hundred requests per second. The ban that
 *   prompted this was triggered by ~15 requests within a few minutes.
 *
 * Both are process-wide rather than per call site, so that nested fan-outs
 * cannot multiply back into a burst.
 */
const MAX_CONCURRENT_REQUESTS = 4;
const MIN_REQUEST_INTERVAL_MS = 200;

let active = 0;
const waiting: (() => void)[] = [];

/** The earliest moment the next request may start. */
let nextRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Claims the next free moment in the request schedule and waits for it.
 *
 * The read-modify-write of `nextRequestAt` runs synchronously before the first
 * await, so concurrent callers each claim a distinct moment instead of all
 * reading the same timestamp and firing together.
 */
async function pace(): Promise<void> {
  const now = Date.now();
  const startAt = Math.max(now, nextRequestAt);
  nextRequestAt = startAt + MIN_REQUEST_INTERVAL_MS;

  const wait = startAt - now;
  if (wait > 0) {
    await sleep(wait);
  }
}

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT_REQUESTS) {
    active++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    waiting.push(resolve);
  });
}

function release(): void {
  const next = waiting.shift();
  if (next) {
    // Hand the slot straight over, so `active` stays accurate.
    next();
  }
  else {
    active--;
  }
}

/**
 * Waits for the next scheduled moment and a free request slot, then runs `task`.
 *
 * `task` must be a leaf operation — a single fetch plus reading its body — and
 * must never await another `withRequestSlot` call: holding a slot while queuing
 * for one deadlocks. Keep expensive post-processing (parsing, geometry
 * decoding) outside, so a slot is held only for the network round trip.
 */
export async function withRequestSlot<T>(task: () => Promise<T>): Promise<T> {
  // Paced before acquiring, so a slot is never held by a task that is only
  // waiting its turn.
  await pace();
  await acquire();
  try {
    return await task();
  }
  finally {
    release();
  }
}

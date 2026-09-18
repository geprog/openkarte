/**
 * Open data portals ban source IPs that burst. A cold cache for the lakes layer
 * fans out to one `package_show` per dataset (49) plus a resource download per
 * match, and `collection` datasets fan out again per relationship — well over a
 * hundred parallel requests if left unbounded.
 *
 * This is a single process-wide gate rather than a limit per call site, so that
 * nested fan-outs cannot multiply into a burst again.
 */
const MAX_CONCURRENT_REQUESTS = 4;

let active = 0;
const waiting: (() => void)[] = [];

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
 * Runs `task` once a request slot is free.
 *
 * `task` must be a leaf operation — a single fetch plus reading its body — and
 * must never await another `withRequestSlot` call: holding a slot while queuing
 * for one deadlocks. Keep expensive post-processing (parsing, geometry
 * decoding) outside, so a slot is held only for the network round trip.
 */
export async function withRequestSlot<T>(task: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    return await task();
  }
  finally {
    release();
  }
}

import { createError } from 'h3';
import { withRequestSlot } from '~/server/utils/concurrency';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

type CsvAttempt =
  | { ok: true, data: Uint8Array }
  | { ok: false, status: number, statusText: string };

export async function fetchCsvFromUrl(url: string, retries = 3, delay = 1000): Promise<Uint8Array> {
  if (!url) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing URL parameter',
    });
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    const result = await withRequestSlot<CsvAttempt>(async () => {
      const response = await fetch(url);

      if (!response.ok) {
        return { ok: false, status: response.status, statusText: response.statusText };
      }

      const lowerUrl = url.toLowerCase();
      if (lowerUrl.endsWith('.csv') || response.headers.get('content-type')?.includes('text/csv')) {
        const buffer = await response.arrayBuffer();
        return { ok: true, data: new Uint8Array(buffer) };
      }

      throw createError({
        statusCode: 415,
        statusMessage: 'Unsupported file format.',
      });
    });

    if (result.ok) {
      return result.data;
    }

    // Backoff waits outside the request slot, so a retry that is sleeping does
    // not keep a slot another download could be using.
    if (result.status === 429 && attempt < retries) {
      await sleep(delay);
      delay *= 2; // Exponential backoff
    }
    else {
      throw createError({
        statusCode: result.status,
        statusMessage: `Failed to fetch resource: ${result.statusText}`,
      });
    }
  }

  // Should not reach here
  throw createError({
    statusCode: 500,
    statusMessage: 'Exceeded retry limit.',
  });
}

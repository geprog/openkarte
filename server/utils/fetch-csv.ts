import { createError } from 'h3';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchCsvFromUrl(url: string, retries = 3, delay = 1000): Promise<Uint8Array> {
  if (!url) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing URL parameter',
    });
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url);

    if (response.ok) {
      const lowerUrl = url.toLowerCase();
      if (lowerUrl.endsWith('.csv') || response.headers.get('content-type')?.includes('text/csv')) {
        const buffer = await response.arrayBuffer();
        return new Uint8Array(buffer);
      }

      throw createError({
        statusCode: 415,
        statusMessage: 'Unsupported file format.',
      });
    }

    if (response.status === 429 && attempt < retries) {
      await sleep(delay);
      delay *= 2; // Exponential backoff
    }
    else {
      throw createError({
        statusCode: response.status,
        statusMessage: `Failed to fetch resource: ${response.statusText}`,
      });
    }
  }

  // Should not reach here
  throw createError({
    statusCode: 500,
    statusMessage: 'Exceeded retry limit.',
  });
}

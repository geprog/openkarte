import { createError } from 'h3';
import { withRequestSlot } from '~/server/utils/concurrency';

export async function fetchJsonFromUrl(url: string): Promise<Uint8Array> {
  if (!url) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing URL parameter',
    });
  }

  return withRequestSlot(async () => {
    const response = await fetch(url);
    if (!response.ok) {
      throw createError({
        statusCode: response.status,
        statusMessage: `Failed to fetch resource: ${response.statusText}`,
      });
    }

    const lowerUrl = url.toLowerCase();
    if (lowerUrl.endsWith('json')) {
      return await response.json();
    }

    throw createError({
      statusCode: 415,
      statusMessage: 'Unsupported file format.',
    });
  });
}

import { createError } from 'h3';

export async function fetchCsvFromUrl(url: string): Promise<Uint8Array> {
  if (!url) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing URL parameter',
    });
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      statusMessage: `Failed to fetch resource: ${response.statusText}`,
    });
  }

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

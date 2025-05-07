export default defineEventHandler(async (event) => {
  const url = getQuery(event).url as string;

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

  if (lowerUrl.endsWith('json')) {
    const data = await response.json();
    return data;
  }
  else if (lowerUrl.endsWith('.csv') || response.headers.get('content-type')?.includes('text/csv')) {
    const buffer = await response.arrayBuffer();
    setHeader(event, 'Content-Type', 'text/plain; charset=iso-8859-1');
    return new Uint8Array(buffer);
  }
  else {
    throw createError({
      statusCode: 415,
      statusMessage: 'Unsupported file format. Only CSV and GeoJSON are supported.',
    });
  }
});

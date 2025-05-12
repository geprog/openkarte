import { createError, getQuery } from 'h3';
import shp from 'shpjs';

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
    return await response.json();
  }

  if (lowerUrl.endsWith('.csv') || response.headers.get('content-type')?.includes('text/csv')) {
    const buffer = await response.arrayBuffer();

    return new Uint8Array(buffer);
  }

  if (lowerUrl.endsWith('.zip')) {
    const zipBuffer = await response.arrayBuffer();
    try {
      const geojson = await shp(zipBuffer);
      return geojson;
    }
    catch (err) {
      throw createError({
        statusCode: 422,
        statusMessage: `Failed to convert shapefile to GeoJSON.${err}`,
      });
    }
  }

  throw createError({
    statusCode: 415,
    statusMessage: 'Unsupported file format. Only JSON, CSV, and ZIP (SHP) are supported.',
  });
});

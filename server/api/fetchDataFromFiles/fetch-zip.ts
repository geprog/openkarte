import { createError, getQuery } from 'h3';
import shp from 'shpjs';

export async function fetchZipFromUrl(url: string): Promise<Uint8Array> {
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
  if (lowerUrl.endsWith('.zip')) {
    const zipBuffer = await response.arrayBuffer();
    try {
      const geojson = await shp(zipBuffer);
      const jsonString = JSON.stringify(geojson);
      const uint8Array = new TextEncoder().encode(jsonString);
      return uint8Array;
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
    statusMessage: 'Unsupported file format.',
  });
}

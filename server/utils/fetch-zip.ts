import { createError } from 'h3';
import shp from 'shpjs';
import { withRequestSlot } from '~/server/utils/concurrency';

export async function fetchZipFromUrl(url: string): Promise<Uint8Array> {
  if (!url) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing URL parameter',
    });
  }

  const zipBuffer = await withRequestSlot(async () => {
    const response = await fetch(url);
    if (!response.ok) {
      throw createError({
        statusCode: response.status,
        statusMessage: `Failed to fetch resource: ${response.statusText}`,
      });
    }

    const lowerUrl = url.toLowerCase();
    if (!lowerUrl.endsWith('.zip')) {
      throw createError({
        statusCode: 415,
        statusMessage: 'Unsupported file format.',
      });
    }

    return await response.arrayBuffer();
  });

  // Decoded outside the request slot: this conversion is CPU work and would
  // otherwise block another download from starting.
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

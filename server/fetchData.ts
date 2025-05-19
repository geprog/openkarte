import type { Dataset, InputJSON, StructuredDataset } from '~/server/prepareInput';
import proj4 from 'proj4';
import { fetchCsvFromUrl } from '~/server/api/fetchDataFromFiles/fetch-csv';
import { fetchJsonFromUrl } from '~/server/api/fetchDataFromFiles/fetch-json';
import { fetchZipFromUrl } from '~/server/api/fetchDataFromFiles/fetch-zip';

proj4.defs('EPSG:25832', '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs');
const fromProjection = 'EPSG:25832';
const toProjection = 'WGS84';

const ALLOWED_HOSTS = [
  'opendata.schleswig-holstein.de',
  'efi2.schleswig-holstein.de',
  'geoservice.norderstedt.de',
  'hsi-sh.de',
];

export async function fetchData(datasets: InputJSON) {
  try {
    const data = await Promise.all(
      datasets.datasets.map(async (dataset: any) => {
        if (!ALLOWED_HOSTS.includes(dataset.host)) {
          throw createError({
            statusCode: 403,
            statusMessage: 'Access to this URL is not allowed',
          });
        }

        const url = `https://${dataset.host}/api/action/package_show?id=${dataset.id}`;
        const response = await fetch(url);
        const res = await response.json();

        if (res.success) {
          const resource = res.result.resources.find(
            (r: any) => r.id === dataset.resource_id,
          );

          if (resource) {
            if (resource.url) {
              resource.url = resource.url.replace(/^http:/, 'https:');
            }
            if (resource.format === 'CSV') {
              return { id: dataset.id, data: await fetchAndParseCsv(resource.url, dataset?.headers) };
            }
            else if (['JSON', 'SHP'].includes(resource.format)) {
              return { id: dataset.id, data: await fetchAndParseJson(resource.url) };
            }
          }
        }
      }),
    );
    return data;
  }
  catch (error) {
    console.error(`Error fetching`, error);
    throw error;
  }
}

export async function fetchBathingMappings(data: any[], datasets: InputJSON) {
  try {
    // Find the base dataset once (you assume it's the "source" in every mapping)
    const baseDatasetId = datasets.mappings[0].source_db_id;
    const baseDataset = data.find((d: any) => d.id === baseDatasetId);
    if (!baseDataset)
      throw new Error('Base dataset not found');

    const merged = baseDataset.data.map((baseRow: any) => {
      const mergedRow = { ...baseRow };

      // Loop over each mapping and try to find matching rows from other datasets
      datasets.mappings.forEach((m: any) => {
        const targetDataset = data.find((d: any) => d.id === m.target_db_id);
        if (!targetDataset)
          return;

        // Find matching row(s) in the target dataset
        const match = targetDataset.data.find((row: any) =>
          row[m.target_db_field] === baseRow[m.source_db_field],
        );

        if (match) {
          // Optionally prefix fields from target to avoid collision
          Object.entries(match).forEach(([key, value]) => {
            mergedRow[`${m.target_db_id}_${key}`] = value;
          });
        }
      });

      return mergedRow;
    });
    console.warn(merged);
    return merged;
  }
  catch (error) {
    console.error('Error fetching Mappings', error);
    throw error;
  }
}

export async function fetchLakesMappings(data: any, datasets: InputJSON) {
  try {
    const mappingData = await Promise.all(
      datasets.mappings.map((m: any) => {
        const source = data.find((d: any) => d.id === m.source_db_id);
        const target = data.find((d: any) => d.id === m.target_db_id);
        if (m.condition === '=') {
          // content
        }
      }),
    );
  }
  catch (error) {
    console.error('Error fetching Mappings', error);
    throw error;
  }
}

async function fetchAndParseCsv<D>(csvUrl: string, headers?: string[]): Promise<D[]> {
  const response = await fetchCsvFromUrl(csvUrl);
  const decoder = new TextDecoder('iso-8859-1');
  const csvText = decoder.decode(response);

  const rows = csvText.trim().split('\n');
  if (headers) {
    return rows.map<D>((line) => {
      const values = line.split('|').map(v => v.replace(/^"|"$/g, '').trim());
      const entry: Record<string, any> = {};
      headers.forEach((key, i) => {
        entry[key] = values[i] ?? '';
      });
      return entry as D;
    });
  }
  else {
    const headerLine = rows.shift();
    if (!headerLine)
      return [];

    const detectedHeaders = headerLine.split(';').map(v => v.replace(/^"|"$/g, '').trim());

    return rows.map<D>((line) => {
      const values = line.split(';').map(v => v.replace(/^"|"$/g, '').trim());
      const entry: Record<string, any> = {};
      detectedHeaders.forEach((key, i) => {
        entry[key] = values[i] ?? '';
      });
      return entry as D;
    });
  }
}

async function fetchAndParseJson<G extends GeoJSON.Geometry, P>(geoJsonUrl: string): Promise<GeoJSON.FeatureCollection<G, P>> {
  if (geoJsonUrl.toLowerCase().endsWith('.zip')) {
    const response = await fetchZipFromUrl(geoJsonUrl);
    const data = JSON.parse(new TextDecoder().decode(response));
    return data as GeoJSON.FeatureCollection<G, P>;
  }
  const response = await fetchJsonFromUrl(geoJsonUrl);
  const data = JSON.parse(new TextDecoder().decode(response));
  const reprojectedCoordinatesData = reprojectGeoJSON<G, P>(data);
  return reprojectedCoordinatesData;
}

function reprojectGeoJSON<G extends GeoJSON.Geometry, P>(geojson: GeoJSON.FeatureCollection<G, P>): GeoJSON.FeatureCollection<G, P> {
  return {
    ...geojson,
    features: geojson.features.map((feature) => {
      if (feature.geometry.type !== 'Point') {
        return feature;
      }
      const [x, y] = feature.geometry.coordinates;
      const [lon, lat] = proj4(fromProjection, toProjection, [x, y]);

      let newBbox = feature.bbox;
      if (feature.bbox && feature.bbox.length === 4) {
        const [minX, minY, maxX, maxY] = feature.bbox;
        const [minLon, minLat] = proj4(fromProjection, toProjection, [minX, minY]);
        const [maxLon, maxLat] = proj4(fromProjection, toProjection, [maxX, maxY]);
        newBbox = [minLon, minLat, maxLon, maxLat];
      }

      return {
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates: [lon, lat],
        },
        bbox: newBbox,
      };
    }),
  };
}

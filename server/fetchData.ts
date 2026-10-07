import type { Package, Relationship, Resource, Response } from './types/ckan';
import type { Dataset, InputJSON } from '~/server/prepareInput';
import proj4 from 'proj4';
import { withRequestSlot } from '~/server/utils/concurrency';
import { fetchCsvFromUrl } from '~/server/utils/fetch-csv';
import { fetchJsonFromUrl } from '~/server/utils/fetch-json';
import { fetchZipFromUrl } from '~/server/utils/fetch-zip';

proj4.defs('EPSG:25832', '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs');
const fromProjection = 'EPSG:25832';
const toProjection = 'WGS84';

const ALLOWED_HOSTS = [
  'opendata.schleswig-holstein.de',
  'efi2.schleswig-holstein.de',
  'geoservice.norderstedt.de',
  'hsi-sh.de',
];

export interface FetchedData { id: string, date?: string, data: Record<string, string>[] | GeoJSON.FeatureCollection }

export type FetchedDataArray = (GeoJSON.FeatureCollection & { date?: string })[];

function normalizeFormat(format: string | undefined): string {
  return (format ?? '').split('/').at(-1)?.toUpperCase() ?? '';
}

function isFormat(resource: Resource, format: string): boolean {
  return normalizeFormat(resource.format) === format
    || (format === 'CSV' && resource.mimetype === 'text/csv');
}

/**
 * Formats the loaders below understand, in the order a fallback should try them.
 *
 * Geometry first: a dataset that carries features usually also offers a flat CSV
 * export of them (the tree register offers SHP, GeoJSON, GML and CSV), and that
 * export drops the coordinates, which makes it useless as a layer's base. The
 * reverse costs nothing — a value-only dataset has no geometry to prefer, and
 * `fetchMappings` reads values out of GeoJSON properties just as happily as out
 * of CSV columns. Plain `JSON` comes last because it is only loadable when it
 * happens to contain GeoJSON, which for e.g. the gauge readings it does not.
 */
const SUPPORTED_FORMATS = ['GEOJSON', 'SHP', 'CSV', 'JSON'];

/**
 * Picks the resource to download for `dataset`.
 *
 * The configured `resource_id` wins, but a portal mints a fresh id every time it
 * republishes a resource, so an id in the input layer goes stale on its own —
 * every gauge behind the lakes layer rotated its id, which left the lakes drawn
 * but without water levels. Falling back to the first resource in a format we
 * can load keeps a rotated id a warning instead of a silently empty layer.
 */
function selectResource(resources: Resource[], dataset: Dataset): Resource | undefined {
  const configured = resources.find(r => r.id === dataset.resource_id);
  if (configured) {
    return configured;
  }

  for (const format of SUPPORTED_FORMATS) {
    const resource = resources.find(r => isFormat(r, format));
    if (resource) {
      console.warn(
        `Resource ${dataset.resource_id} no longer exists in dataset ${dataset.id}; `
        + `falling back to its ${format} resource ${resource.id}`,
      );
      return resource;
    }
  }

  return undefined;
}

export async function fetchSeriesData(s: Relationship, dataset: Dataset): Promise<FetchedData | undefined> {
  try {
    const url = `https://${dataset.host}/api/action/package_show?id=${s.__extras.subject_package_id}`;
    const res: Response<Package> = await withRequestSlot(async () => {
      const response = await fetch(url);
      return response.json();
    });
    if (res.success) {
      const resource = res.result.resources.find(res => isFormat(res, 'CSV'))?.url;
      if (resource) {
        const publishedDate = res.result.extras.find(m => m.key === 'issued')?.value || '';
        return { id: dataset.id, date: publishedDate, data: await fetchAndParseCsv(resource, dataset?.headers) };
      }
    }
  }
  catch (error) {
    console.error(`Error fetching`, error);
    throw error;
  }
}

export async function fetchData(datasets: InputJSON): Promise<FetchedData[]> {
  try {
    const data = await Promise.all(
      datasets.datasets.map<Promise<FetchedData[] | null>>(async (dataset) => {
        if (!ALLOWED_HOSTS.includes(dataset.host)) {
          throw createError({
            statusCode: 403,
            statusMessage: 'Access to this URL is not allowed',
          });
        }
        const url = `https://${dataset.host}/api/action/package_show?id=${dataset.id}`;
        try {
          const res: Response<Package> = await withRequestSlot(async () => {
            const response = await fetch(url);
            return response.json();
          });

          if (!res.success) {
            // Datasets get withdrawn and renamed too, and that also ends in a
            // layer that is short a few values for no visible reason.
            console.warn(`Dataset ${dataset.id} is not available on ${dataset.host}: ${res.error.message}`);
            return null;
          }

          if (res.result.type === 'collection') {
            const series = await Promise.all(
              res.result.relationships_as_object.map(s => fetchSeriesData(s, dataset)),
            );
            return series.filter(data => data !== undefined);
          }

          const resource = selectResource(res.result.resources, dataset);
          if (resource) {
            const resourceUrl = resource.url?.replace(/^http:/, 'https:');
            if (isFormat(resource, 'CSV')) {
              const data: FetchedData = { id: dataset.id, data: await fetchAndParseCsv(resourceUrl, dataset?.headers) };
              return [data];
            }
            else if (['JSON', 'GEOJSON', 'SHP'].some(format => isFormat(resource, format))) {
              const data: FetchedData = { id: dataset.id, data: await fetchAndParseJson(resourceUrl) };
              return [data];
            }
          }
          return null;
        }
        catch (err) {
          console.error('failed url', err, url);
          return null;
        }
      }),
    );
    return data.filter(data => data !== null).flat();
  }
  catch (error) {
    console.error(`Error fetching`, error);
    throw error;
  }
}

function isGeoJSON(data: Record<string, string> | GeoJSON.Feature): data is GeoJSON.Feature {
  return (data as GeoJSON.Feature).type === 'Feature';
}

export async function fetchMappings(data: FetchedData[], datasets: InputJSON): Promise<FetchedDataArray> {
  try {
    const baseDatasetId = datasets.mappings[0].source_db_id;
    let mappingDatasets: FetchedData[] = [];

    if (datasets.options.type === 'series') {
      // case: series → multiple snapshots
      mappingDatasets = data.filter(d => d.id === baseDatasetId);
    }
    else {
      const baseDataset = (data as FetchedData[]).find(d => d.id === baseDatasetId);
      if (!baseDataset)
        throw new Error('Base dataset not found');
      mappingDatasets = [baseDataset];
    }
    const results = mappingDatasets.map((source) => {
      const baseRows = Array.isArray(source.data) ? source.data : source.data.features;

      const merged = baseRows.map((baseRow) => {
        const mergedRow = { ...baseRow };

        datasets.mappings.forEach((m) => {
          const targetDataset = data.find(d => d.id === m.target_db_id);
          if (!targetDataset)
            return;
          const targetRows = Array.isArray(targetDataset.data) ? targetDataset.data : targetDataset.data.features;

          if (datasets.options.value_group) {
            if (datasets.options.type === 'geo') {
              if (!isGeoJSON(mergedRow)) {
                throw new Error('Expected GeoJSON Feature');
              }
              if (!mergedRow.properties) {
                mergedRow.properties = {};
              }
              if (!mergedRow.properties.match) {
                mergedRow.properties.match = [];
              }
              if (!mergedRow?.properties.average) {
                mergedRow.properties.average = 0;
              }
              const baseValue = getValue(baseRow.properties, m.source_db_field)?.toString().toLowerCase();
              if (baseValue && baseValue.includes(m.target_db_field.toLowerCase())) {
                const values = targetRows.map((d) => {
                  return isGeoJSON(d) ? (d.properties || {})[datasets.options.value_group] : d[datasets.options.value_group];
                });
                mergedRow.properties.match.push(targetDataset.data);
                mergedRow.properties.average = calculateMean(values);
              }
            }
          }
          else {
            const match = targetRows.find((row) => {
              let sourceValue = 0;
              if (isGeoJSON(baseRow)) {
                sourceValue = getValue(baseRow.properties, m.source_db_field);
              }
              else {
                sourceValue = getValue(baseRow, m.source_db_field);
              }
              const targetValue = getValue(row, m.target_db_field);
              return sourceValue === targetValue;
            });
            if (match && mergedRow) {
              Object.entries(match).forEach(([key, value]) => {
                if (isGeoJSON(mergedRow)) {
                  mergedRow.properties = mergedRow.properties || {};
                  mergedRow.properties[key] = value;
                }
                else {
                  mergedRow[key] = value;
                }
              });
            }
          }
        });

        return mergedRow;
      });

      // Always return as FeatureCollection
      const features = merged.map<GeoJSON.Feature>((row) => {
        const feature = isGeoJSON(row) ? row : csvToGeoJSONFromRow(row, datasets.options.coordinate_field_x, datasets.options.coordinate_field_y);
        if (!feature) {
          throw new Error('Invalid row, missing or invalid coordinates');
        }
        return { ...feature, properties: { ...feature.properties, options: datasets.options } };
      });
      const featureCollection: GeoJSON.FeatureCollection & { date?: string } = {
        type: 'FeatureCollection',
        features,
        ...(source.date && {
          date: new Date(source.date).toISOString().split('T')[0],
        }),
      };

      return featureCollection;
    });
    // Step 3: Normalize response wrapper
    return results.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }
  catch (error) {
    console.error('Error fetching Mappings', error);
    throw error;
  }
}

function getValue(obj: any, field: string) {
  return field.split('.').reduce((acc, key) => acc?.[key], obj);
}

function calculateMean(values: number[]): number {
  const numbers = values.map(v => typeof v === 'string' ? Number.parseFloat(v) : v).filter(v => typeof v === 'number' && !Number.isNaN(v));
  if (numbers.length === 0) {
    return 0;
  }
  const sum = numbers.reduce((acc, val) => acc + val, 0);
  return sum / numbers.length;
}

async function fetchAndParseCsv(csvUrl: string, headers?: string[]): Promise<Record<string, string>[]> {
  try {
    const response = await fetchCsvFromUrl(csvUrl);
    const decoder = new TextDecoder('utf-8');
    let csvText = decoder.decode(response);
    if (csvText.includes('Ã') || csvText.includes('�')) {
      csvText = new TextDecoder('iso-8859-1').decode(response);
    }

    // Remove BOM if present
    if (csvText.charCodeAt(0) === 0xFEFF)
      csvText = csvText.slice(1);

    const rows = csvText.trim().split('\n');
    if (headers) {
      return rows.map((line) => {
        const values = line.split('|').map(v => v.replace(/^"|"$/g, '').trim());
        const entry: Record<string, string> = {};
        headers.forEach((key, i) => {
          entry[key] = values[i] ?? '';
        });
        return entry;
      });
    }
    else {
      const headerLine = rows.shift();
      if (!headerLine)
        return [];

      const detectedHeaders = headerLine.split(';').map(v => v.replace(/^"|"$/g, '').trim());

      return rows.map((line) => {
        const values = line.split(';').map(v => v.replace(/^"|"$/g, '').trim());
        const entry: Record<string, string> = {};
        detectedHeaders.forEach((key, i) => {
          entry[key] = values[i] ?? '';
        });
        return entry;
      });
    }
  }
  catch (error) {
    console.error('Error fetching CSV Files', error);
    throw error;
  }
}

async function fetchAndParseJson<G extends GeoJSON.Geometry, P>(geoJsonUrl: string): Promise<GeoJSON.FeatureCollection<G, P>> {
  if (geoJsonUrl.toLowerCase().endsWith('.zip')) {
    const response = await fetchZipFromUrl(geoJsonUrl);
    const data = JSON.parse(new TextDecoder().decode(response));
    return data as GeoJSON.FeatureCollection<G, P>;
  }
  const response = await fetchJsonFromUrl(geoJsonUrl);
  // ✅ normalize to JS object
  let data: any;
  if (response instanceof ArrayBuffer || ArrayBuffer.isView(response)) {
    data = JSON.parse(new TextDecoder().decode(response as ArrayBufferView));
  }
  else {
    data = response; // already JSON object
  }

  let geojson: any;

  if (data.type === 'FeatureCollection' || data.type === 'Feature') {
    geojson = data;
  }
  else if (data.features || data.geojson || data.data || data.result) {
    geojson = data.features
      ? data
      : data.geojson || data.data || data.result;
  }
  else {
    throw new Error('Could not find valid GeoJSON in response');
  }

  return reprojectGeoJSON<G, P>(geojson);
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

function csvToGeoJSONFromRow(row: Record<string, string>, latKey = 'lat', lonKey = 'lon'): GeoJSON.Feature | null {
  const latitude = Number.parseFloat(row[latKey]);
  const longitude = Number.parseFloat(row[lonKey]);

  if (Number.isNaN(latitude) || Number.isNaN(longitude))
    return null;

  const properties = { ...row };
  delete properties[latKey];
  delete properties[lonKey];

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [longitude, latitude],
    },
    properties,
  };
}

export async function fetchSeriesUrlData(host: string, dataset: Relationship) {
  const url = `https://${host}/api/action/package_show?id=${dataset.__extras.subject_package_id}`;
  try {
    const res: Response<Package> = await withRequestSlot(async () => {
      const response = await fetch(url);
      return response.json();
    });
    if (!res.success) {
      return null;
    }
    return {
      name: res.result.title,
      organization: res.result.organization,
      url: `https://${host}/dataset/${encodeURIComponent(res.result.name)}`,
      license_title: res.result.license_title,
      license_url: res.result.license_url,
    };
  }
  catch (err) {
    console.error('failed url', err, url);
    return null;
  }
}

export async function fetchUrlData(dataset: Dataset) {
  const url = `https://${dataset.host}/api/action/package_show?id=${dataset.id}`;
  try {
    const res: Response<Package> = await withRequestSlot(async () => {
      const response = await fetch(url);
      return response.json();
    });
    if (!res.success) {
      return null;
    }
    if (res.result.type === 'collection') {
      const series = await Promise.all(
        res.result.relationships_as_object.map((s: Relationship) => fetchSeriesUrlData(dataset.host, s)),
      );
      return {
        name: dataset.title,
        nested_series: series,
        organization: res.result.organization,
        url: `https://${dataset.host}/dataset/${encodeURIComponent(dataset.id)}`,
        license_title: res.result.license_title,
        license_url: res.result.license_url,
      };
    }
    return {
      name: dataset.title,
      organization: res.result.organization,
      url: `https://${dataset.host}/dataset/${encodeURIComponent(dataset.id)}`,
      license_title: res.result.license_title,
      license_url: res.result.license_url,
    };
  }
  catch (err) {
    console.error('failed url', err, url);
    return null;
  }
}

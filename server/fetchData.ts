import type { Package, Relationship, Response } from './types/ckan';
import type { Dataset, InputJSON } from '~/server/prepareInput';
import proj4 from 'proj4';
import defs from 'proj4js-definitions';
import { fetchCsvFromUrl } from '~/server/utils/fetch-csv';

import { fetchJsonFromUrl } from '~/server/utils/fetch-json';
import { fetchZipFromUrl } from '~/server/utils/fetch-zip';

proj4.defs(defs);
const toProjection = 'WGS84';

const ALLOWED_HOSTS = [
  'opendata.schleswig-holstein.de',
  'efi2.schleswig-holstein.de',
  'geoservice.norderstedt.de',
  'hsi-sh.de',
];

export interface FetchedData { id: string, childId?: string, date?: string, data: Record<string, string>[] | GeoJSON.FeatureCollection }

export type FetchedDataArray = (GeoJSON.FeatureCollection & { date?: string })[];

export async function fetchSeriesData(s: Relationship, dataset: Dataset): Promise<FetchedData | undefined> {
  try {
    const url = `https://${dataset.host}/api/action/package_show?id=${s.__extras.subject_package_id}`;
    const response = await fetch(url);
    const res: Response<Package> = await response.json();
    if (res.success) {
      const resource = res.result.resources.find(
        res => res.format === 'CSV' || res.mimetype === 'text/csv',
      )?.url;
      if (resource) {
        const publishedDate = res.result.extras.find(m => m.key === 'issued')?.value || '';
        return { id: dataset.id, childId: s.__extras.subject_package_id, date: publishedDate, data: await fetchAndParseCsv(resource, dataset?.headers) };
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
          const response = await fetch(url);
          const res: Response<Package> = await response.json();

          if (!res.success) {
            return null;
          }

          if (res.result.type === 'collection') {
            const series = await Promise.all(
              res.result.relationships_as_object.map(s => fetchSeriesData(s, dataset)),
            );
            return series.filter(data => data !== undefined);
          }

          const resource = res.result.resources.find(
            r => r.id === dataset.resource_id,
          );
          if (resource) {
            if (resource.url) {
              resource.url = resource.url.replace(/^http:/, 'https:');
            }
            if (resource.format === 'CSV') {
              const data: FetchedData = { id: dataset.id, data: await fetchAndParseCsv(resource.url, dataset?.headers) };
              return [data];
            }
            else if (['JSON', 'GeoJSON', 'SHP'].includes(resource.format)) {
              const data: FetchedData = { id: dataset.id, data: await fetchAndParseJson(resource.url) };
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
    let mappingDatasets: FetchedData[] = [];

    if (datasets.mappings.length === 0) {
      mappingDatasets = data;
    }
    else {
      const baseDatasetId = datasets.mappings[0].source_db_id;
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
      const id = source.childId ? [source.id, source.childId].join('/') : source.id;
      const features = merged.map<GeoJSON.Feature | undefined>((row) => {
        const latitudeField = typeof datasets.options.latitude_field === 'string' ? datasets.options.latitude_field : (datasets.options.latitude_field ? datasets.options.latitude_field[id] || datasets.options.latitude_field[source.id] : undefined);
        const longitudeField = typeof datasets.options.longitude_field === 'string' ? datasets.options.longitude_field : (datasets.options.longitude_field ? datasets.options.longitude_field[id] || datasets.options.longitude_field[source.id] : undefined);
        const feature = isGeoJSON(row) ? row : csvToGeoJSONFromRow(row, latitudeField, longitudeField);
        if (!feature) {
          return undefined;
        }
        return { ...feature, properties: { ...feature.properties, options: datasets.options } };
      }).filter(feature => feature !== undefined);
      const featureCollection: GeoJSON.FeatureCollection & { date?: string } = {
        type: 'FeatureCollection',
        features,
        ...(source.date && {
          date: new Date(source.date).toISOString().split('T')[0],
        }),
      };

      if (datasets.options.crs) {
        const crs = typeof datasets.options.crs === 'string' ? datasets.options.crs : (datasets.options.crs[id] || datasets.options.crs[source.id]);
        if (crs) {
          return reprojectGeoJSON(featureCollection, crs) as GeoJSON.FeatureCollection & { date?: string };
        }
      }
      return featureCollection;
    });
    return results
      .filter(fc => fc.features.length > 0)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
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

class InvalidSeparatorError extends Error {}

function normalizeValue(value: string): string {
  return value.replace(/^["']/, '').replace(/["']$/, '').trim();
}
function splitCsvLine(headerLine: string, rows: string[], separator: string): Record<string, string>[] | false {
  const detectedHeaders = headerLine.split(separator).map(normalizeValue);
  if (detectedHeaders.length < 2) {
    return false;
  }

  try {
    return rows.map((line) => {
      const values = line.split(separator).map(normalizeValue);
      if (values.length !== detectedHeaders.length) {
        console.error('Detected separator does not match number of columns in line compared to header', line, detectedHeaders, separator);
      }
      const entry: Record<string, string> = {};
      detectedHeaders.forEach((key, i) => {
        entry[key] = values[i] ?? '';
      });
      return entry;
    });
  }
  catch (error) {
    if (error instanceof InvalidSeparatorError) {
      return false;
    }
    throw error;
  }
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
        const values = line.split('|').map(normalizeValue);
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

      const result = splitCsvLine(headerLine, rows, ',') || splitCsvLine(headerLine, rows, ';') || splitCsvLine(headerLine, rows, '\t') || splitCsvLine(headerLine, rows, '|');
      if (!result) {
        console.warn('Could not parse CSV with common separators , ; \\t |', csvUrl);
        return [];
      }
      return result;
    }
  }
  catch (error) {
    console.error('Error fetching CSV Files', error);
    throw error;
  }
}

async function fetchAndParseJson(geoJsonUrl: string): Promise<GeoJSON.FeatureCollection> {
  if (geoJsonUrl.toLowerCase().endsWith('.zip')) {
    const response = await fetchZipFromUrl(geoJsonUrl);
    const data = JSON.parse(new TextDecoder().decode(response));
    return data as GeoJSON.FeatureCollection;
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

  if (geojson.crs && geojson.crs.properties && geojson.crs.properties.name) {
    return reprojectGeoJSON(geojson as GeoJSON.FeatureCollection, geojson.crs.properties.name);
  }
  return geojson as GeoJSON.FeatureCollection;
}

function reprojectGeoJSON(geojson: GeoJSON.FeatureCollection, fromProjection: string): GeoJSON.FeatureCollection {
  if (!fromProjection) {
    return geojson;
  }
  if (fromProjection.startsWith('urn:')) {
    fromProjection = fromProjection.replace('urn:ogc:def:crs:', '').replace('::', ':');
  }
  if (fromProjection === toProjection) {
    return geojson;
  }
  const reprojectedFeatures = geojson.features
    .map((feature) => {
      if (feature.geometry.type !== 'Point') {
        return feature;
      }

      const [x, y] = feature.geometry.coordinates as [number, number];
      const [lon, lat] = proj4(fromProjection, toProjection, [x, y]);

      const [normLon, normLat] = normalizePoint([lon, lat]);

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
          coordinates: [normLon, normLat],
        },
        bbox: newBbox,
      };
    })
    .filter((feature) => {
      if (feature.geometry.type === 'Point') {
        return isInsideGermany(feature.geometry.coordinates as [number, number]);
      }
      return true;
    });

  return {
    ...geojson,
    features: reprojectedFeatures,
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
    const response = await fetch(url);
    const res: Response<Package> = await response.json();
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
    const response = await fetch(url);
    const res: Response<Package> = await response.json();
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

function normalizePoint([x, y]: [number, number]): [number, number] {
  // If it looks like lat/lon are swapped
  if (y >= 5.9 && y <= 15.0 && x >= 47.2 && x <= 55.1) {
    return [y, x]; // swap
  }
  return [x, y];
}

function isInsideGermany([lon, lat]: [number, number]) {
  return lon >= 5.9 && lon <= 15.0 && lat >= 47.2 && lat <= 55.1;
}

export async function normalizeFeatures(featureCollection: GeoJSON.FeatureCollection) {
  const cleanedFeatures = featureCollection.features
    .map((feature) => {
      if (feature.geometry.type === 'Point') {
        const coords = normalizePoint(feature.geometry.coordinates as [number, number]);
        return { ...feature, geometry: { ...feature.geometry, coordinates: coords } };
      }
      return feature;
    })
    .filter((feature) => {
      if (feature.geometry.type === 'Point') {
        return isInsideGermany(feature.geometry.coordinates as [number, number]);
      }
      return true;
    });

  return { ...featureCollection, features: cleanedFeatures };
}

import type { Package, Relationship, Resource, Response } from './types/ckan';
import type { Dataset, InputJSON } from '~/server/prepareInput';
import Papa from 'papaparse';
import proj4 from 'proj4';
import defs from 'proj4js-definitions';
import { withRequestSlot } from '~/server/utils/concurrency';
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

export interface FetchedData { id: string, date?: string, data: Record<string, string>[] | GeoJSON.FeatureCollection }

/**
 * `dates` is set for layers whose features carry a monthly `timeline` instead
 * of being published as one collection per snapshot; the slider steps through
 * these months.
 */
export type LayerFeatureCollection = GeoJSON.FeatureCollection & { date?: string, dates?: string[], options?: InputJSON['options'] };

export type FetchedDataArray = LayerFeatureCollection[];

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
        return { id: dataset.id, date: publishedDate, data: await fetchAndParseCsv(resource, dataset) };
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
              const data: FetchedData = { id: dataset.id, data: await fetchAndParseCsv(resourceUrl, dataset) };
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
    let mappingDatasets: FetchedData[] = [];

    if (datasets.mappings.length === 0) {
      mappingDatasets = data;
    }
    else {
      const baseDatasetId = datasets.mappings[0]!.source_db_id;
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
              const baseValue = getValue(baseRow.properties, m.source_db_field)?.toString().toLowerCase();
              if (baseValue && baseValue.includes(m.target_db_field.toLowerCase())) {
                const readings = targetRows.map((d) => {
                  const row = isGeoJSON(d) ? (d.properties || {}) : d;
                  return { date: row[datasets.options.date_field ?? ''], value: row[datasets.options.value_group] };
                });
                mergedRow.properties.timeline = buildTimeline(readings, datasets.options);
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
      const features = merged
        .map(row => isGeoJSON(row) ? row : csvToGeoJSONFromRow(row, datasets.options.latitude_field, datasets.options.longitude_field))
        .filter(feature => feature !== null);
      // The options go out once per collection rather than once per feature: a
      // series like the wind turbines has ~80k features, and the copies made up
      // five sixths of the response. The client attaches them to the features.
      const timelineMonths = features.flatMap(f => Object.keys(f.properties?.timeline ?? {}));
      const featureCollection: LayerFeatureCollection = {
        type: 'FeatureCollection',
        features,
        options: datasets.options,
        ...(timelineMonths.length > 0 && {
          dates: [...new Set(timelineMonths)].sort(),
        }),
        ...(source.date && {
          // `issued` is a local timestamp; going through `Date` would shift it
          // to the previous day in UTC.
          date: source.date.slice(0, 10),
        }),
      };

      if (datasets.options.crs) {
        return reprojectGeoJSON(featureCollection, datasets.options.crs) as LayerFeatureCollection;
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

/** Calendar months a segment needs data for before it gets an average. */
const MIN_YEARS_PER_CALENDAR_MONTH = 3;

/**
 * Month → [mean level, deviation from that calendar month's long-term mean].
 * The deviation is null when there is too little history to compare against.
 */
export type Timeline = Record<string, [number, number | null]>;

/**
 * Condenses a gauge's readings to monthly means and compares each month with
 * the long-term mean of the same calendar month, so seasonal swings do not
 * show up as anomalies.
 *
 * Gauges measure from a zero point (Pegelnullpunkt) that gets moved from time
 * to time, which shifts every later reading by metres. Readings are therefore
 * split into segments wherever two neighbours differ by more than
 * `level_jump_threshold`, and each segment is compared only with itself.
 */
function buildTimeline(readings: { date: unknown, value: unknown }[], options: InputJSON['options']): Timeline {
  const missing = new Set(options.missing_values ?? []);
  const threshold = options.level_jump_threshold ?? Infinity;

  const segments: { month: string, value: number }[][] = [];
  let previous: number | undefined;
  for (const { date, value } of readings) {
    const number = typeof value === 'number' ? value : Number.parseFloat(String(value));
    if (typeof date !== 'string' || Number.isNaN(number) || missing.has(number)) {
      continue;
    }
    if (previous === undefined || Math.abs(number - previous) > threshold) {
      segments.push([]);
    }
    segments.at(-1)!.push({ month: date.slice(0, 7), value: number });
    previous = number;
  }

  const timeline: Timeline = {};
  for (const segment of segments) {
    const sums = new Map<string, { sum: number, count: number }>();
    for (const { month, value } of segment) {
      const entry = sums.get(month) ?? { sum: 0, count: 0 };
      entry.sum += value;
      entry.count++;
      sums.set(month, entry);
    }
    const monthly = [...sums].map(([month, { sum, count }]) => ({ month, level: sum / count }));

    const byCalendarMonth = new Map<string, number[]>();
    for (const { month, level } of monthly) {
      const calendarMonth = month.slice(5);
      byCalendarMonth.set(calendarMonth, [...(byCalendarMonth.get(calendarMonth) ?? []), level]);
    }

    // A month split by a zero point change is listed by the later segment.
    for (const { month, level } of monthly) {
      const sameMonth = byCalendarMonth.get(month.slice(5))!;
      const deviation = sameMonth.length >= MIN_YEARS_PER_CALENDAR_MONTH
        ? Math.round(level - sameMonth.reduce((a, b) => a + b, 0) / sameMonth.length)
        : null;
      timeline[month] = [Math.round(level * 10) / 10, deviation];
    }
  }
  return timeline;
}

/**
 * Downloads a CSV resource and parses it into one record per row.
 *
 * Delimiter and quoting are detected by papaparse unless the dataset pins them
 * via `csv.delimiter` / `csv.quoteChar`. Datasets without a header row list
 * their column names in `headers`.
 */
async function fetchAndParseCsv(csvUrl: string, dataset: Dataset): Promise<Record<string, string>[]> {
  try {
    const response = await fetchCsvFromUrl(csvUrl);
    let csvText = new TextDecoder('utf-8').decode(response);
    if (csvText.includes('Ã') || csvText.includes('\uFFFD')) {
      csvText = new TextDecoder('iso-8859-1').decode(response);
    }

    const result = Papa.parse<string[]>(csvText, {
      delimiter: dataset.csv?.delimiter ?? '',
      quoteChar: dataset.csv?.quoteChar ?? '"',
      skipEmptyLines: 'greedy',
      transform: value => value.trim(),
    });

    const fatal = result.errors.filter(e => e.type === 'Delimiter');
    if (fatal.length > 0) {
      console.warn('Could not detect CSV delimiter, configure csv.delimiter for', dataset.id, csvUrl);
      return [];
    }
    if (result.errors.length > 0) {
      console.warn(`CSV ${csvUrl} parsed with ${result.errors.length} issue(s), first:`, result.errors[0]);
    }

    const rows = result.data;
    const rawHeaders = dataset.headers ?? rows.shift()?.map(h => h.replace(/^\uFEFF/, ''));
    if (!rawHeaders) {
      return [];
    }
    const aliases = new Map(Object.entries(dataset.column_aliases ?? {}).map(([from, to]) => [from.toLowerCase(), to]));
    const headers = rawHeaders.map(h => aliases.get(h.toLowerCase()) ?? h);

    return rows.map((values) => {
      const entry: Record<string, string> = {};
      headers.forEach((key, i) => {
        entry[key] = values[i] ?? '';
      });
      return entry;
    });
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
      const [rawX, y] = feature.geometry.coordinates;
      if (rawX === undefined || y === undefined) {
        return feature;
      }
      const x = stripUtmZonePrefix(fromProjection, rawX);
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

/**
 * German agencies often write ETRS89 / UTM eastings with the zone number in
 * front (`32571605` instead of `571605` for zone 32), and they switch between
 * both spellings from one export to the next — the wind turbine snapshots do.
 * A zone-prefixed easting is far outside the valid range of a plain one, so it
 * can be recognized per coordinate and stripped.
 */
function stripUtmZonePrefix(projection: string, easting: number): number {
  const zone = /^EPSG:258(\d{2})$/.exec(projection)?.[1];
  if (!zone) {
    return easting;
  }
  const prefix = Number(zone) * 1_000_000;
  return easting >= prefix && easting < prefix + 1_000_000 ? easting - prefix : easting;
}

function csvToGeoJSONFromRow(row: Record<string, string>, latKey = 'lat', lonKey = 'lon'): GeoJSON.Feature | null {
  const latitude = Number.parseFloat(row[latKey] ?? '');
  const longitude = Number.parseFloat(row[lonKey] ?? '');

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

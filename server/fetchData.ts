import type { InputJSON } from '~/server/prepareInput';
import proj4 from 'proj4';
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

export async function fetchSeriesData(s: any, dataset: any) {
  try {
    const url = `https://${dataset.host}/api/action/package_show?id=${s.__extras.subject_package_id}`;
    const response = await fetch(url);
    const res = await response.json();
    if (res.success) {
      const resource = res.result.resources.find(
        (res: any) => res.format === 'CSV' || res.mimetype === 'text/csv',
      )?.url;
      if (resource) {
        const publishedDate = res.result.extras.find((m: any) => m.key === 'issued')?.value || '';
        return { id: dataset.id, date: publishedDate, data: await fetchAndParseCsv(resource, dataset?.headers) };
      }
    }
  }
  catch (error) {
    console.error(`Error fetching`, error);
    throw error;
  }
}

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

        if (res.result.relationships_as_object.length > 0) {
          const series = await Promise.all(
            res.result.relationships_as_object.map((s: any) => fetchSeriesData(s, dataset)),
          );
          return series;
        }
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
    const baseDatasetId = datasets.mappings[0].source_db_id;
    const seriesDataMappings = data[0].map((source: any) => {
      if (baseDatasetId === source.id) {
        const merged = source.data.map((baseRow: any) => {
          const mergedRow = { ...baseRow };
          datasets.mappings.forEach((m: any) => {
            const targetDataset = data.find((d: any) => d.id === m.target_db_id);
            if (!targetDataset)
              return;
            const match = targetDataset.data.find((row: any) =>
              row[m.target_db_field] === baseRow[m.source_db_field],
            );
            if (match) {
              Object.entries(match).forEach(([key, value]) => {
                mergedRow[`${key}`] = value;
              });
            }
            mergedRow.options = datasets.options;
          });
          return mergedRow;
        });
        if (!merged.date) {
          merged.date = [];
        }
        merged.date = source.date;
        const geojson = csvToGeoJSONFromRows(merged, 'GEOGR_BREITE', 'GEOGR_LAENGE');
        geojson.date = new Date(source.date).toISOString().split('T')[0];
        return geojson;
      }
      else {
        throw new Error('Base dataset not found');
      }
    });
    const sorted = seriesDataMappings.sort((a: any, b: any) => a.date.localeCompare(b.date));
    return sorted;
  }
  catch (error) {
    console.error('Error fetching Bathing Mappings', error);
    throw error;
  }
}

export async function fetchLakesMappings(data: any, datasets: InputJSON) {
  try {
    const baseDatasetId = datasets.mappings[0].source_db_id;
    const baseDataset = data.find((d: any) => d.id === baseDatasetId);

    if (!baseDataset)
      throw new Error('Base dataset not found');
    const features = baseDataset.data.features.map((baseRow: any) => {
      const mergedRow: any = { ...baseRow };

      datasets.mappings.forEach((m: any) => {
        const targetDataset = data.find((d: any) => d.id === m.target_db_id);
        if (!targetDataset)
          return;
        if (!mergedRow.lakeDepth) {
          mergedRow.lakeDepth = [];
        }
        if (!mergedRow.properties.average_depth) {
          mergedRow.properties.average_depth = 0;
        }
        const baseValue = baseRow.properties.WK_NAME.toLowerCase();
        if (baseValue.includes(m.target_db_field.toLowerCase())) {
          const depths = targetDataset.data.map((d: any) => {
            return d.wasserstand;
          });
          mergedRow.lakeDepth.push(targetDataset.data);
          mergedRow.properties.average_depth = calculateMean(depths);
        }
        mergedRow.properties.options = datasets.options;
      });
      return mergedRow;
    });
    return {
      type: 'FeatureCollection',
      features,
    };
  }
  catch (error) {
    console.error('Error fetching Lakes Mappings', error);
    throw error;
  }
}

function calculateMean(values: number[]): number {
  const numbers = values.map(v => typeof v === 'string' ? Number.parseFloat(v) : v).filter(v => typeof v === 'number' && !Number.isNaN(v));
  if (numbers.length === 0) {
    return 0;
  }
  const sum = numbers.reduce((acc, val) => acc + val, 0);
  // console.warn('sum', sum);
  return sum / numbers.length;
}

async function fetchAndParseCsv<D>(csvUrl: string, headers?: string[]): Promise<D[]> {
  try {
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

function csvToGeoJSONFromRows(rows: Record<string, any>[], latKey = 'lat', lonKey = 'lon') {
  const features = rows
    .map((row) => {
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
    })
    .filter(Boolean);

  return {
    type: 'FeatureCollection',
    features,
    date: '',
  };
}

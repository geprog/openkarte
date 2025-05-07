import proj4 from 'proj4';

proj4.defs('EPSG:25832', '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs');
const fromProjection = 'EPSG:25832';
const toProjection = 'WGS84';

type bathingEntry = Record<string, string>;
type classificationEntry = Record<string, string>;
type measurementEntry = Record<string, string>;
type seasonalEntry = Record<string, string>;
type infrastructureEntry = Record<string, string>;
export interface MergedData {
  bathing: bathingEntry
  classification: classificationEntry | null
  measurements: measurementEntry | null
  seasonal: seasonalEntry | null
  infrastructure: infrastructureEntry | null
}

const headerMap = {
  bathing: [
    'BADEGEWAESSERID',
    'BADEGEWAESSERNAME',
    'KURZNAME',
    'ALLGEMEIN_GEBRAEUCHL_NAME',
    'GEWAESSERKATEGORIE',
    'KUESTENGEWAESSER',
    'BADEGEWAESSERTYP',
    'WEITEREBESCHREIBUNG',
    'BADESTELLENLAENGE',
    'EUANMELDUNG',
    'EUABMELDUNG',
    'FLUSSGEBIETSEINHEITID',
    'FLUSSGEBIETSEINHEITNAME',
    'WASSERKOERPERID',
    'WASSERKOERPERNAME',
    'NATWASSERKOERPERID',
    'NATWASSERKOERPERNAME',
    'SCHLUESSELWOERTER',
    'KREISNR',
    'KREIS',
    'GEMEINDENR',
    'GEMEINDE',
    'UTM_OST',
    'UTM_NORD',
    'GEOGR_LAENGE',
    'GEOGR_BREITE',
    'BADESTELLENINFORMATION',
    'AUSWIRKUNGEN_AUF_BADEGEWAESSER',
    'MOEGLICHEBELASTUNGEN',
  ],
  classification: [
    'BADEGEWAESSERID',
    'BEURTEILUNGSZEITRAUM_VON',
    'BEURTEILUNGSZEITRAUM_BIS',
    'EINSTUFUNG_ODER_VORABBEWERTUNG',
  ],
  measurement: [
    'BADEGEWAESSERID',
    'MESSSTELLENNAME',
    'MESSSTELLENID',
    'UEBERWACHUNGSARTID',
    'UEBERWASCHUNGSARTTEXT',
    'GEWAESSERKATEGORIE',
    'KUESTENGEWAESSER',
    'PROBEID',
    'DATUMMESSUNG',
    'PROBENART',
    'ECOLI',
    'INTEST_ENTEROKOKKEN',
    'WASSERTEMP',
    'LUFTTEMP',
    'SICHTTIEFE',
    'BEMERKUNG',
  ],
  seasonal: [
    'BADEGEWAESSERID',
    'SAISONBEGINN',
    'SAISONENDE',
    'GESCHLOSSEN',
  ],
  infrastructure: [
    'BADEGEWAESSERID',
    'INFRASTRUKTURID',
    'INFRASTRUKTUR',
  ],
};

const dataUrls = {
  bathing: 'https://opendata.schleswig-holstein.de/api/action/package_show?id=badegewasser-stammdaten-',
  classification: 'https://opendata.schleswig-holstein.de/api/action/package_show?id=badegewasser-einstufung',
  measurement: 'https://opendata.schleswig-holstein.de/api/action/package_show?id=badegewasser-messungen',
  seasonal: 'https://opendata.schleswig-holstein.de/api/action/package_show?id=badegewasser-saisondauer',
  infrastructure: 'https://opendata.schleswig-holstein.de/api/action/package_show?id=badegewasser-infrastruktur-aktuell',
  busStops: 'https://opendata.schleswig-holstein.de/api/action/package_show?id=bushaltestelle',
};

async function getCsvUrl(apiUrl: string): Promise<string | null> {
  const response = await fetch(apiUrl);
  const data = await response.json();
  if (data.success) {
    const rawUrl = data.result.resources.find(
      (res: any) => res.format === 'CSV' || res.mimetype === 'text/csv',
    )?.url;

    if (rawUrl) {
      return rawUrl.replace(/^http:/, 'https:');
    }
  }
  console.error('Failed to get CSV URL:', data.error);
  return null;
}
async function getGeoJsonUrl(apiUrl: string): Promise<string | null> {
  const response = await fetch(apiUrl);
  const data = await response.json();
  if (data.success) {
    const rawUrl = data.result.resources.find(
      (res: any) => res.format === 'GeoJSON' || res.mimetype === 'json',
    )?.url;

    if (rawUrl) {
      return rawUrl.replace(/^http:/, 'https:');
    }
  }
  console.error('Failed to get GEOJson URL:', data.error);
  return null;
}
async function fetchAndParseCSV(csvUrl: string, headers: string[]): Promise<bathingEntry[]> {
  const proxyUrl = `/api/proxy-csv?url=${encodeURIComponent(csvUrl)}`;
  const response = await fetch(proxyUrl);
  const arrayBuffer = await response.arrayBuffer();
  const decoder = new TextDecoder('iso-8859-1');
  const csvText = decoder.decode(arrayBuffer);

  const rows = csvText.trim().split('\n');
  return rows.map((line) => {
    const values = line.split('|').map(v => v.replace(/^"|"$/g, '').trim());
    const entry: bathingEntry = {};
    headers.forEach((key, i) => {
      entry[key] = values[i] ?? '';
    });
    return entry;
  });
}
async function fetchAndParseGeoJson(geoJsonUrl: string) {
  const proxyUrl = `/api/proxy-csv?url=${encodeURIComponent(geoJsonUrl)}`;
  const response = await fetch(proxyUrl).then(res => res.json());
  const reprojectedCoordinatesData = reprojectGeoJSON(response);
  return reprojectedCoordinatesData;
}
function reprojectGeoJSON(geojson) {
  return {
    ...geojson,
    features: geojson.features.map((feature) => {
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


export async function fetchBathData(selectedDate: Date): Promise<MergedData[]> {
  try {
    dataUrls.bathing = `https://opendata.schleswig-holstein.de/api/action/package_show?id=badegewasser-stammdaten-${selectedDate.value}`;
    const [bathingCsvUrl, classificationCsvUrl, measurementCsvUrl, seasonalCsvUrl, infrastructureCsvUrl] = await Promise.all([
      getCsvUrl(dataUrls.bathing),
      getCsvUrl(dataUrls.classification),
      getCsvUrl(dataUrls.measurement),
      getCsvUrl(dataUrls.seasonal),
      getCsvUrl(dataUrls.infrastructure),
    ]);

    if (!bathingCsvUrl || !classificationCsvUrl || !measurementCsvUrl || !seasonalCsvUrl || !infrastructureCsvUrl)
      throw new Error('Missing CSV URLs');

    const [bathingData, classificationData, measurementData, seasonalData, infrastructureData] = await Promise.all([
      fetchAndParseCSV(bathingCsvUrl, headerMap.bathing),
      fetchAndParseCSV(classificationCsvUrl, headerMap.classification),
      fetchAndParseCSV(measurementCsvUrl, headerMap.measurement),
      fetchAndParseCSV(seasonalCsvUrl, headerMap.seasonal),
      fetchAndParseCSV(infrastructureCsvUrl, headerMap.infrastructure),
    ]);

    const classificationMap = new Map<string, classificationEntry>();
    classificationData.forEach(row => classificationMap.set(row.BADEGEWAESSERID, row as classificationEntry));

    const measurementMap = new Map<string, measurementEntry>();
    measurementData.forEach((row) => {
      const id = row.BADEGEWAESSERID;
      const currentDate = new Date(row.DATUMMESSUNG);
      if (!measurementMap.has(id)) {
        measurementMap.set(id, row);
      }
      else {
        const existingEntry = measurementMap.get(id)!;
        const existingDate = new Date(existingEntry.DATUM);
        if (currentDate > existingDate) {
          measurementMap.set(id, row);
        }
      }
    });

    const seasonalMap = new Map<string, seasonalEntry>();
    seasonalData.forEach(row => seasonalMap.set(row.BADEGEWAESSERID, row as seasonalEntry));

    const infrastructureMap = new Map<string, infrastructureEntry>();
    infrastructureData.forEach(row => infrastructureMap.set(row.BADEGEWAESSERID, row as infrastructureEntry));

    // Merge data
    const merged: MergedData[] = bathingData.map((bathingRow) => {
      const id = bathingRow.BADEGEWAESSERID;
      return {
        bathing: bathingRow,
        classification: classificationMap.get(id) || null,
        measurements: measurementMap.get(id) || null,
        seasonal: seasonalMap.get(id) || null,
        infrastructure: infrastructureMap.get(id) || null,
      };
    });
    return merged;
  }
  catch (err) {
    console.error('Failed to fetch and merge:', err);
    return [];
  }
}

export async function fetchBusStopData() {
  try {
    const [busStopGeoJsonUrl] = await Promise.all([
      getGeoJsonUrl(dataUrls.busStops),
    ]);

    if (!busStopGeoJsonUrl)
      throw new Error('Missing GEOJson URL');

    const [busStopData] = await Promise.all([
      fetchAndParseGeoJson(busStopGeoJsonUrl),
    ]);
    return busStopData;
  }
  catch (err) {
    console.error('Failed to fetch:', err);
    return [];
  }
}

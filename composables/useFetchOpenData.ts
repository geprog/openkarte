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
  lake: 'https://opendata.schleswig-holstein.de/api/action/package_show?id=see-wasserkorper',
};

const lakeNames = [
  'hemmelsdorfer',
  'hemmelmarker',
  'kellersee',
  'postsee',
  'Arenholzer',
  'Barkauer',
  'Behlendorfer',
  'Behler',
  'Belauer',
  'Bistensee',
  'Bordesholmer',
  'Bornhöveder',
  'Bottschloter',
  'Brahmsee',
  'Dieksee',
  'Dobersdorfer',
  'Drüsensee',
  'Einfelder',
  'Großensee',
  'Plöner',
  'Pönitzer',
  'Ratzeburger',
  'Segeberger',
  'Gudower',
  'Hohner',
  'Süderfahrenstedt',
  'Mözener',
  'Neustadt',
  'Neversdorfer',
  'Passader',
  'Rantumdammsiel',
  'Schluensee',
  'Schöhsee',
  'Schwansener',
  'Seedorfer',
  'Sibbersdorfer',
  'Stendorfer',
  'Stocksee',
  'Stolper',
  'Südensee',
  'Süseler',
  'Suhrer',
  'Trammer',
  'Tresdorfer',
  'Vierer',
  'Westensee',
  'Windebyer',
  'Wittensee',
  'Meldorf-Kronenloch',
];

export interface LakeDepth {
  Zeit: string
  wasserstand: string
  wasserstand_status: string
}

const lakeUrls = [
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-hemmelsdorfer-see-hemmelsdorfer-see1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-hemmelmarker-see',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-kellersee-kellersee1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-postsee-postsee1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-arenholzer-see-arenholzer-see',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-barkauer-see-barkauer-see1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-behlendorfer-see-behlendorfer-see1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-behler-see-behler-see1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-belauer-see-belauer-see1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-bistensee-bistensee1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-bordesholmer-see-bordesholmer-see1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-bornhoveder-see-bornhoveder-see1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-bottschlotter-see',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-brahmsee',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-dieksee-dieksee1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-dobersdorfer-see-dobersdorfer-see1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-drusensee-drusensee1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-einfelder-see-einfelder-see1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-grossensee-grossensee1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-kl-ploner-see-kl-ploner-see1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-kl-ponitzer-see-kl-ponitzer-see',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-ratzeburger-see-ratzeburger-see1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-gr-segeberger-see-segeberger-see1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-gudower-see-gudower-see1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-hohner-see-hohner-see1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-langsee-suderfahrenstedt-langsee1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-mozener-see-mozener-see1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-neustadter-binnenwasser1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-neversdorfer-see-neversdorfer-see1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-passader-see-passader-see1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-rantumdammsiel-rantumbecken1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-schluensee-schluensee1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-schohsee1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-schwansener-see-fp-schopfwerk1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-seedorfer-see',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-sibbersdorfer-see-sibbersdorfer-see',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-stendorfer-see-stendorfer-see1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-stocksee-stocksee1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-stolper-see-stolper-see1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-sudensee-sudensee1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-suseler-see',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-suhrer-see1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-trammer-see1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-tresdorfer-see1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-vierer-see',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-westensee-westensee1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-windebyer-noor1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-wittensee-wittensee1',
  'https://opendata.schleswig-holstein.de/api/action/package_show?id=wasserstand-pegel-meldorf-kronenloch',
];

async function getUrl(apiUrl: string, type: string): Promise<string> {
  const response = await fetch(apiUrl);
  const data = await response.json();
  let rawUrl = '';
  if (data.success) {
    if (type === 'csv') {
      rawUrl = data.result.resources.find(
        (res: any) => res.format === 'CSV' || res.mimetype === 'text/csv',
      )?.url;
    }
    else if (type === 'json') {
      rawUrl = data.result.resources.find(
        (res: any) => res.format === 'GeoJSON' || res.mimetype === 'json',
      )?.url;
    }
    else if (type === 'shp') {
      rawUrl = data.result.resources.find(
        (res: any) => res.format === 'SHP' || res.mimetype === 'application/zip',
      )?.url;
    }
    else {
      console.error('unsupported file type');
    }
    if (rawUrl) {
      return rawUrl.replace(/^http:/, 'https:');
    }
  }
  console.error('Failed to get URL:', data.error);
  throw new Error(`Failed to load Meta Information from ${apiUrl}`);
}
async function fetchAndParseCSV<D>(csvUrl: string, headers?: string[]): Promise<D[]> {
  const proxyUrl = `/api/proxy-csv?url=${encodeURIComponent(csvUrl)}`;
  const response = await fetch(proxyUrl);
  const arrayBuffer = await response.arrayBuffer();
  const decoder = new TextDecoder('iso-8859-1');
  const csvText = decoder.decode(arrayBuffer);

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
async function fetchAndParseGeoJson<G extends GeoJSON.Geometry, P>(geoJsonUrl: string): Promise<GeoJSON.FeatureCollection<G, P>> {
  const proxyUrl = `/api/proxy-csv?url=${encodeURIComponent(geoJsonUrl)}`;
  const response = await fetch(proxyUrl).then(res => res.json());
  if (geoJsonUrl.toLowerCase().endsWith('.zip')) {
    return response as GeoJSON.FeatureCollection<G, P>;
  }
  const reprojectedCoordinatesData = reprojectGeoJSON<G, P>(response);
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

export async function fetchBathData(selectedDate: string): Promise<MergedData[]> {
  try {
    dataUrls.bathing = `https://opendata.schleswig-holstein.de/api/action/package_show?id=badegewasser-stammdaten-${selectedDate}`;
    const [bathingCsvUrl, classificationCsvUrl, measurementCsvUrl, seasonalCsvUrl, infrastructureCsvUrl] = await Promise.all([
      getUrl(dataUrls.bathing, 'csv'),
      getUrl(dataUrls.classification, 'csv'),
      getUrl(dataUrls.measurement, 'csv'),
      getUrl(dataUrls.seasonal, 'csv'),
      getUrl(dataUrls.infrastructure, 'csv'),
    ]);

    const [bathingData, classificationData, measurementData, seasonalData, infrastructureData] = await Promise.all([
      fetchAndParseCSV<bathingEntry>(bathingCsvUrl, headerMap.bathing),
      fetchAndParseCSV<classificationEntry>(classificationCsvUrl, headerMap.classification),
      fetchAndParseCSV<measurementEntry>(measurementCsvUrl, headerMap.measurement),
      fetchAndParseCSV<seasonalEntry>(seasonalCsvUrl, headerMap.seasonal),
      fetchAndParseCSV<infrastructureEntry>(infrastructureCsvUrl, headerMap.infrastructure),
    ]);

    const classificationMap = new Map<string, classificationEntry>();
    classificationData.forEach((row) => {
      if (row.EINSTUFUNG_ODER_VORABBEWERTUNG === '---') {
        row.EINSTUFUNG_ODER_VORABBEWERTUNG = 'ohne Bewertung';
      }
      classificationMap.set(row.BADEGEWAESSERID, row as classificationEntry);
    });

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

export async function fetchBusStopData(): Promise<GeoJSON.Feature<GeoJSON.Point, unknown>[]> {
  try {
    const [busStopGeoJsonUrl] = await Promise.all([
      getUrl(dataUrls.busStops, 'json'),
    ]);

    if (!busStopGeoJsonUrl)
      throw new Error('Missing GEOJson URL');

    const [busStopData] = await Promise.all([
      fetchAndParseGeoJson<GeoJSON.Point, unknown>(busStopGeoJsonUrl),
    ]);
    return busStopData.features;
  }
  catch (err) {
    console.error('Failed to fetch:', err);
    return [];
  }
}

export async function fetchLakesData(): Promise<GeoJSON.Feature<GeoJSON.Geometry, { WK_NAME: string, lakeDepth: LakeDepth[] }>[]> {
  try {
    const lakeWaterShpUrl = await getUrl(dataUrls.lake, 'shp');
    if (!lakeWaterShpUrl)
      throw new Error('Missing SHP URL');

    const csvUrls = await Promise.all(
      lakeUrls.map(url => getUrl(url, 'csv')),
    );

    const lakeData = await fetchAndParseGeoJson<GeoJSON.Geometry, { WK_NAME: string }>(lakeWaterShpUrl);

    const lakeCsvData = await Promise.all(
      csvUrls.map(url => fetchAndParseCSV<LakeDepth>(url)),
    );

    // Merge data
    const merged = lakeData.features.map((feature) => {
      const wkName = feature.properties.WK_NAME.toLowerCase();

      const matchingIndex = lakeNames.findIndex(lakeName =>
        wkName.includes(lakeName.toLowerCase()),
      );

      return {
        ...feature,
        properties: {
          ...feature.properties,
          lakeDepth: matchingIndex !== -1 ? lakeCsvData[matchingIndex] : [],
        },
      };
    });
    return merged;
  }
  catch (err) {
    console.error('Failed to fetch and merge:', err);
    return [];
  }
}

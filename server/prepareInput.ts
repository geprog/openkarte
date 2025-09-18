import fs from 'node:fs';
import path from 'node:path';
import { Options } from '~/composables/dataTypes';
import { fetchData, fetchMappings } from '~/server/fetchData';

export interface Dataset {
  host: string
  id: string
  resource_id: string
  title: string
  headers?: string[]
}

export interface Mappings {
  source_db_id: string
  source_db_field: string
  condition: string
  target_db_id: string
  target_db_field: string
}

export interface InputJSON {
  datasets: Dataset[]
  mappings: Mappings[]
  options: Options
}

export async function getData(feature: string) {
  // eslint-disable-next-line node/prefer-global/process
  const dataDir = path.resolve(process.cwd(), 'data');
  const files = fs.readdirSync(dataDir);

  const file = files.find(f => f.toLowerCase().includes(feature.toLowerCase()) && f.endsWith('InputLayer.json'));

  if (!file) {
    throw new Error(`Unavailable Feature Requested: ${feature}`);
  }

  const filePath = path.join(dataDir, file);
  const jsonString = fs.readFileSync(filePath, 'utf-8');
  const input: InputJSON = JSON.parse(jsonString);
  const fetchedData = await fetchData(input);
  return await fetchMappings(fetchedData, input);
}

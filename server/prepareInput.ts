import bathingJson from '~/data/bathingWaterInputLayer.json';
import lakesJson from '~/data/lakesInputLayer.json';
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
export interface Options {
  label_option: string
  legend_option: string
  type: string
  value_group: string
}

export interface InputJSON {
  datasets: Dataset[]
  mappings: Mappings[]
  options: Options
}

export async function getData(feature: string) {
  if (feature === 'bathing') {
    const fetchedData = await fetchData(bathingJson as InputJSON);
    return await fetchMappings(fetchedData, bathingJson as InputJSON);
  }
  else if (feature === 'lakeData') {
    const fetchedData = await fetchData(lakesJson as InputJSON);
    return await fetchMappings(fetchedData, lakesJson as InputJSON);
  }
  else {
    return 'Unavailable Feature Requested!';
  }
}

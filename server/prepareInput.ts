import bathingJson from '~/data/bathingWaterInputLayer.json';
import lakesJson from '~/data/lakesInputLayer.json';
import { fetchBathingMappings, fetchData, fetchLakesMappings } from '~/server/fetchData';

export interface Dataset {
  host: string
  id: string
  resource_id: string
  title: string
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
}
export interface StructuredDataset {
  id: string
  data: []
  // mappings: Record<string, string>
}

export async function getData(feature: string) {
  if (feature === 'bathing') {
    const fetchedData = await fetchData(bathingJson as InputJSON);
    return await fetchBathingMappings(fetchedData, bathingJson as InputJSON);
  }
  else if (feature === 'lakes') {
    const fetchedData = await fetchData(lakesJson as InputJSON);
    return await fetchLakesMappings(fetchedData, bathingJson as InputJSON);
  }
  else {
    return 'Unavailable Feature Requested!';
  }
}

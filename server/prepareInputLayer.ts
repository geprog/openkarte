import inputJson from '~/data/inputLayer.json';

interface Dataset {
  host: string
  id: string
  resource_id: string
  title: string
}

interface Mappings {
  source_db_id: string
  source_db_field: string
  condition: string
  target_db_id: string
  target_db_field: string
}

interface InputJSON {
  datasets: Dataset[]
  mappings: Mappings[]
}
/* interface StructuredDataset {
  name: string
  datasets: Dataset
  mappings: Record<string, string> // or you can define a proper structure here
} */

/* async function fetchDatasetData(dataset: Dataset): Promise<StructuredDataset> {
  const url = `https://${dataset.host}/api/3/action/datastore_search?resource_id=${dataset.resource_id}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    return {
      name: dataset.title,
      datasets: dataset,
      mappings: inferMappings(data), // Optional: define a helper to map structure
    };
  }
  catch (error) {
    console.error(`Error fetching ${dataset.title}:`, error);
    return {
      name: dataset.title,
      datasets: dataset,
      mappings: {},
    };
  }
} */

export const input: InputJSON = inputJson;

import type { FetchedDataArray } from '~/server/fetchData';
import { getData } from '~/server/prepareInput';

const cache: Record<string, {
  data: FetchedDataArray
  timestamp: number
}> = {};

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export default defineEventHandler(async (event) => {
  const feature = getQuery(event).feature as string;
  if (!feature) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing feature',
    });
  }
  console.info('Fetching data for feature:', feature); // eslint-disable-line no-console
  try {
    // eslint-disable-next-line node/prefer-global/process
    if (process.env.NODE_ENV !== 'development' && cache[feature] && (Date.now() - cache[feature].timestamp < CACHE_DURATION)) {
      console.info('Returning cached data for feature:', feature); // eslint-disable-line no-console
      return cache[feature].data;
    }
    const data = await getData(feature);
    cache[feature] = {
      data,
      timestamp: Date.now(),
    };
    return data;
  }
  catch (error) {
    console.error('Error fetching data for feature:', feature, error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Error fetching data',
    });
  }
});

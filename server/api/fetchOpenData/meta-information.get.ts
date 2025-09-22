import { getUrl } from '~/server/prepareInput';

export default defineEventHandler(async (event) => {
  const feature = getQuery(event).feature as string;
  if (!feature) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing feature',
    });
  }
  console.info('Fetching urls for feature:', feature); // eslint-disable-line no-console
  try {
    const urls = await getUrl(feature);
    return urls;
  }
  catch (error) {
    console.error('Error fetching urls for feature:', feature, error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Error fetching urls',
    });
  }
});

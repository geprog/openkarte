import { getData } from '~/server/prepareInput';

export default defineEventHandler(async (event) => {
  const feature = getQuery(event).feature as string;
  if (!feature) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing feature',
    });
  }
  return await getData(feature);
});

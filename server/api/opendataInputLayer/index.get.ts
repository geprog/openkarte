import { input } from '~/server/prepareInputLayer';

export default defineEventHandler(async () => {
  console.warn(input);
  return input;
});

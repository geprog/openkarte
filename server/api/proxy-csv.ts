export default defineEventHandler(async (event) => {
  const url = getQuery(event).url as string;
  const response = await fetch(url); // server-side, no CORS issue
  const data = await response.text();
  return data;
});

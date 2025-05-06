export default defineEventHandler(async (event) => {
  const url = getQuery(event).url as string;
  const response = await fetch(url);
  const data = await response.arrayBuffer();
  setHeader(event, 'Content-Type', 'text/plain; charset=iso-8859-1');
  return new Uint8Array(data); // Return binary data
});

FROM node:22
WORKDIR /app
COPY .output ./
CMD ["node", "server/index.mjs"]
FROM node:22.17.1-alpine
WORKDIR /app
COPY .output ./
COPY data ./data
EXPOSE 3000
USER node
CMD ["node", "server/index.mjs"]

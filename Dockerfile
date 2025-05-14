FROM node:22-alpine
WORKDIR /app
COPY .output ./
EXPOSE 3000
USER node
CMD ["node", "server/index.mjs"]

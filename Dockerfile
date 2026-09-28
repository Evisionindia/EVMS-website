FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 DATABASE_PATH=/data/website.sqlite
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /data && chown node:node /data
USER node
CMD ["node","server/index.js"]

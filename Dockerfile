# Daiboju on Google Cloud Run: pages + API + in-process P2P listener in one container.
FROM node:22-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY api ./api
COPY public ./public
COPY worker/p2p.mjs ./worker/p2p.mjs
COPY server.mjs ./
ENV NODE_ENV=production PORT=8080
USER node
CMD ["node", "server.mjs"]

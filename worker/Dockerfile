FROM node:22-slim
WORKDIR /app
COPY listener.mjs p2p.mjs ./ 
ENV NODE_ENV=production
CMD ["node", "listener.mjs"]

FROM node:22-bookworm-slim AS frontend
WORKDIR /src/react
COPY react/package*.json ./
RUN npm ci
COPY react/ ./
RUN npm run build

FROM node:22-bookworm-slim
ARG APP_VERSION=unversioned
ENV NODE_ENV=production PORT=5174 APP_VERSION=$APP_VERSION
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY *.js ./
COPY production/ ./production/
COPY --from=frontend /src/react/dist ./react/dist
USER node
EXPOSE 5174
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:5174/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","server.js"]

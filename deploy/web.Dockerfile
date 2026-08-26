# AcademyJournal frontend (Vite/React build) served by Caddy, which also
# terminates TLS (automatic Let's Encrypt) and reverse-proxies the API host
# to the backend container.
# Build context = repo root.

# ---- stage 1: build the SPA ----
FROM node:22-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ARG VITE_API_URL
RUN sed -i "s#^VITE_API_URL=.*#VITE_API_URL=${VITE_API_URL}#" .env.production \
    || echo "VITE_API_URL=${VITE_API_URL}" >> .env.production
RUN npm run build

# ---- stage 2: serve ----
FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv

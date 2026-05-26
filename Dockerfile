FROM node:22-alpine AS base

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Build ---
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npm run build

# --- Production ---
FROM base AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NITRO_PORT=3000
ENV NITRO_HOST=0.0.0.0

COPY --from=build /app/.output ./.output

EXPOSE 3000

# Kamal v2 reads container.State.Health to gate rolling deploys.
# Without HEALTHCHECK, docker inspect returns null and Kamal fails
# the deploy even when Nitro is up.
# 127.0.0.1 (not localhost) — alpine resolves localhost to ::1 first,
# but Nitro binds to 0.0.0.0 (IPv4) per NITRO_HOST.
# wget is provided by alpine's busybox.
HEALTHCHECK --interval=5s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", ".output/server/index.mjs"]

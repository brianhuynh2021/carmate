# ── STAGE 1: Build Frontend SPA ──
# Use Debian slim (glibc) instead of Alpine (musl): better compatibility with
# native addons. better-sqlite3 needs python3/make/g++ to compile when no
# prebuilt binary matching the environment is available.
FROM node:22-slim AS builder
WORKDIR /app

# Build toolchain for native addons (better-sqlite3 -> node-gyp needs Python).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/
COPY packages/shared/package*.json packages/shared/

# npm ci: install exactly the versions locked in package-lock.json (the tested versions).
RUN npm ci

COPY . .

RUN npm run build --workspace=@carmate/web

# ── STAGE 2: Production Server ──
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# curl for the healthcheck; ca-certificates for outbound HTTPS calls.
# python3/make/g++ are only used to compile better-sqlite3 and are removed right away
# in the same layer, keeping the production image small.
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/
COPY packages/shared/package*.json packages/shared/

# Install production dependencies with a temporary toolchain, then remove the toolchain
# in the same layer so the final image does not bloat.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && npm ci --omit=dev \
  && npm cache clean --force \
  && apt-get purge -y --auto-remove python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY packages/shared packages/shared
COPY apps/api apps/api
COPY scripts scripts
COPY --from=builder /app/apps/web/dist /app/apps/web/dist

# Data directory — Fly mounts a volume over this path
RUN mkdir -p /app/apps/api/data

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:${PORT}/api/health || exit 1

CMD ["node", "apps/api/src/index.js"]

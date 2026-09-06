# ── STAGE 1: Build Frontend SPA ──
# Dùng Debian slim (glibc) thay vì Alpine (musl): better-sqlite3 có sẵn
# prebuilt binary cho glibc, không phải biên dịch lại từ nguồn.
FROM node:22-slim AS builder
WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/
COPY packages/shared/package*.json packages/shared/

RUN npm install

COPY . .

RUN npm run build --workspace=@carmate/web

# ── STAGE 2: Production Server ──
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# curl cho healthcheck; ca-certificates cho các lệnh gọi HTTPS ra ngoài
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/
COPY packages/shared/package*.json packages/shared/

# --ignore-scripts=false để better-sqlite3 lấy được prebuilt binary
RUN npm install --omit=dev \
  && npm cache clean --force

COPY packages/shared packages/shared
COPY apps/api apps/api
COPY scripts scripts
COPY --from=builder /app/apps/web/dist /app/apps/web/dist

# Thư mục dữ liệu — Fly gắn volume đè lên đường dẫn này
RUN mkdir -p /app/apps/api/data

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:${PORT}/api/health || exit 1

CMD ["node", "apps/api/src/index.js"]

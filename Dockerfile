# ── STAGE 1: Build Frontend SPA ──
# Dùng Debian slim (glibc) thay vì Alpine (musl): tương thích tốt hơn với
# native addon. better-sqlite3 cần python3/make/g++ để biên dịch khi không
# lấy được prebuilt binary khớp môi trường.
FROM node:22-slim AS builder
WORKDIR /app

# Build toolchain cho native addon (better-sqlite3 -> node-gyp cần Python).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/
COPY packages/shared/package*.json packages/shared/

# npm ci: cài đúng phiên bản đã khoá trong package-lock.json (bản đã qua kiểm thử).
RUN npm ci

COPY . .

RUN npm run build --workspace=@carmate/web

# ── STAGE 2: Production Server ──
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# curl cho healthcheck; ca-certificates cho các lệnh gọi HTTPS ra ngoài.
# python3/make/g++ chỉ dùng để biên dịch better-sqlite3 rồi gỡ bỏ ngay
# trong cùng một layer, giữ image production gọn nhẹ.
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/
COPY packages/shared/package*.json packages/shared/

# Cài dependency production kèm toolchain tạm thời, sau đó gỡ toolchain
# ngay trong cùng layer để không làm phình image cuối.
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

# Thư mục dữ liệu — Fly gắn volume đè lên đường dẫn này
RUN mkdir -p /app/apps/api/data

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:${PORT}/api/health || exit 1

CMD ["node", "apps/api/src/index.js"]

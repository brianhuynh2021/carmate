# ── STAGE 1: Build Frontend SPA ──
FROM node:20-alpine AS builder
WORKDIR /app

# Cài đặt dependencies cho Monorepo
COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/
COPY packages/shared/package*.json packages/shared/

RUN npm install

# Copy source code
COPY . .

# Build Vite Web Frontend Bundle
RUN npm run build --workspace=@carmate/web

# ── STAGE 2: Production Server ──
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5173

# Cài đặt công cụ cần thiết cho SQLite native modules nếu cần
RUN apk add --no-cache python3 make g++

COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/
COPY packages/shared/package*.json packages/shared/

RUN npm install --omit=dev

# Copy mã nguồn backend & frontend đã build
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY --from=builder /app/apps/web/dist /app/apps/web/dist

# Tạo thư mục lưu trữ SQLite Database
RUN mkdir -p /app/apps/api/data

VOLUME ["/app/apps/api/data"]
EXPOSE 5173

CMD ["node", "apps/api/src/index.js"]

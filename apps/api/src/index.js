import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { initDB, closeDB } from './db/sqliteStore.js';
import apiRouter from './routes/api.js';
import { securityHeadersMiddleware, sanitizeInput, globalApiLimiter } from './middlewares/security.js';
import { sendSystemErrorAlert } from './utils/telegramAlert.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDir = path.resolve(__dirname, '../../web');
const webDistDir = path.resolve(webDir, 'dist');

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 5173; // Khởi động duy nhất 1 cổng 5173

// 0. Trust Proxy (Chỉ kích hoạt khi được cấu hình qua biến môi trường TRUST_PROXY)
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// 1. Cấu hình An Ninh & Middleware
app.use(securityHeadersMiddleware);

// CORS Whitelist: Cho phép domain cục bộ, production domains và domain tuỳ biến qua ALLOWED_ORIGINS
const defaultAllowedOrigins = ['https://carmate.vn', 'https://www.carmate.vn', 'https://ops.carmate.vn'];
const customAllowed = (process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...defaultAllowedOrigins, ...customAllowed]);

app.use(
  cors({
    origin: (origin, callback) => {
      // Cho phép request cùng nguồn (no origin), curl, mobile app hoặc local development
      if (!origin) return callback(null, true);
      if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      if (allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
    credentials: true
  })
);

// Giới hạn gói tin 1MB chống tấn công DDoS làm tràn RAM
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(sanitizeInput);

// 2. Request Correlation ID & Structured Logging (Khả năng quan sát & Dễ debug theo review)
app.use((req, res, next) => {
  const reqId = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = reqId;
  res.setHeader('x-request-id', reqId);

  if (req.originalUrl.startsWith('/api')) {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const statusColor = res.statusCode >= 400 ? '\x1b[31m' : res.statusCode >= 300 ? '\x1b[33m' : '\x1b[32m';
      const shortId = typeof reqId === 'string' ? reqId.slice(0, 8) : 'req';
      console.log(
        `[API] [${shortId}] ${req.method} ${req.originalUrl} -> ${statusColor}${res.statusCode}\x1b[0m (${duration}ms)`
      );
    });
  }
  next();
});

// 3. Mount API Router tại tiền tố /api kèm Rate Limiter
app.use('/api', globalApiLimiter, apiRouter);

// Endpoint 404 riêng cho /api/* nếu không khớp route nào
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint '${req.method} ${req.originalUrl}' không tồn tại`
  });
});

// 4. Mount Frontend (Vite Dev Middleware trong dev hoặc Static Dist trong production)
const isProduction = process.env.NODE_ENV === 'production';
// Cho phép tắt Vite dev middleware độc lập với NODE_ENV (dùng cho CI):
// CI cần phục vụ bản dist đã build, nhưng vẫn giữ NODE_ENV=test để không
// dính rate limit nghiêm ngặt của production.
const disableViteDev = process.env.DISABLE_VITE_DEV === 'true';
let viteDevServer = null;

if (!isProduction && !disableViteDev) {
  try {
    const { createServer: createViteServer } = await import('vite');
    viteDevServer = await createViteServer({
      root: webDir,
      server: {
        middlewareMode: true,
        server: server
      },
      appType: 'spa'
    });
    app.use(viteDevServer.middlewares);
  } catch (err) {
    console.warn('[Server] Lưu ý: Không thể khởi động Vite middleware, kiểm tra thư mục static:', err.message);
  }
}

// Fallback static files (Production hoặc khi đã build)
if (fs.existsSync(webDistDir)) {
  app.use(express.static(webDistDir));
  app.use((req, res, next) => {
    if (req.originalUrl.startsWith('/api')) return next();
    res.sendFile(path.resolve(webDistDir, 'index.html'));
  });
}

// 5. Global Error Handler
app.use((err, req, res, next) => {
  console.error('[API ERROR]', err);
  // Bắn cảnh báo Telegram ngay lập tức (không chặn luồng phản hồi)
  sendSystemErrorAlert({ error: err, req, source: 'Express Global Error' }).catch(() => {});
  if (res.headersSent) return next(err);
  res.status(500).json({
    success: false,
    error: 'Lỗi máy chủ nội bộ',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 6. Khởi động Server sau khi nạp Database
async function startServer() {
  try {
    await initDB();
    server.listen(PORT, () => {
      console.log(`\n\x1b[1m\x1b[36m╔══════════════════════════════════════════════════════════╗\x1b[0m`);
      console.log(`\x1b[1m\x1b[36m║             🚗 CarMate.vn Unified Server                 ║\x1b[0m`);
      console.log(`\x1b[1m\x1b[36m║      Khởi động DUY NHẤT 1 CỔNG: http://localhost:${PORT}    ║\x1b[0m`);
      console.log(`\x1b[1m\x1b[36m╚══════════════════════════════════════════════════════════╝\x1b[0m`);
      console.log(`\n💻 Web App:      \x1b[32mhttp://localhost:${PORT}\x1b[0m`);
      console.log(`📡 API Engine:   \x1b[34mhttp://localhost:${PORT}/api\x1b[0m`);
      console.log(`🩺 API Health:   \x1b[33mhttp://localhost:${PORT}/api/health\x1b[0m\n`);
    });

    let shuttingDown = false;
    const shutdown = () => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log('\n[CarMate] Đang tắt máy chủ an toàn...');

      // Cưỡng bức thoát nếu còn kết nối treo, tránh container bị kill cứng
      // giữa chừng và bỏ lại WAL chưa gộp.
      const forceExit = setTimeout(() => {
        console.warn('[CarMate] Hết thời gian chờ, buộc thoát.');
        closeDB();
        process.exit(1);
      }, 10000);
      forceExit.unref();

      server.close(() => {
        // Gộp WAL vào file chính TRƯỚC khi thoát, nếu không các giao dịch
        // còn nằm trong carmate.sqlite-wal sẽ mất khi volume bị huỷ.
        closeDB();
        clearTimeout(forceExit);
        console.log('[CarMate] Máy chủ đã dừng, dữ liệu đã được ghi an toàn.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('Không thể khởi động Server:', err);
    process.exit(1);
  }
}

// 7. Vành đai an toàn chống sập (Process Crash Boundary)
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CarMate Safety] Bắt được Unhandled Promise Rejection (Đã cách ly, không sập server):', reason);
  sendSystemErrorAlert({ error: reason, source: 'Node UnhandledRejection' }).catch(() => {});
});

process.on('uncaughtException', async (err) => {
  console.error('[FATAL] Uncaught Exception. Exiting for clean process restart:', err);
  try {
    await sendSystemErrorAlert({ error: err, source: 'Node UncaughtException' });
  } catch {
    // Silent
  }
  process.exit(1);
});

startServer();

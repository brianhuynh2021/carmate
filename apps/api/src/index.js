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
import { startScheduler, stopScheduler } from './services/scheduler.js';
import { initNotificationTables } from './services/notificationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDir = path.resolve(__dirname, '../../web');
const webDistDir = path.resolve(webDir, 'dist');

// Tự động nạp file .env từ thư mục gốc hoặc apps/api (thuận tiện cho dev, không cần nhớ vị trí)
const candidateEnvPaths = [
  path.resolve(__dirname, '../../../.env'), // Thư mục gốc /carmate/.env
  path.resolve(__dirname, '../.env'), // apps/api/.env
  path.resolve(process.cwd(), '.env') // CWD .env
];
for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    try {
      if (typeof process.loadEnvFile === 'function') {
        process.loadEnvFile(envPath);
      }
      // Đảm bảo các biến có giá trị trong file .env luôn được cập nhật nếu trước đó bị rỗng
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let val = (match[2] || '').trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (val && (!process.env[key] || process.env[key].trim() === '')) {
            process.env[key] = val;
          }
        }
      }
    } catch {
      // Bỏ qua nếu lỗi nạp
    }
  }
}

// ── Kiểm tra cấu hình bảo mật bắt buộc trước khi mở cổng (Fail-Closed) ──
// Thà không khởi động còn hơn chạy production với cấu hình thiếu an toàn.
// JWT_SECRET đã được token.js kiểm và ném lỗi khi thiếu; ở đây chốt thêm
// CARMATE_ADMIN_PASSCODE để tránh deploy xong mới phát hiện không vào được
// Cổng Quản Trị (khi thiếu, mọi mật mã đều bị từ chối).
if (process.env.NODE_ENV === 'production') {
  const adminPasscode = process.env.CARMATE_ADMIN_PASSCODE || process.env.ADMIN_SECRET_KEY || '';
  if (adminPasscode.trim() === '') {
    console.error(
      'FATAL SECURITY ERROR: CARMATE_ADMIN_PASSCODE environment variable is missing in production mode!'
    );
    console.error('Cổng Quản Trị sẽ không thể đăng nhập. Hãy cấu hình biến này trước khi khởi động.');
    process.exit(1);
  }
  if (adminPasscode.trim().length < 16) {
    console.error(
      'FATAL SECURITY ERROR: CARMATE_ADMIN_PASSCODE quá ngắn (yêu cầu tối thiểu 16 ký tự trong production)!'
    );
    process.exit(1);
  }
}

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 5173; // Khởi động duy nhất 1 cổng 5173

// Che dấu vết framework: không lộ header "X-Powered-By: Express" (chống fingerprinting)
app.disable('x-powered-by');

// 0. Trust Proxy (Chỉ kích hoạt khi được cấu hình qua biến môi trường TRUST_PROXY)
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// 0.1. Chuẩn hóa tên miền Canonical (Redirect 301 www.carmate.vn -> carmate.vn để khớp 100% với Telegram OAuth)
app.use((req, res, next) => {
  const host = req.headers.host || '';
  if (host.startsWith('www.')) {
    const cleanHost = host.replace(/^www\./, '');
    return res.redirect(301, `https://${cleanHost}${req.originalUrl}`);
  }
  next();
});

// 1. Cấu hình An Ninh & Middleware
app.use(securityHeadersMiddleware);

// CORS Whitelist: Cho phép domain cục bộ, production domains và domain tuỳ biến qua ALLOWED_ORIGINS
const defaultAllowedOrigins = [
  'https://carmate.vn',
  'https://www.carmate.vn',
  'https://ops.carmate.vn',
  'https://admin.carmate.vn',
  'https://carmate.fly.dev'
];
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
      if (/^https:\/\/([a-z0-9-]+\.)*fly\.dev$/.test(origin)) {
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

// Giới hạn gói tin 1MB chống Payload Bomb (Tràn RAM DoS)
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

    // Bảng thông báo & đăng ký đẩy phải sẵn sàng TRƯỚC khi scheduler chạy nhịp
    // đầu tiên, nếu không nhịp t30 sẽ ném lỗi "no such table" ngay giây thứ 60.
    initNotificationTables();

    // NHỊP TIM: đây là thứ biến thuật toán điều vận thành hệ thống thực sự chạy.
    // Tắt được qua DISABLE_SCHEDULER=true cho môi trường kiểm thử và CI.
    startScheduler({ enabled: process.env.DISABLE_SCHEDULER !== 'true' });

    server.listen(PORT, process.env.HOST || undefined, () => {
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
      stopScheduler();

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
process.on('unhandledRejection', (reason) => {
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

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

// Automatically load the .env file from the root directory or apps/api (convenient for dev, no need to remember the location)
const candidateEnvPaths = [
  path.resolve(__dirname, '../../../.env'), // Root directory /carmate/.env
  path.resolve(__dirname, '../.env'), // apps/api/.env
  path.resolve(process.cwd(), '.env') // CWD .env
];
for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    try {
      if (typeof process.loadEnvFile === 'function') {
        process.loadEnvFile(envPath);
      }
      // Make sure variables that have a value in the .env file are always updated if they were previously empty
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
      // Skip if loading fails
    }
  }
}

// ── Check required security configuration before opening the port (Fail-Closed) ──
// Better not to start at all than to run production with an unsafe configuration.
// JWT_SECRET is already checked by token.js, which throws when it is missing; here we additionally lock down
// CARMATE_ADMIN_PASSCODE to avoid finding out only after deploying that the
// Admin Portal cannot be accessed (when it is missing, every password is rejected).
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
const PORT = Number(process.env.PORT) || 5173; // Start on only a single port, 5173

// Hide framework traces: do not expose the "X-Powered-By: Express" header (anti-fingerprinting)
app.disable('x-powered-by');

// 0. Trust Proxy (only enabled when configured via the TRUST_PROXY environment variable)
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// 0.1. Normalize the Canonical domain name (301 redirect www.carmate.vn -> carmate.vn to match 100% with Telegram OAuth)
app.use((req, res, next) => {
  const host = req.headers.host || '';
  if (host.startsWith('www.')) {
    const cleanHost = host.replace(/^www\./, '');
    return res.redirect(301, `https://${cleanHost}${req.originalUrl}`);
  }
  next();
});

// 1. Security Configuration & Middleware
app.use(securityHeadersMiddleware);

// CORS Whitelist: allow local domains, production domains and custom domains via ALLOWED_ORIGINS
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
      // Allow same-origin requests (no origin), curl, mobile apps or local development
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

// Limit the payload to 1MB against a Payload Bomb (RAM-exhaustion DoS)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(sanitizeInput);

// 2. Request Correlation ID & Structured Logging (Observability & easier debugging during review)
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

// 3. Mount the API Router at the /api prefix together with the Rate Limiter
app.use('/api', globalApiLimiter, apiRouter);

// Dedicated 404 endpoint for /api/* if no route matches
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint '${req.method} ${req.originalUrl}' không tồn tại`
  });
});

// 4. Mount the Frontend (Vite Dev Middleware in dev or Static Dist in production)
const isProduction = process.env.NODE_ENV === 'production';
// Allow turning off the Vite dev middleware independently of NODE_ENV (used for CI):
// CI needs to serve the already-built dist, but still keeps NODE_ENV=test so it does not
// hit production's strict rate limit.
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

// Fallback static files (Production or when already built)
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
  // Fire a Telegram alert immediately (does not block the response flow)
  sendSystemErrorAlert({ error: err, req, source: 'Express Global Error' }).catch(() => {});
  if (res.headersSent) return next(err);
  res.status(500).json({
    success: false,
    error: 'Lỗi máy chủ nội bộ',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 6. Start the Server after loading the Database
async function startServer() {
  try {
    await initDB();

    // The notification & push-subscription tables must be ready BEFORE the scheduler runs its
    // first tick, otherwise the t30 tick will throw "no such table" right at the 60th second.
    initNotificationTables();

    // HEARTBEAT: this is what turns the dispatch algorithm into a system that really runs.
    // Can be turned off via DISABLE_SCHEDULER=true for test environments and CI.
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

      // Force exit if hanging connections remain, to avoid the container being hard-killed
      // midway and leaving an un-merged WAL behind.
      const forceExit = setTimeout(() => {
        console.warn('[CarMate] Hết thời gian chờ, buộc thoát.');
        closeDB();
        process.exit(1);
      }, 10000);
      forceExit.unref();

      server.close(() => {
        // Merge the WAL into the main file BEFORE exiting, otherwise transactions
        // still sitting in carmate.sqlite-wal will be lost when the volume is destroyed.
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

// 7. Process Crash Boundary (safety perimeter against crashes)
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

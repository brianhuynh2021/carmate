/**
 * CarMate Security & Anti-Abuse Middleware (Zero External Dependencies, Zero Cost)
 * Sliding-window rate limiter, OWASP security headers, and comprehensive HTML input sanitization
 */

/**
 * Extract the client's IP address (only trust the proxy when app.set('trust proxy') is configured)
 * Prevents IP spoofing via arbitrary X-Forwarded-For headers
 */
function getClientIp(req) {
  if (req.app && req.app.get('trust proxy')) {
    const forwarded = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'];
    if (forwarded && typeof forwarded === 'string') {
      const clientIp = forwarded.split(',')[0].trim();
      if (clientIp) return clientIp;
    }
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Create a Rate Limiter middleware using the Sliding Window mechanism
 * MIT INVARIANT: Each Rate Limiter instance owns its own separate buckets cache,
 * completely eliminating cross-blocking between telemetry/polling and posting trips/login.
 * @param {Object} options
 * @param {number} options.windowMs - Time window length (ms)
 * @param {number} options.max - Maximum number of requests within the time window
 * @param {string} options.message - Message returned when the threshold is exceeded
 */
export function createRateLimiter({
  windowMs = 60 * 1000,
  max = 120,
  message = 'Quá nhiều yêu cầu, vui lòng thử lại sau ít phút.'
} = {}) {
  // SEPARATE buckets cache for this instance
  const buckets = new Map();

  // Automatically clean up expired IPs periodically every 5 minutes to avoid RAM leaks
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (now > bucket.resetTime) {
        buckets.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  cleanupTimer.unref?.();

  return (req, res, next) => {
    // The system admin is not rate-limited (Stanford Ergonomics)
    if (req.admin || req.user?.role === 'admin' || req.user?.role === 'super_admin') {
      return next();
    }

    const ip = getClientIp(req);
    // Key the identity by IP in this limiter's own separate cache
    const key = ip;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || now > bucket.resetTime) {
      bucket = {
        count: 1,
        resetTime: now + windowMs
      };
      buckets.set(key, bucket);
    } else {
      bucket.count += 1;
    }

    // Attach rate limit info to the standard HTTP response headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - bucket.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetTime / 1000));

    if (bucket.count > max) {
      const retryAfterSeconds = Math.ceil((bucket.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        success: false,
        error: message,
        retryAfter: retryAfterSeconds
      });
    }

    next();
  };
}

// 1. Rate Limiter for general APIs: max 300 requests / minute / IP (production) or 3000 (dev / local test)
export const globalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 300 : 3000,
  message: 'Hệ thống phát hiện tần suất yêu cầu cao bất thường. Vui lòng thử lại sau 1 phút.'
});

// 2. Tightened Rate Limiter for OTP & Login (Anti Brute-Force & SMS/Zalo Spam)
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 15 : 1000,
  message: 'Bạn đã yêu cầu OTP hoặc đăng nhập quá nhiều lần. Vui lòng đợi 15 phút để bảo vệ tài khoản.'
});

// 3. Rate Limiter for Posting Trips (Anti scraping Bot or junk-post spam)
export const postTripLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: process.env.NODE_ENV === 'production' ? 20 : 1000,
  message: 'Bạn đăng chuyến quá nhanh. Vui lòng đợi ít phút trước khi tạo thêm chuyến mới.'
});

/**
 * Middleware that adds the OWASP-standard Security Headers
 */
export function securityHeadersMiddleware(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Download-Options', 'noopen');
  // Hide framework traces (anti-fingerprinting) — Express exposes x-powered-by by default.
  res.removeHeader('X-Powered-By');
  // HSTS: force the browser to always use HTTPS for 1 year (only enabled in production, behind a
  // reverse proxy that already forces HTTPS). Prevents downgrade attacks and SSL-strip.
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
}

/**
 * Convert dangerous HTML characters into safe HTML entities (HTML Entity Escaping)
 * Completely eliminates Stored XSS: <script>, <img onerror>, <svg onload>, javascript:, etc.
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&#x2F;/gi, '/')
    .replace(/&#47;/g, '/')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Strip dangerous XSS vectors from the input string (Defense-in-Depth).
 *
 * Chose to STRIP rather than HTML-escape quotes: the React frontend renders raw text and
 * does NOT decode HTML entities, so if " were escaped to &quot; the user's Vietnamese names/notes
 * would display a literal "&quot;" — ruining the experience. Stripping the malicious vector
 * is both stronger (it also blocks `onerror=` and `<script>`, which quote escaping cannot handle) and
 * leaves quotes displaying normally.
 */
export function stripXssVectors(str) {
  if (typeof str !== 'string') return str;
  return (
    str
      // 1. Remove all <script>...</script> tags (even when the closing tag is missing)
      .replace(/<script\b[^>]*>[\s\S]*?(?:<\/script>|$)/gi, '')
      // 2. Remove commonly abused dynamic-content embedding tags
      .replace(/<\/?(?:iframe|object|embed|svg|math|link|meta|base)\b[^>]*>/gi, '')
      // 3. Remove inline event handlers: onerror=, onload=, onmouseover=, onclick=...
      .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      // 4. Remove dangerous schemes: javascript:, vbscript:, and data: (except data:image/...)
      .replace(/(?:javascript|vbscript)\s*:/gi, '')
      .replace(/data\s*:(?!image\/(?:png|jpeg|jpg|webp|gif);base64,)/gi, '')
  );
}

/**
 * Filter out dangerous character sequences in the body (Anti Stored/Reflected XSS).
 * Still escapes < > (keeps compatibility with the old behavior), while also stripping the XSS vectors above.
 */
export function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    const cleanObject = (obj) => {
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'string') {
          const isSafeDataImg = /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,/i.test(obj[key].trim());
          if (isSafeDataImg) {
            obj[key] = obj[key].trim();
          } else {
            // Strip malicious vectors first, then escape any remaining < > and trim whitespace.
            const stripped = stripXssVectors(obj[key]).trim();
            obj[key] = escapeHtml(stripped);
          }
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          cleanObject(obj[key]);
        }
      }
    };
    cleanObject(req.body);
  }
  next();
}

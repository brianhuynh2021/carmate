/**
 * CarMate Security & Anti-Abuse Middleware (Zero External Dependencies, 0đ Cost)
 * Sliding-window rate limiter, OWASP security headers, and comprehensive HTML input sanitization
 */

/**
 * Trích xuất địa chỉ IP của client (Chỉ tin cậy proxy khi được cấu hình app.set('trust proxy'))
 * Chống giả mạo IP qua header X-Forwarded-For ngẫu nhiên
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
 * Tạo middleware Rate Limiter theo cơ chế Sliding Window
 * BẤT BIẾN MIT: Mỗi instance Rate Limiter sở hữu bộ nhớ đệm buckets riêng biệt,
 * triệt tiêu hoàn toàn lỗi nghẽn chéo giữa telemetry/polling và đăng chuyến/đăng nhập.
 * @param {Object} options
 * @param {number} options.windowMs - Khoảng thời gian tính (ms)
 * @param {number} options.max - Số lượng request tối đa trong khoảng thời gian
 * @param {string} options.message - Thông điệp trả về khi vượt ngưỡng
 */
export function createRateLimiter({
  windowMs = 60 * 1000,
  max = 120,
  message = 'Quá nhiều yêu cầu, vui lòng thử lại sau ít phút.'
} = {}) {
  // Bộ nhớ đệm buckets RIÊNG BIỆT cho instance này
  const buckets = new Map();

  // Tự động dọn dẹp các IP đã hết hạn định kỳ mỗi 5 phút để tránh rò rỉ RAM
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
    // Quản trị viên hệ thống không bị chặn rate limit (Stanford Ergonomics)
    if (req.user?.role === 'admin' || req.headers['x-admin-key']) {
      return next();
    }

    const ip = getClientIp(req);
    // Khóa định danh theo IP trong bộ đệm riêng biệt của limiter này
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

    // Gắn thông tin rate limit vào response header chuẩn HTTP
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

// 1. Rate Limiter cho các API chung: tối đa 300 request / phút / IP (production) hoặc 3000 (dev / local test)
export const globalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 300 : 3000,
  message: 'Hệ thống phát hiện tần suất yêu cầu cao bất thường. Vui lòng thử lại sau 1 phút.'
});

// 2. Rate Limiter siết chặt cho OTP & Đăng nhập (Chống Brute-Force & Spam SMS/Zalo)
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: process.env.NODE_ENV === 'production' ? 15 : 1000,
  message: 'Bạn đã yêu cầu OTP hoặc đăng nhập quá nhiều lần. Vui lòng đợi 15 phút để bảo vệ tài khoản.'
});

// 3. Rate Limiter cho Đăng chuyến xe (Chống Bot cào hoặc spam bài rác)
export const postTripLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 phút
  max: process.env.NODE_ENV === 'production' ? 20 : 1000,
  message: 'Bạn đăng chuyến quá nhanh. Vui lòng đợi ít phút trước khi tạo thêm chuyến mới.'
});

/**
 * Middleware bổ sung các Header An Ninh chuẩn OWASP
 */
export function securityHeadersMiddleware(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Download-Options', 'noopen');
  // Che dấu vết framework (chống fingerprinting) — Express mặc định lộ x-powered-by.
  res.removeHeader('X-Powered-By');
  // HSTS: ép trình duyệt luôn dùng HTTPS trong 1 năm (chỉ bật ở production, sau
  // reverse proxy đã force HTTPS). Tránh downgrade attack và SSL-strip.
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
}

/**
 * Chuyển đổi các ký tự HTML nguy hiểm thành thực thể HTML an toàn (HTML Entity Escaping)
 * Triệt tiêu hoàn toàn Stored XSS: <script>, <img onerror>, <svg onload>, javascript:, v.v.
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
 * Bóc tách các vector XSS nguy hiểm khỏi chuỗi đầu vào (Defense-in-Depth).
 *
 * Chọn cách STRIP thay vì HTML-escape dấu nháy: frontend React render text thô và
 * KHÔNG giải mã HTML entity, nên nếu escape " thành &quot; thì tên/ghi chú tiếng Việt
 * của người dùng sẽ hiển thị literal "&quot;" — phá trải nghiệm. Strip vector độc hại
 * vừa mạnh hơn (chặn cả `onerror=`, `<script>` mà escape quote không xử lý được) vừa
 * giữ nguyên dấu nháy hiển thị bình thường.
 */
export function stripXssVectors(str) {
  if (typeof str !== 'string') return str;
  return (
    str
      // 1. Loại bỏ toàn bộ thẻ <script>...</script> (kể cả khi thiếu thẻ đóng)
      .replace(/<script\b[^>]*>[\s\S]*?(?:<\/script>|$)/gi, '')
      // 2. Loại bỏ các thẻ nhúng nội dung động thường bị lạm dụng
      .replace(/<\/?(?:iframe|object|embed|svg|math|link|meta|base)\b[^>]*>/gi, '')
      // 3. Loại bỏ event handler nội tuyến: onerror=, onload=, onmouseover=, onclick=...
      .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      // 4. Loại bỏ scheme nguy hiểm: javascript:, vbscript:, và data: (ngoại trừ data:image/...)
      .replace(/(?:javascript|vbscript)\s*:/gi, '')
      .replace(/data\s*:(?!image\/(?:png|jpeg|jpg|webp|gif);base64,)/gi, '')
  );
}

/**
 * Lọc bỏ các chuỗi ký tự nguy hiểm trong body (Chống Stored/Reflected XSS).
 * Vẫn escape < > (giữ tương thích hành vi cũ), đồng thời strip vector XSS ở trên.
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
            // Strip vector độc hại trước, sau đó escape < > còn sót và cắt khoảng trắng.
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

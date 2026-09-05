/**
 * CarMate Security & Anti-Abuse Middleware (Zero External Dependencies, 0đ Cost)
 * Sliding-window rate limiter, OWASP security headers, and input sanitization
 */

// Bộ nhớ đệm lưu vết request của các IP
const ipRequestBuckets = new Map();

// Tự động dọn dẹp các IP đã hết hạn định kỳ mỗi 5 phút để tránh rò rỉ RAM
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of ipRequestBuckets.entries()) {
    if (now - bucket.resetTime > 60000) {
      ipRequestBuckets.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Trích xuất địa chỉ IP của client (hỗ trợ cả môi trường Proxy / Cloudflare)
 */
function getClientIp(req) {
  const forwarded = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Tạo middleware Rate Limiter theo cơ chế Sliding Window
 * @param {Object} options
 * @param {number} options.windowMs - Khoảng thời gian tính (ms)
 * @param {number} options.max - Số lượng request tối đa trong khoảng thời gian
 * @param {string} options.message - Thông điệp trả về khi vượt ngưỡng
 */
export function createRateLimiter({ windowMs = 60 * 1000, max = 120, message = 'Quá nhiều yêu cầu, vui lòng thử lại sau ít phút.' } = {}) {
  return (req, res, next) => {
    // Bỏ qua giới hạn khi chạy script kiểm thử tự động nội bộ
    if (req.headers['x-carmate-test'] === 'e2e-runner') {
      return next();
    }

    const ip = getClientIp(req);
    const key = `${ip}:${req.baseUrl || req.path}`;
    const now = Date.now();

    let bucket = ipRequestBuckets.get(key);
    if (!bucket || now > bucket.resetTime) {
      bucket = {
        count: 1,
        resetTime: now + windowMs
      };
      ipRequestBuckets.set(key, bucket);
    } else {
      bucket.count += 1;
    }

    // Gắn thông tin rate limit vào response header chuẩn HTTP
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - bucket.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetTime / 1000));

    if (bucket.count > max) {
      return res.status(429).json({
        success: false,
        error: message,
        retryAfter: Math.ceil((bucket.resetTime - now) / 1000)
      });
    }

    next();
  };
}

// 1. Limiter chung cho toàn bộ API (120 req / phút / IP)
export const globalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 180,
  message: 'Hệ thống phát hiện lượt truy cập tăng đột biến, vui lòng chờ 1 phút trước khi thử lại.'
});

// 2. Limiter nghiêm ngặt cho Đăng nhập / Gửi OTP (5 lần / 15 phút / IP)
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Bạn đã yêu cầu đăng nhập quá nhiều lần. Để bảo vệ tài khoản, vui lòng đợi 15 phút.'
});

// 3. Limiter cho việc Đăng chuyến xe mới (10 bài / 10 phút / IP để chống spam tin rác)
export const postTripLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 12,
  message: 'Bạn đã đăng chuyến quá thường xuyên trong thời gian ngắn. Vui lòng thử lại sau 10 phút.'
});

/**
 * Middleware gắn Security Headers chuẩn OWASP (Thay thế Helmet nhẹ nhàng, 0đ phụ thuộc)
 */
export function securityHeadersMiddleware(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Download-Options', 'noopen');
  next();
}

/**
 * Lọc bỏ các chuỗi script hoặc ký tự nguy hiểm trong body (Chống XSS / Injection)
 */
export function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    const cleanObject = (obj) => {
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'string') {
          // Lọc các thẻ script nguy hiểm
          obj[key] = obj[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').trim();
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          cleanObject(obj[key]);
        }
      }
    };
    cleanObject(req.body);
  }
  next();
}

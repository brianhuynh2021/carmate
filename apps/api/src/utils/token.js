import jwt from 'jsonwebtoken';
import crypto from 'crypto';

let resolvedJwtSecret = process.env.JWT_SECRET;
if (!resolvedJwtSecret || resolvedJwtSecret.trim() === '') {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is missing in production mode!');
  }
  // Môi trường dev/test: Tự động sinh chuỗi bí mật ngẫu nhiên 256-bit an toàn
  resolvedJwtSecret = crypto.randomBytes(32).toString('hex');
  console.warn('[Security Notice] JWT_SECRET chưa được cấu hình. Đã tạo secret ngẫu nhiên cho phiên dev.');
}

export const JWT_SECRET = resolvedJwtSecret;
export function getJwtSecret() {
  return JWT_SECRET;
}
const TOKEN_EXPIRY = '7d';

/**
 * Sinh mã JWT Token bảo mật phiên đăng nhập
 */
export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Kiểm tra và giải mã JWT Token
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'carmate_super_secure_jwt_secret_key_2026';
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

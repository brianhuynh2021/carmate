import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

let resolvedJwtSecret = process.env.JWT_SECRET;
if (!resolvedJwtSecret || resolvedJwtSecret.trim() === '') {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is missing in production mode!');
  }
  // Môi trường dev/test: Lưu secret vào file để tránh mất phiên đăng nhập khi nodemon reload
  const secretPath = path.resolve(process.cwd(), 'apps/api/data/.dev_jwt_secret');
  try {
    if (fs.existsSync(secretPath)) {
      resolvedJwtSecret = fs.readFileSync(secretPath, 'utf8').trim();
    } else {
      resolvedJwtSecret = crypto.randomBytes(32).toString('hex');
      try {
        fs.mkdirSync(path.dirname(secretPath), { recursive: true });
        fs.writeFileSync(secretPath, resolvedJwtSecret, 'utf8');
      } catch {}
    }
  } catch {
    resolvedJwtSecret = 'carmate_dev_secret_key_2026_safe_fallback';
  }
}

export const JWT_SECRET = resolvedJwtSecret;
export function getJwtSecret() {
  return JWT_SECRET;
}
const TOKEN_EXPIRY = '90d';

/**
 * Sinh mã JWT Token bảo mật phiên đăng nhập
 */
export function generateToken(payload) {
  const normalizedPayload = {
    ...payload,
    id: payload.id || payload.userId,
    userId: payload.userId || payload.id
  };
  return jwt.sign(normalizedPayload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Kiểm tra và giải mã JWT Token
 */
export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded && typeof decoded === 'object') {
      if (decoded.userId && !decoded.id) decoded.id = decoded.userId;
      if (decoded.id && !decoded.userId) decoded.userId = decoded.id;
    }
    return decoded;
  } catch {
    return null;
  }
}

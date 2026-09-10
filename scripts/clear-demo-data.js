/**
 * CarMate — Xoá Sạch Dữ Liệu Mẫu (Clear Demo / Sample Data)
 *
 * Dọn sạch các chuyến đi và đơn đặt xe mẫu trong cả SQLite và JSON,
 * đưa sàn giao dịch về trạng thái "Sàn Đang Chờ Chuyến Đầu Tiên".
 *
 * Bảo toàn tài khoản Quản trị viên (Admin) theo luật bất biến MIT.
 *
 * Cách chạy:
 *   node scripts/clear-demo-data.js
 *   hoặc: npm run db:clear
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../apps/api/data');
const DB_PATH = path.join(DATA_DIR, 'carmate.sqlite');
const JSON_PATH = path.join(DATA_DIR, 'carmate_db.json');

console.log('🧹 BẮT ĐẦU DỌN DẸP DỮ LIỆU MẪU CARMATE...\n');

if (fs.existsSync(DB_PATH)) {
  const db = new Database(DB_PATH);

  // 1. Xóa toàn bộ chuyến đi mẫu
  const tripResult = db.prepare('DELETE FROM trips').run();
  console.log(`✅ Đã xóa ${tripResult.changes} chuyến đi mẫu trong SQLite.`);

  // 2. Xóa toàn bộ đơn đặt xe mẫu
  const bookingResult = db.prepare('DELETE FROM bookings').run();
  console.log(`✅ Đã xóa ${bookingResult.changes} đơn đặt xe / ghép chỗ trong SQLite.`);

  // 3. Xóa các báo cáo sự cố mẫu nếu có
  try {
    const reportResult = db.prepare('DELETE FROM reports').run();
    console.log(`✅ Đã xóa ${reportResult.changes} báo cáo sự cố mẫu.`);
  } catch {
    // Bỏ qua nếu bảng chưa tạo
  }

  // 4. Giữ lại tài khoản Admin, bảo toàn tài khoản Google thật
  try {
    const userResult = db
      .prepare(
        "DELETE FROM users WHERE role != 'admin' AND phone != '0984883750' AND id NOT LIKE 'USR-GG-%'"
      )
      .run();
    console.log(`✅ Đã dọn dẹp ${userResult.changes} người dùng mẫu (Bảo toàn Admin & tài khoản Google thật).`);
  } catch (err) {
    console.warn('Lưu ý dọn user:', err.message);
  }

  // 5. Xóa toàn bộ sự kiện phân tích, phễu chuyển đổi & nhật ký AI
  try {
    const trajResult = db.prepare('DELETE FROM ai_trajectories').run();
    console.log(`✅ Đã xóa ${trajResult.changes} nhật ký quỹ đạo AI (ai_trajectories).`);
  } catch {}

  try {
    const analyticsResult = db.prepare('DELETE FROM analytics_events').run();
    console.log(`✅ Đã xóa ${analyticsResult.changes} sự kiện phân tích (analytics_events).`);
  } catch {}

  try {
    const supportResult = db.prepare('DELETE FROM support_messages').run();
    console.log(`✅ Đã xóa ${supportResult.changes} tin nhắn hỗ trợ CSKH.`);
  } catch {}

  db.close();
}

// 5. Cập nhật file JSON đồng bộ rỗng
if (fs.existsSync(JSON_PATH)) {
  const cleanJson = {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    stats: {
      members: 1,
      tripsCompleted: 0,
      routes: 0,
      avgRating: 5.0
    },
    driverOffers: [],
    passengerRequests: [],
    bookings: []
  };
  fs.writeFileSync(JSON_PATH, JSON.stringify(cleanJson, null, 2), 'utf-8');
  console.log('✅ Đã đồng bộ file carmate_db.json về trạng thái rỗng.');
}

console.log('\n🎉 ĐÃ XOÁ SẠCH DỮ LIỆU MẪU THÀNH CÔNG!');
console.log('👉 Sàn giao dịch bây giờ là sàn thật 100%, sẵn sàng cho các bài đăng thực tế.');
console.log('💡 Mẹo: Nếu muốn nạp lại dữ liệu mẫu để test tính năng bất cứ lúc nào, chạy:');
console.log('   node scripts/seed-local-data.js\n');

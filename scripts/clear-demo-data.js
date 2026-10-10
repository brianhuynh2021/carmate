/**
 * CarMate — Clear Demo / Sample Data
 *
 * Wipes the sample trips and sample bookings from both SQLite and JSON,
 * returning the marketplace to the "Sàn Đang Chờ Chuyến Đầu Tiên" ("marketplace awaiting its
 * first trip") state.
 *
 * Preserves the Admin account under the MIT invariant rule.
 *
 * How to run:
 *   node scripts/clear-demo-data.js
 *   or: npm run db:clear
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { VERIFIED_HOTLINES } from '@carmate/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../apps/api/data');
const DB_PATH = path.join(DATA_DIR, 'carmate.sqlite');
const JSON_PATH = path.join(DATA_DIR, 'carmate_db.json');

console.log('🧹 BẮT ĐẦU DỌN DẸP DỮ LIỆU MẪU CARMATE...\n');

if (fs.existsSync(DB_PATH)) {
  const db = new Database(DB_PATH);

  // 1. Delete all sample trips
  const tripResult = db.prepare('DELETE FROM trips').run();
  console.log(`✅ Đã xóa ${tripResult.changes} chuyến đi mẫu trong SQLite.`);

  // 2. Delete all sample bookings
  const bookingResult = db.prepare('DELETE FROM bookings').run();
  console.log(`✅ Đã xóa ${bookingResult.changes} đơn đặt xe / ghép chỗ trong SQLite.`);

  // 3. Delete all ride-pooling intents (intents)
  try {
    const intentResult = db.prepare('DELETE FROM intents').run();
    console.log(`✅ Đã xóa ${intentResult.changes} ý định gom xe (intents).`);
  } catch (e) {
    console.warn('Lưu ý dọn intents:', e.message);
  }

  // 4. Delete all virtual pickup-station requests (station_requests)
  try {
    const stationResult = db.prepare('DELETE FROM station_requests').run();
    console.log(`✅ Đã xóa ${stationResult.changes} vé trạm đón ảo (station_requests).`);
  } catch (e) {
    console.warn('Lưu ý dọn station_requests:', e.message);
  }

  // 5. Delete sample incident reports, if any
  try {
    const reportResult = db.prepare('DELETE FROM trip_incidents').run();
    console.log(`✅ Đã xóa ${reportResult.changes} báo cáo sự cố (trip_incidents).`);
  } catch {}

  try {
    const legacyReportResult = db.prepare('DELETE FROM reports').run();
    console.log(`✅ Đã xóa ${legacyReportResult.changes} báo cáo sự cố mẫu (reports).`);
  } catch {}

  // 6. Delete batch-matching cycles & seat-swap orders
  try {
    const epochResult = db.prepare('DELETE FROM matching_epochs').run();
    console.log(`✅ Đã xóa ${epochResult.changes} chu kỳ gom khớp (matching_epochs).`);
  } catch {}

  try {
    const exchangeResult = db.prepare('DELETE FROM seat_exchange_orders').run();
    console.log(`✅ Đã xóa ${exchangeResult.changes} lệnh hoán đổi ghế (seat_exchange_orders).`);
  } catch {}

  // 7. Keep the Admin account, preserve real Google accounts
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

  // 8. Delete all analytics events, conversion funnels & AI logs
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

  // 9. Preserve and sync the verified bus-operator directory (Verified Transit Directory)
  try {
    const existing = db.prepare('SELECT value FROM key_values WHERE key = ?').get('transit_directory');
    const existingList = existing ? JSON.parse(existing.value) : [];
    if (!Array.isArray(existingList) || existingList.length === 0) {
      db.prepare("INSERT OR REPLACE INTO key_values (key, value) VALUES ('transit_directory', ?)").run(
        JSON.stringify(VERIFIED_HOTLINES)
      );
      console.log(`✅ Đã bảo toàn & nạp danh bạ ${VERIFIED_HOTLINES.length} nhà xe QL13 kiểm chứng.`);
    } else {
      console.log(`✅ Đã bảo toàn ${existingList.length} nhà xe hiện có trong danh bạ hệ thống.`);
    }
  } catch (e) {
    console.warn('Lưu ý bảo toàn danh bạ nhà xe:', e.message);
  }

  db.close();
}

// 10. Update the empty sync JSON file (preserving the admin account)
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
    bookings: [],
    users: [
      {
        id: 'USR-0984883750',
        phone: '0984883750',
        name: 'Nguyễn Thành Huỳnh',
        role: 'admin',
        avatar: '',
        trustScore: 99,
        safeTripsCount: 0,
        provider: 'zalo',
        isCccdVerified: 1,
        isGplxVerified: 1,
        isBanned: 0,
        createdAt: '2026-09-01T08:00:00.000Z',
        updatedAt: new Date().toISOString(),
        email: 'huynh.nguyen@carmate.vn'
      }
    ]
  };
  fs.writeFileSync(JSON_PATH, JSON.stringify(cleanJson, null, 2), 'utf-8');
  console.log('✅ Đã đồng bộ file carmate_db.json về trạng thái rỗng chuẩn.');
}

console.log('\n🎉 ĐÃ XOÁ SẠCH DỮ LIỆU MẪU THÀNH CÔNG!');
console.log('👉 Sàn giao dịch bây giờ là sàn thật 100%, sẵn sàng cho các bài đăng thực tế.');
console.log('💡 Mẹo: Nếu muốn nạp lại dữ liệu mẫu để test tính năng bất cứ lúc nào, chạy:');
console.log('   node scripts/seed-local-data.js\n');

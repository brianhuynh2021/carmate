import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { isAdminPhone, getPrimaryAdminPhone } from '../utils/adminIdentity.js';
import {
  INITIAL_DRIVER_OFFERS,
  INITIAL_PASSENGER_REQUESTS,
  INITIAL_BOOKED_ESCROWS,
  SITE_INFO,
  cleanPhoneNumber,
  normalizePhoneNumber,
  isTripExpired,
  getTomorrowISO,
  DEFAULT_TRUST_RULES,
  sanitizeTimeLabel
} from '@carmate/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'carmate.sqlite');
const LEGACY_JSON_FILE = path.join(DATA_DIR, 'carmate_db.json');

let db = null;

/**
 * Khởi tạo Database SQLite với WAL Mode (Write-Ahead Logging)
 * Chuẩn Production: Chịu tải hàng ngàn truy vấn đồng thời, an toàn tuyệt đối, không lock file.
 */
export async function initDB() {
  if (db) return db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);

  // Kích hoạt WAL Mode & Tối ưu hiệu năng
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  // Gộp WAL về file chính sau mỗi ~1000 trang (~4MB) để WAL không phình vô hạn.
  // Không có mốc này, carmate.sqlite-wal có thể lớn hơn cả DB chính.
  db.pragma('wal_autocheckpoint = 1000');
  db.pragma('cache_size = -64000'); // 64MB cache
  db.pragma('foreign_keys = ON');

  // 1. Tạo bảng Chuyến Đi (trips)
  db.exec(`
    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      maskedCode TEXT,
      phoneReal TEXT,
      userId TEXT,
      fromLocation TEXT,
      toLocation TEXT,
      routeCategory TEXT,
      direction TEXT,
      timeSlot TEXT,
      date TEXT,
      price REAL,
      seats INTEGER,
      carCategory TEXT,
      carType TEXT,
      isHidden INTEGER DEFAULT 0,
      isBanned INTEGER DEFAULT 0,
      createdAt INTEGER,
      payload TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_trips_type ON trips(type);
    CREATE INDEX IF NOT EXISTS idx_trips_phone ON trips(phoneReal);
    CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
    CREATE INDEX IF NOT EXISTS idx_trips_hidden ON trips(isHidden);
  `);

  // 2. Tạo bảng Thành Viên (users)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone TEXT UNIQUE,
      email TEXT,
      name TEXT,
      role TEXT DEFAULT 'driver',
      avatar TEXT,
      trustScore INTEGER DEFAULT 98,
      isCccdVerified INTEGER DEFAULT 1,
      isGplxVerified INTEGER DEFAULT 1,
      isBanned INTEGER DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT,
      payload TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
  `);

  // Migration an toàn cho database hiện hữu nếu chưa có cột email
  try {
    const userColumns = db.pragma('table_info(users)').map((col) => col.name);
    if (!userColumns.includes('email')) {
      db.exec('ALTER TABLE users ADD COLUMN email TEXT');
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
  } catch {
    // Bỏ qua nếu đã tồn tại hoặc đang chạy trong transaction
  }

  // 3. Tạo bảng Ghép & Đặt Chuyến (bookings)
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      escrowId TEXT PRIMARY KEY,
      tripId TEXT,
      passengerPhone TEXT,
      status TEXT DEFAULT 'zalo_active',
      createdAt INTEGER,
      payload TEXT
    );
      CREATE INDEX IF NOT EXISTS idx_bookings_trip ON bookings(tripId);
    `);

    // Migration bổ sung các cột Cấp độ 3 cho bookings nếu chưa có
    try {
      const bookingCols = db.pragma('table_info(bookings)').map((c) => c.name);
      if (!bookingCols.includes('standbyOfferId')) {
        db.exec('ALTER TABLE bookings ADD COLUMN standbyOfferId TEXT');
      }
      if (!bookingCols.includes('doorstepPickup')) {
        db.exec('ALTER TABLE bookings ADD COLUMN doorstepPickup INTEGER DEFAULT 0');
      }
      if (!bookingCols.includes('doorstepAddress')) {
        db.exec('ALTER TABLE bookings ADD COLUMN doorstepAddress TEXT');
      }
      if (!bookingCols.includes('penaltyTier')) {
        db.exec("ALTER TABLE bookings ADD COLUMN penaltyTier TEXT DEFAULT 'none'");
      }
      if (!bookingCols.includes('penaltyPoints')) {
        db.exec('ALTER TABLE bookings ADD COLUMN penaltyPoints INTEGER DEFAULT 0');
      }
      if (!bookingCols.includes('cancelledAt')) {
        db.exec('ALTER TABLE bookings ADD COLUMN cancelledAt INTEGER');
      }
      if (!bookingCols.includes('cancellationReason')) {
        db.exec('ALTER TABLE bookings ADD COLUMN cancellationReason TEXT');
      }
    } catch {
      // Bỏ qua nếu đã tồn tại
    }

    // 4. Bảng Siêu dữ liệu & Cấu hình (key_values)
    db.exec(`
      CREATE TABLE IF NOT EXISTS key_values (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // 5. Bảng Lưu Trữ Quỹ Đạo AI (ai_trajectories - MIT & Stanford Observability)
    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_trajectories (
        id TEXT PRIMARY KEY,
        userGoal TEXT,
        requestedRoute TEXT,
        reasoningSteps TEXT,
        suggestionsCount INTEGER DEFAULT 0,
        executionTimeMs INTEGER DEFAULT 0,
        unmetDemand INTEGER DEFAULT 0,
        createdAt INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_ai_traj_created ON ai_trajectories(createdAt);
      CREATE INDEX IF NOT EXISTS idx_ai_traj_unmet ON ai_trajectories(unmetDemand);
    `);

    // 6. Bảng Phân Tích Hành Vi & Funnel (analytics_events)
    db.exec(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY,
        event_name TEXT NOT NULL,
        properties TEXT,
        user_id TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_analytics_event_name ON analytics_events(event_name);
      CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at);
    `);

    // 7. Bảng Trò Chuyện & Khiếu Nại Với Platform CSKH (support_messages)
    db.exec(`
      CREATE TABLE IF NOT EXISTS support_messages (
        id TEXT PRIMARY KEY,
        bookingId TEXT,
        userId TEXT,
        phone TEXT,
        senderRole TEXT NOT NULL,
        senderName TEXT,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'support',
        status TEXT DEFAULT 'open',
        createdAt INTEGER NOT NULL,
        metadata TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_support_booking ON support_messages(bookingId);
      CREATE INDEX IF NOT EXISTS idx_support_user ON support_messages(userId);
      CREATE INDEX IF NOT EXISTS idx_support_phone ON support_messages(phone);
      CREATE INDEX IF NOT EXISTS idx_support_created ON support_messages(createdAt);
    `);

    // 8. Bảng Yêu Cầu Xóa Tài Khoản Gửi Tới Quản Trị Viên (account_deletion_requests)
    db.exec(`
      CREATE TABLE IF NOT EXISTS account_deletion_requests (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        phone TEXT,
        name TEXT,
        email TEXT,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        createdAt INTEGER NOT NULL,
        processedAt INTEGER,
        processedBy TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_del_req_user ON account_deletion_requests(userId);
      CREATE INDEX IF NOT EXISTS idx_del_req_phone ON account_deletion_requests(phone);
      CREATE INDEX IF NOT EXISTS idx_del_req_status ON account_deletion_requests(status);
      CREATE INDEX IF NOT EXISTS idx_del_req_created ON account_deletion_requests(createdAt);
    `);

    // 9. Bảng Khai Báo Ý Định Di Chuyển (intents - Zero-Search Autonomous Engine)
    db.exec(`
      CREATE TABLE IF NOT EXISTS intents (
        id TEXT PRIMARY KEY,
        userId TEXT,
        role TEXT NOT NULL,
        originHubId TEXT,
        originName TEXT,
        destinationHubId TEXT,
        destinationName TEXT,
        corridor TEXT,
        date TEXT,
        timeSlot TEXT,
        seats INTEGER DEFAULT 1,
        isDoorstep INTEGER DEFAULT 0,
        doorstepAddress TEXT,
        doorstepLat REAL,
        doorstepLng REAL,
        phone TEXT,
        contactName TEXT,
        status TEXT DEFAULT 'pending',
        matchedTripId TEXT,
        matchedBookingId TEXT,
        createdAt INTEGER,
        payload TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_intents_status ON intents(status);
      CREATE INDEX IF NOT EXISTS idx_intents_corridor ON intents(corridor);
      CREATE INDEX IF NOT EXISTS idx_intents_date ON intents(date);
      CREATE INDEX IF NOT EXISTS idx_intents_role ON intents(role);
    `);

    // 10. Bảng Lưu Trữ Phiên Khớp Lệnh (matching_epochs)
    db.exec(`
      CREATE TABLE IF NOT EXISTS matching_epochs (
        id TEXT PRIMARY KEY,
        epochType TEXT NOT NULL,
        corridor TEXT,
        matchedCount INTEGER DEFAULT 0,
        driverCount INTEGER DEFAULT 0,
        passengerCount INTEGER DEFAULT 0,
        createdAt INTEGER,
        summary TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_epochs_created ON matching_epochs(createdAt);
    `);

    // 11. Bảng Gom Yêu Cầu Mở Trạm Ảo Mới (station_requests - Hard Whitelist & Zero Roadside Stops)
    db.exec(`
      CREATE TABLE IF NOT EXISTS station_requests (
        id TEXT PRIMARY KEY,
        stationName TEXT NOT NULL,
        normalizedName TEXT NOT NULL,
        note TEXT,
        lat REAL,
        lng REAL,
        userPhone TEXT,
        requestCount INTEGER DEFAULT 1,
        status TEXT DEFAULT 'pending',
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        payload TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_stn_req_norm ON station_requests(normalizedName);
      CREATE INDEX IF NOT EXISTS idx_stn_req_phone ON station_requests(userPhone);
      CREATE INDEX IF NOT EXISTS idx_stn_req_status ON station_requests(status);
      CREATE INDEX IF NOT EXISTS idx_stn_req_count ON station_requests(requestCount);
    `);

    // 12. Bảng Sổ Lệnh Hai Chiều & Khớp Lệnh Liên Tục (seat_exchange_orders - LOB & CDA Spot Market)
    db.exec(`
      CREATE TABLE IF NOT EXISTS seat_exchange_orders (
        id TEXT PRIMARY KEY,
        userId TEXT,
        orderType TEXT NOT NULL,
        stationId TEXT,
        stationName TEXT,
        corridor TEXT DEFAULT 'Tuyến QL13',
        direction TEXT,
        date TEXT,
        targetTime TEXT,
        targetTimeMinutes INTEGER,
        deltaMinutes INTEGER DEFAULT 10,
        timeStartMins INTEGER,
        timeEndMins INTEGER,
        seats INTEGER DEFAULT 1,
        remainingSeats INTEGER DEFAULT 1,
        status TEXT DEFAULT 'OPEN',
        orderTier TEXT DEFAULT 'SAFE_ADVANCE',
        ttlTimestamp INTEGER,
        ttlTimeString TEXT,
        phone TEXT,
        contactName TEXT,
        plate TEXT,
        vehicleModel TEXT,
        trustScore INTEGER DEFAULT 98,
        matchedWithOrderId TEXT,
        matchedBookingId TEXT,
        pinCode TEXT,
        rendezvousTime TEXT,
        rendezvousMinutes INTEGER,
        createdAt INTEGER,
        matchedAt INTEGER,
        expiredAt INTEGER,
        payload TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_exchange_status ON seat_exchange_orders(status);
      CREATE INDEX IF NOT EXISTS idx_exchange_station ON seat_exchange_orders(stationId);
      CREATE INDEX IF NOT EXISTS idx_exchange_corridor ON seat_exchange_orders(corridor);
      CREATE INDEX IF NOT EXISTS idx_exchange_ttl ON seat_exchange_orders(ttlTimestamp);
      CREATE INDEX IF NOT EXISTS idx_exchange_type ON seat_exchange_orders(orderType);
    `);

    // 13. Bảng Quản Lý Sự Cố Tuyến & Chế Tài Unhappy Cases (trip_incidents)
    db.exec(`
      CREATE TABLE IF NOT EXISTS trip_incidents (
        id TEXT PRIMARY KEY,
        bookingId TEXT,
        tripId TEXT,
        incidentType TEXT NOT NULL,
        reporterRole TEXT NOT NULL,
        reporterPhone TEXT,
        riderPhone TEXT,
        driverPhone TEXT,
        sanctionAction TEXT,
        driverPenalty INTEGER DEFAULT 0,
        riderPenalty INTEGER DEFAULT 0,
        fareExempt INTEGER DEFAULT 0,
        isBanned INTEGER DEFAULT 0,
        note TEXT,
        createdAt TEXT,
        payload TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_incident_type ON trip_incidents(incidentType);
      CREATE INDEX IF NOT EXISTS idx_incident_rider ON trip_incidents(riderPhone);
      CREATE INDEX IF NOT EXISTS idx_incident_driver ON trip_incidents(driverPhone);
    `);

  // 9. Nạp dữ liệu khởi tạo (Seed) — chỉ dành cho môi trường phát triển
  //
  // BẤT BIẾN SÀN GIAO DỊCH: mọi chuyến hiển thị trên sàn phải liên hệ được với
  // một người thật. Dữ liệu mẫu vi phạm bất biến này — khách bấm đặt chỗ sẽ gọi
  // vào số không có người nhận, phá vỡ niềm tin ngay lần dùng đầu tiên.
  //
  // Vì vậy seed bị KHOÁ mặc định ở production (fail-safe default, cùng nguyên lý
  // với JWT_SECRET và CARMATE_ADMIN_PASSCODE). Muốn nạp dữ liệu mẫu lên
  // production phải chủ động đặt SEED_DEMO_DATA=true — không thể xảy ra do vô ý.
  const tripCount = db.prepare('SELECT COUNT(*) as count FROM trips').get().count;
  const isProductionEnv = process.env.NODE_ENV === 'production';
  const demoSeedAllowed = process.env.SEED_DEMO_DATA === 'true' || (!isProductionEnv && process.env.SEED_DEMO_DATA !== 'false');

  if (tripCount === 0 && !demoSeedAllowed) {
    console.log(
      '[SQLite DB] Sàn khởi tạo trống (production): bỏ qua dữ liệu mẫu để không hiển thị chuyến ảo.'
    );
    console.log('[SQLite DB] Đặt SEED_DEMO_DATA=true nếu thực sự cần nạp dữ liệu mẫu.');
  }

  if (tripCount === 0 && demoSeedAllowed) {
    console.log('[SQLite DB] Bắt đầu di chuyển dữ liệu từ file JSON sang SQLite...');
    let initialDrivers = INITIAL_DRIVER_OFFERS;
    let initialPassengers = INITIAL_PASSENGER_REQUESTS;
    let initialBookings = INITIAL_BOOKED_ESCROWS;
    let initialUsers = [];

    if (fs.existsSync(LEGACY_JSON_FILE)) {
      try {
        const raw = fs.readFileSync(LEGACY_JSON_FILE, 'utf-8');
        const legacy = JSON.parse(raw);
        if (Array.isArray(legacy.driverOffers) && legacy.driverOffers.length > 0) initialDrivers = legacy.driverOffers;
        if (Array.isArray(legacy.passengerRequests) && legacy.passengerRequests.length > 0)
          initialPassengers = legacy.passengerRequests;
        if (Array.isArray(legacy.bookings) && legacy.bookings.length > 0) initialBookings = legacy.bookings;
        if (Array.isArray(legacy.users) && legacy.users.length > 0) initialUsers = legacy.users;
        console.log(
          `[SQLite DB] Đọc thành công dữ liệu di chuyển (${initialDrivers.length} chủ xe, ${initialPassengers.length} khách, ${initialBookings.length} lượt ghép)`
        );
      } catch (e) {
        console.warn('[SQLite DB] Lỗi đọc carmate_db.json:', e.message);
      }
    }

    const insertTrip = db.prepare(`
      INSERT OR REPLACE INTO trips (
        id, type, status, maskedCode, phoneReal, userId, fromLocation, toLocation,
        routeCategory, direction, timeSlot, date, price, seats, carCategory,
        carType, isHidden, isBanned, createdAt, payload
      ) VALUES (
        @id, @type, @status, @maskedCode, @phoneReal, @userId, @fromLocation, @toLocation,
        @routeCategory, @direction, @timeSlot, @date, @price, @seats, @carCategory,
        @carType, @isHidden, @isBanned, @createdAt, @payload
      )
    `);

    const insertManyTrips = db.transaction((trips, type) => {
      for (const t of trips) {
        const cleanPhone = cleanPhoneNumber(t.phoneReal || t.phone || '');
        insertTrip.run({
          id: t.id,
          type: type || t.type || 'driver_offer',
          status: t.status || 'active',
          maskedCode: t.maskedCode || 'CX-000',
          phoneReal: cleanPhone,
          userId: t.userId || (cleanPhone ? 'USR-' + cleanPhone : null),
          fromLocation: t.from || t.fromLocation || '',
          toLocation: t.to || t.toLocation || '',
          routeCategory: t.routeCategory || t.route || '',
          direction: t.direction || 'both',
          timeSlot: t.timeSlot || '07:00-08:00',
          date: t.date || 'Hôm nay',
          price: Number(t.basePricePerSeat || t.expectedPrice || 150000),
          seats: Number(t.availableSeats || t.seatsNeeded || 1),
          carCategory: t.carCategory || 'family_car',
          carType: t.carType || 'Xe 7 chỗ',
          isHidden: t.isHidden ? 1 : 0,
          isBanned: t.isBanned ? 1 : 0,
          createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
          payload: JSON.stringify(t)
        });
      }
    });

    insertManyTrips(initialDrivers, 'driver_offer');
    insertManyTrips(initialPassengers, 'passenger_request');

    // Nạp bookings
    const insertBooking = db.prepare(`
      INSERT OR REPLACE INTO bookings (escrowId, tripId, passengerPhone, status, createdAt, payload)
      VALUES (@escrowId, @tripId, @passengerPhone, @status, @createdAt, @payload)
    `);

    const insertManyBookings = db.transaction((bookings) => {
      for (const b of bookings) {
        insertBooking.run({
          escrowId: b.escrowId || b.id,
          tripId: b.tripId || '',
          passengerPhone: cleanPhoneNumber(b.passengerPhone || ''),
          status: b.status || 'zalo_active',
          createdAt: b.createdAt || Date.now(),
          payload: JSON.stringify(b)
        });
      }
    });

    insertManyBookings(initialBookings);

    // Nạp users
    const insertUser = db.prepare(`
      INSERT OR REPLACE INTO users (id, phone, name, role, avatar, trustScore, isCccdVerified, isGplxVerified, isBanned, createdAt, updatedAt, payload)
      VALUES (@id, @phone, @name, @role, @avatar, @trustScore, @isCccdVerified, @isGplxVerified, @isBanned, @createdAt, @updatedAt, @payload)
    `);

    const insertManyUsers = db.transaction((users) => {
      for (const u of users) {
        const clean = cleanPhoneNumber(u.phone);
        insertUser.run({
          id: u.id || (clean ? 'USR-' + clean : 'USR-' + Date.now()),
          phone: clean,
          name: u.name || 'Thành viên ' + clean.slice(-4),
          role: u.role || 'driver',
          avatar: u.avatar || '',
          trustScore: Number(u.trustScore || 98),
          isCccdVerified: u.isCccdVerified ? 1 : 0,
          isGplxVerified: u.isGplxVerified ? 1 : 0,
          isBanned: u.isBanned ? 1 : 0,
          createdAt: u.createdAt || new Date().toISOString(),
          updatedAt: u.updatedAt || new Date().toISOString(),
          payload: JSON.stringify(u)
        });
      }
    });

    insertManyUsers(initialUsers);

    console.log('[SQLite DB] Hoàn tất di chuyển sang SQLite Database!');
  }

  // Tự động dọn dẹp các thực thể HTML cũ (như &#x2F;) trong DB nếu có
  try {
    db.exec(`
      UPDATE trips SET 
        fromLocation = REPLACE(fromLocation, '&#x2F;', '/'),
        toLocation = REPLACE(toLocation, '&#x2F;', '/'),
        payload = REPLACE(payload, '&#x2F;', '/')
      WHERE fromLocation LIKE '%&#x2F;%' OR toLocation LIKE '%&#x2F;%' OR payload LIKE '%&#x2F;%';
    `);
  } catch (err) {
    console.warn('[SQLite DB] Bỏ qua dọn dẹp thực thể:', err.message);
  }

  // Đồng bộ lại ngày khởi hành & thuộc tính định kỳ cho các chuyến xe mẫu (DRV-101, REQ-201...)
  try {
    const allSeeds = [...INITIAL_DRIVER_OFFERS, ...INITIAL_PASSENGER_REQUESTS];
    const updateStmt = db.prepare(`
      UPDATE trips 
      SET date = ?, timeSlot = ?, payload = ?
      WHERE id = ?
    `);
    const syncSeeds = db.transaction(() => {
      for (const s of allSeeds) {
        updateStmt.run(s.date || 'Hôm nay', s.timeSlot || '07:00-08:00', JSON.stringify(s), s.id);
      }
    });
    syncSeeds();
  } catch (err) {
    console.warn('[SQLite DB] Bỏ qua đồng bộ seed:', err.message);
  }

  return db;
}

/**
 * Gộp toàn bộ WAL vào file chính rồi đóng kết nối.
 * Gọi khi tắt server để dữ liệu nằm trọn trong carmate.sqlite,
 * tránh mất giao dịch còn kẹt trong WAL nếu volume bị huỷ.
 */
export function closeDB() {
  if (!db) return;
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (err) {
    console.warn('[SQLite DB] Không thể checkpoint WAL khi đóng:', err.message);
  }
  try {
    db.close();
  } catch (err) {
    console.warn('[SQLite DB] Lỗi khi đóng kết nối:', err.message);
  }
  db = null;
}

export function getRawDB() {
  if (!db) {
    throw new Error('Database chưa được khởi tạo. Hãy gọi initDB() trước.');
  }
  return db;
}

/**
 * Compatibility getDB() cho các controller:
 * Cung cấp getter động để truy cập db.driverOffers, db.passengerRequests, db.bookings, db.users
 */
export function getDB() {
  const database = getRawDB();
  return {
    raw: database,
    get driverOffers() {
      return getTrips({ type: 'drivers', includeHidden: true });
    },
    get passengerRequests() {
      return getTrips({ type: 'passengers', includeHidden: true });
    },
    get bookings() {
      return getBookings();
    },
    get users() {
      return getAllUsers();
    },
    stats: {
      members: SITE_INFO.stats.members,
      tripsCompleted: SITE_INFO.stats.tripsCompleted,
      routes: SITE_INFO.stats.routes,
      avgRating: SITE_INFO.stats.avgRating
    }
  };
}

// -------------------------------------------------------------
// CÁC HÀM CRUD BẤT ĐỒNG BỘ DÀNH CHO NGHIỆP VỤ (COMPATIBLE API)
// -------------------------------------------------------------

function rowToTrip(row) {
  if (!row) return null;
  try {
    const obj = JSON.parse(row.payload);
    obj.id = row.id;
    obj.type = row.type;
    obj.status = row.status;
    obj.phoneReal = row.phoneReal;
    obj.userId = row.userId;
    obj.from = row.fromLocation || obj.from;
    obj.to = row.toLocation || obj.to;
    obj.route = row.routeCategory || obj.route;
    obj.routeCategory = row.routeCategory || obj.routeCategory;
    obj.direction = row.direction || obj.direction;
    obj.timeSlot = row.timeSlot || obj.timeSlot;
    if (obj.timeSlotLabel) {
      obj.timeSlotLabel = sanitizeTimeLabel(obj.timeSlotLabel);
    }
    obj.date = row.date || obj.date;
    obj.basePricePerSeat = row.price || obj.basePricePerSeat;
    obj.availableSeats = row.seats || obj.availableSeats;
    obj.carCategory = row.carCategory || obj.carCategory;
    obj.carType = row.carType || obj.carType;
    obj.isHidden = Boolean(row.isHidden);
    obj.isBanned = Boolean(row.isBanned);
    return obj;
  } catch {
    return null;
  }
}

export function getPaginatedTrips(filters = {}) {
  const database = getRawDB();
  let baseSql = 'FROM trips WHERE 1=1';
  const params = [];

  const type = filters.type || 'all';
  if (type === 'drivers') {
    baseSql += ' AND type = ?';
    params.push('driver_offer');
  } else if (type === 'passengers') {
    baseSql += ' AND type = ?';
    params.push('passenger_request');
  }

  if (!filters.includeHidden) {
    baseSql += ' AND isHidden = 0';
  }

  if (filters.routeCategory && filters.routeCategory !== 'all') {
    baseSql += ' AND routeCategory = ?';
    params.push(filters.routeCategory);
  }

  if (filters.direction && filters.direction !== 'all') {
    baseSql += ' AND direction = ?';
    params.push(filters.direction);
  }

  if (filters.timeSlot && filters.timeSlot !== 'all') {
    baseSql += ' AND timeSlot = ?';
    params.push(filters.timeSlot);
  }

  if (filters.q && filters.q.trim()) {
    const kw = `%${filters.q.trim()}%`;
    baseSql += ' AND (fromLocation LIKE ? OR toLocation LIKE ? OR routeCategory LIKE ? OR payload LIKE ?)';
    params.push(kw, kw, kw, kw);
  }

  const allRows = database.prepare(`SELECT * ${baseSql} ORDER BY createdAt DESC`).all(...params);
  let trips = allRows.map(rowToTrip).filter(Boolean);

  // Mặc định tự động loại bỏ các chuyến đã hết hạn (>30 phút sau giờ khởi hành)
  if (!filters.includeExpired) {
    trips = trips.filter((t) => !isTripExpired(t));
  }

  const total = trips.length;
  const limit = Math.max(1, Math.min(100, parseInt(filters.limit, 10) || 50));
  const offset = Math.max(0, parseInt(filters.offset, 10) || 0);
  const paginatedTrips = trips.slice(offset, offset + limit);

  return { total, trips: paginatedTrips };
}

export function getTrips(filters = {}) {
  const database = getRawDB();
  let sql = 'SELECT * FROM trips WHERE 1=1';
  const params = [];

  const type = filters.type || 'all';
  if (type === 'drivers') {
    sql += ' AND type = ?';
    params.push('driver_offer');
  } else if (type === 'passengers') {
    sql += ' AND type = ?';
    params.push('passenger_request');
  }

  if (!filters.includeHidden) {
    sql += ' AND isHidden = 0';
  }

  if (filters.routeCategory && filters.routeCategory !== 'all') {
    sql += ' AND routeCategory = ?';
    params.push(filters.routeCategory);
  }

  if (filters.direction && filters.direction !== 'all') {
    sql += ' AND direction = ?';
    params.push(filters.direction);
  }

  if (filters.timeSlot && filters.timeSlot !== 'all') {
    sql += ' AND timeSlot = ?';
    params.push(filters.timeSlot);
  }

  if (filters.q && filters.q.trim()) {
    const kw = `%${filters.q.trim()}%`;
    sql += ' AND (fromLocation LIKE ? OR toLocation LIKE ? OR routeCategory LIKE ? OR payload LIKE ?)';
    params.push(kw, kw, kw, kw);
  }

  sql += ' ORDER BY createdAt DESC';

  const rows = database.prepare(sql).all(...params);
  let trips = rows.map(rowToTrip).filter(Boolean);

  // Mặc định lọc bỏ các chuyến quá giờ để đảm bảo dữ liệu sàn luôn tươi mới
  if (!filters.includeExpired) {
    trips = trips.filter((t) => !isTripExpired(t));
  }

  return trips;
}

export function getTripById(id) {
  const database = getRawDB();
  const row = database.prepare('SELECT * FROM trips WHERE id = ?').get(id);
  return rowToTrip(row);
}

export async function addTrip(tripData) {
  const database = getRawDB();
  const cleanPhone = cleanPhoneNumber(tripData.phoneReal || tripData.phone || '');
  const id = tripData.id || `${tripData.type === 'passenger_request' ? 'REQ' : 'DRV'}-${Date.now()}`;
  const maskedCode =
    tripData.maskedCode ||
    `${tripData.type === 'passenger_request' ? 'HK' : 'CX'}-${Math.floor(100 + Math.random() * 900)}`;

  let dateVal = tripData.date || 'Hôm nay';
  if (
    tripData.departureTime &&
    /mai/i.test(tripData.departureTime) &&
    (!tripData.date || tripData.date === 'Hôm nay')
  ) {
    dateVal = 'Ngày mai';
  }

  let timeSlotVal = tripData.timeSlot;
  if (!timeSlotVal && tripData.departureTime) {
    const m = tripData.departureTime.match(/(\d{1,2}):(\d{2})/);
    if (m) {
      const h = Number(m[1]);
      const nextH = (h + 1) % 24;
      timeSlotVal = `${String(h).padStart(2, '0')}:${m[2]}-${String(nextH).padStart(2, '0')}:${m[2]}`;
    }
  }
  if (!timeSlotVal) timeSlotVal = '07:00-08:00';

  const assignedUserId = tripData.userId || (cleanPhone ? 'USR-' + cleanPhone : null);
  const completeTrip = {
    ...tripData,
    id,
    maskedCode,
    userId: assignedUserId,
    phoneReal: cleanPhone,
    date: dateVal,
    timeSlot: timeSlotVal,
    status: tripData.status || 'active',
    createdAt: tripData.createdAt || Date.now()
  };

  const stmt = database.prepare(`
    INSERT OR REPLACE INTO trips (
      id, type, status, maskedCode, phoneReal, userId, fromLocation, toLocation,
      routeCategory, direction, timeSlot, date, price, seats, carCategory,
      carType, isHidden, isBanned, createdAt, payload
    ) VALUES (
      @id, @type, @status, @maskedCode, @phoneReal, @userId, @fromLocation, @toLocation,
      @routeCategory, @direction, @timeSlot, @date, @price, @seats, @carCategory,
      @carType, @isHidden, @isBanned, @createdAt, @payload
    )
  `);

  stmt.run({
    id,
    type: completeTrip.type || 'driver_offer',
    status: completeTrip.status || 'active',
    maskedCode: completeTrip.maskedCode || 'CX-000',
    phoneReal: cleanPhone,
    userId: completeTrip.userId || (cleanPhone ? 'USR-' + cleanPhone : null),
    fromLocation: completeTrip.from || completeTrip.fromLocation || '',
    toLocation: completeTrip.to || completeTrip.toLocation || '',
    routeCategory: completeTrip.routeCategory || completeTrip.route || '',
    direction: completeTrip.direction || 'both',
    timeSlot: completeTrip.timeSlot,
    date: completeTrip.date,
    price: Number(completeTrip.basePricePerSeat || completeTrip.expectedPrice || 150000),
    seats: Number(completeTrip.availableSeats || completeTrip.seatsNeeded || 1),
    carCategory: completeTrip.carCategory || 'family_car',
    carType: completeTrip.carType || 'Xe 7 chỗ',
    isHidden: completeTrip.isHidden ? 1 : 0,
    isBanned: completeTrip.isBanned ? 1 : 0,
    createdAt: completeTrip.createdAt,
    payload: JSON.stringify(completeTrip)
  });

  return completeTrip;
}

// Các trường định danh / quyền sở hữu KHÔNG bao giờ được nhận từ client qua updateTrip.
// Ngăn Mass-Assignment: chủ bài đổi phoneReal sang số người khác, chiếm userId, tự nâng trustScore...
const IMMUTABLE_TRIP_FIELDS = new Set([
  'id',
  'phoneReal',
  'phone',
  'userId',
  'creatorId',
  'trustScore',
  'isCccdVerified',
  'isGplxVerified',
  'createdAt'
]);

export async function updateTrip(id, updates) {
  const existing = getTripById(id);
  if (!existing) return null;

  // Lọc bỏ mọi trường bất biến khỏi payload client trước khi hợp nhất.
  const safeUpdates = {};
  for (const key of Object.keys(updates || {})) {
    if (!IMMUTABLE_TRIP_FIELDS.has(key)) {
      safeUpdates[key] = updates[key];
    }
  }

  const merged = {
    ...existing,
    ...safeUpdates,
    // Quyền sở hữu & định danh luôn kế thừa từ bản ghi gốc trong DB.
    id: existing.id,
    phoneReal: existing.phoneReal,
    phone: existing.phone,
    userId: existing.userId,
    creatorId: existing.creatorId,
    createdAt: existing.createdAt,
    updatedAt: Date.now()
  };
  await addTrip(merged);
  return merged;
}

/**
 * Tái đăng 1 chạm (1-Tap Re-publish) chuyến xe sang ngày mới
 * Giúp Chủ xe nhân bản toàn bộ thông tin lộ trình, xe, giá sang ngày mai chỉ trong 1 chạm.
 */
export async function republishTrip(id, updates = {}) {
  const existing = getTripById(id);
  if (!existing) return null;

  const newDate = updates.date || getTomorrowISO();
  const newTimeSlot = updates.timeSlot || existing.timeSlot || '07:00-09:00';
  const newExactTime = updates.exactTime !== undefined ? updates.exactTime : existing.exactTime || '';

  const prefix = existing.type === 'passenger_request' ? 'REQ' : 'DRV';
  const codePrefix = existing.type === 'passenger_request' ? 'HK' : 'CX';
  const newId = `${prefix}-${Date.now()}`;
  const newMaskedCode = `${codePrefix}-${Math.floor(100 + Math.random() * 900)}`;

  // Chỉ cho phép đổi các trường lịch trình khi tái đăng. Không lấy nguyên
  // `updates` để tránh ghi đè quyền sở hữu (phoneReal/userId) — nếu không,
  // chủ bài có thể tái đăng thành chuyến đứng tên số điện thoại người khác.
  const ALLOWED_REPUBLISH_FIELDS = [
    'date',
    'timeSlot',
    'exactTime',
    'availableSeats',
    'seatsNeeded',
    'basePricePerSeat',
    'expectedPrice',
    'notes',
    'perks',
    'direction'
  ];
  const safeUpdates = {};
  for (const key of ALLOWED_REPUBLISH_FIELDS) {
    if (updates[key] !== undefined) safeUpdates[key] = updates[key];
  }

  const duplicatedData = {
    ...existing,
    ...safeUpdates,
    // Quyền sở hữu luôn kế thừa từ bài gốc, không nhận từ client
    phoneReal: existing.phoneReal,
    phone: existing.phone,
    userId: existing.userId,
    id: newId,
    maskedCode: newMaskedCode,
    date: newDate,
    timeSlot: newTimeSlot,
    exactTime: newExactTime,
    status: 'active',
    isHidden: 0,
    isBanned: 0,
    createdAt: Date.now()
  };

  return await addTrip(duplicatedData);
}

export async function deleteTrip(id) {
  const database = getRawDB();
  const info = database.prepare('DELETE FROM trips WHERE id = ?').run(id);
  return info.changes > 0;
}

export function getBookings() {
  const database = getRawDB();
  const rows = database.prepare('SELECT payload FROM bookings ORDER BY createdAt DESC').all();
  return rows
    .map((r) => {
      try {
        return JSON.parse(r.payload);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export async function addBooking(bookingData) {
  const database = getRawDB();
  const escrowId = bookingData.escrowId || bookingData.id || `ESC-${Date.now()}`;

  // Access token bí mật (128-bit) cho Magic Link chủ xe xác nhận / xem tóm tắt mà không cần đăng nhập.
  // escrowId (CX-xxxx) dễ đoán -> token này ngăn IDOR enumerate booking người khác.
  // Giữ nguyên token nếu booking đã tồn tại (tránh vô hiệu hoá link cũ khi cập nhật).
  const existing = getBookingById(escrowId);
  const accessToken = bookingData.accessToken || existing?.accessToken || crypto.randomBytes(16).toString('hex');

  const full = {
    ...bookingData,
    escrowId,
    accessToken,
    status: bookingData.status || 'zalo_active',
    commitmentType: bookingData.commitmentType || 'zalo_direct',
    createdAt: bookingData.createdAt || Date.now()
  };

  database
    .prepare(
      `
    INSERT OR REPLACE INTO bookings (escrowId, tripId, passengerPhone, status, createdAt, payload)
    VALUES (?, ?, ?, ?, ?, ?)
  `
    )
    .run(
      escrowId,
      full.tripId || '',
      cleanPhoneNumber(full.passengerPhone || ''),
      full.status || 'zalo_active',
      full.createdAt,
      JSON.stringify(full)
    );

  return full;
}

export function getBookingById(id) {
  const database = getRawDB();
  const row = database.prepare('SELECT payload FROM bookings WHERE escrowId = ?').get(id);
  if (!row) return null;
  try {
    return JSON.parse(row.payload);
  } catch {
    return null;
  }
}

export async function updateBookingStatus(id, status, extra = {}) {
  const database = getRawDB();
  const row = database.prepare('SELECT payload FROM bookings WHERE escrowId = ?').get(id);
  if (!row) return null;

  try {
    const full = JSON.parse(row.payload);
    full.status = status;
    Object.assign(full, extra);

    database
      .prepare(
        `
      UPDATE bookings SET status = ?, payload = ? WHERE escrowId = ?
    `
      )
      .run(status, JSON.stringify(full), id);

    return full;
  } catch {
    return null;
  }
}

export async function removeBooking(id) {
  const database = getRawDB();
  const info = database.prepare('DELETE FROM bookings WHERE escrowId = ?').run(id);
  return info.changes > 0;
}

export function clearAllBookings() {
  const database = getRawDB();
  const info = database.prepare('DELETE FROM bookings').run();
  return info.changes;
}

export function clearTestBookings() {
  const database = getRawDB();
  const info = database.prepare("DELETE FROM bookings WHERE escrowId LIKE 'TEST-%' OR tripId LIKE 'INT-%' OR tripId LIKE 'TRIP-TEST-%'").run();
  return info.changes;
}

export function getUserByPhone(phone) {
  const database = getRawDB();
  const clean = cleanPhoneNumber(phone);
  if (!clean) return null;

  const row = database.prepare('SELECT payload FROM users WHERE phone = ?').get(clean);
  if (!row) return null;

  try {
    return JSON.parse(row.payload);
  } catch {
    return null;
  }
}

export function getUserById(id) {
  const database = getRawDB();
  if (!id) return null;
  const clean = cleanPhoneNumber(id);
  const row = database.prepare('SELECT payload FROM users WHERE id = ? OR phone = ?').get(id, clean || id);
  if (!row) return null;

  try {
    return JSON.parse(row.payload);
  } catch {
    return null;
  }
}

export function getUserByEmail(email) {
  const database = getRawDB();
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();
  // Ưu tiên truy vấn qua Index cột email O(1), fallback quét payload nếu là dữ liệu cũ
  const row =
    database.prepare('SELECT payload FROM users WHERE email = ?').get(cleanEmail) ||
    database.prepare('SELECT payload FROM users WHERE payload LIKE ?').get(`%"email":"${cleanEmail}"%`);
  if (!row) return null;

  try {
    return JSON.parse(row.payload);
  } catch {
    return null;
  }
}

export function getUserByTelegramId(telegramId) {
  const database = getRawDB();
  if (!telegramId) return null;
  const cleanId = String(telegramId).trim();
  const row =
    database.prepare('SELECT payload FROM users WHERE id = ?').get(`USR-TG-${cleanId}`) ||
    database.prepare('SELECT payload FROM users WHERE payload LIKE ?').get(`%"telegramId":"${cleanId}"%`);
  if (!row) return null;

  try {
    return JSON.parse(row.payload);
  } catch {
    return null;
  }
}

export function getUserByGoogleId(googleId) {
  const database = getRawDB();
  if (!googleId) return null;
  const cleanId = String(googleId).trim();
  const row =
    database.prepare('SELECT payload FROM users WHERE id = ?').get(`USR-GG-${cleanId}`) ||
    database.prepare('SELECT payload FROM users WHERE payload LIKE ?').get(`%"googleId":"${cleanId}"%`);
  if (!row) return null;

  try {
    return JSON.parse(row.payload);
  } catch {
    return null;
  }
}

export async function saveUser(user) {
  const database = getRawDB();
  const clean = cleanPhoneNumber(user.phone);
  const cleanEmail = user.email ? user.email.trim().toLowerCase() : null;
  const id = user.id || (clean ? 'USR-' + clean : 'USR-' + Date.now());
  const now = new Date().toISOString();

  const full = {
    ...user,
    id,
    phone: clean,
    email: cleanEmail,
    updatedAt: now,
    createdAt: user.createdAt || now
  };

  database
    .prepare(
      `
    INSERT OR REPLACE INTO users (
      id, phone, email, name, role, avatar, trustScore, isCccdVerified, isGplxVerified, isBanned, createdAt, updatedAt, payload
    ) VALUES (
      @id, @phone, @email, @name, @role, @avatar, @trustScore, @isCccdVerified, @isGplxVerified, @isBanned, @createdAt, @updatedAt, @payload
    )
  `
    )
    .run({
      id,
      phone: clean,
      email: cleanEmail,
      name: full.name || 'Thành viên ' + (clean ? clean.slice(-4) : 'mới'),
      role: full.role || 'driver',
      avatar: full.avatar || '',
      trustScore: Number(full.trustScore || 98),
      isCccdVerified: full.isCccdVerified ? 1 : 0,
      isGplxVerified: full.isGplxVerified ? 1 : 0,
      isBanned: full.isBanned ? 1 : 0,
      createdAt: full.createdAt,
      updatedAt: full.updatedAt,
      payload: JSON.stringify(full)
    });

  return full;
}

/**
 * Xóa vĩnh viễn tài khoản người dùng & thanh tẩy dữ liệu cá nhân (PII Cleanse)
 * Tuân thủ Apple App Store Guideline 5.1.1 (v) & Nghị định 13/2023/NĐ-CP (Điều 16)
 */
export async function deleteUserAccount(userId, phone) {
  const database = getRawDB();

  let user = null;
  if (userId) user = getUserById(userId);
  if (!user && phone) user = getUserByPhone(phone);

  const effectiveUserId = user?.id || userId;
  const effectivePhone = user?.phone || (phone ? cleanPhoneNumber(phone) : null);

  // MIT Invariant Guard: Không bao giờ xoá tài khoản Admin (bảo toàn hệ thống luôn có chủ quản)
  if (user?.role === 'admin' || (effectivePhone && isAdminPhone(effectivePhone))) {
    throw new Error('Tài khoản Quản trị viên (Admin) được bảo vệ bởi luật bất biến MIT, không thể tự xoá vĩnh viễn.');
  }

  // 1. Xóa các bài đăng của người dùng này (để không còn xuất hiện trên sàn)
  if (effectiveUserId) {
    database.prepare('DELETE FROM trips WHERE userId = ?').run(effectiveUserId);
  }
  if (effectivePhone) {
    database.prepare('DELETE FROM trips WHERE phoneReal = ?').run(effectivePhone);
  }

  // 2. Ẩn danh hóa các cuốc ghép trong lịch sử để không làm hỏng dữ liệu của người đi cùng
  if (effectivePhone) {
    const userBookings = database
      .prepare('SELECT escrowId, payload FROM bookings WHERE passengerPhone = ?')
      .all(effectivePhone);
    for (const b of userBookings) {
      try {
        const payload = JSON.parse(b.payload || '{}');
        payload.passengerPhone = '[Đã xóa]';
        payload.passengerName = '[Tài khoản đã xóa]';
        database
          .prepare('UPDATE bookings SET passengerPhone = ?, payload = ? WHERE escrowId = ?')
          .run('[Đã xóa]', JSON.stringify(payload), b.escrowId);
      } catch {}
    }
  }

  // 3. Xóa vĩnh viễn khỏi bảng users
  let deleted = false;
  if (effectiveUserId) {
    const info = database.prepare('DELETE FROM users WHERE id = ?').run(effectiveUserId);
    deleted = info.changes > 0;
  }
  if (!deleted && effectivePhone) {
    const info = database.prepare('DELETE FROM users WHERE phone = ?').run(effectivePhone);
    deleted = info.changes > 0;
  }

  return { success: true, userDeleted: deleted };
}

export function getTripsForUser(userOrPhoneOrId) {
  const database = getRawDB();
  if (!userOrPhoneOrId) return [];

  let userId = '';
  let phone = '';
  if (typeof userOrPhoneOrId === 'object') {
    userId = userOrPhoneOrId.id || userOrPhoneOrId.userId || '';
    phone = userOrPhoneOrId.phone || '';
  } else if (String(userOrPhoneOrId).startsWith('USR-')) {
    userId = String(userOrPhoneOrId);
  } else {
    phone = String(userOrPhoneOrId);
  }

  const clean = cleanPhoneNumber(phone);
  const norm = normalizePhoneNumber(phone);

  const rows = database
    .prepare(
      `SELECT * FROM trips
       WHERE (@userId != '' AND userId = @userId)
          OR (@norm != '' AND (phoneReal = @norm OR phoneReal = @clean OR userId = @usrNorm))
       ORDER BY createdAt DESC`
    )
    .all({
      userId: userId || '',
      norm: norm || '',
      clean: clean || '',
      usrNorm: norm ? 'USR-' + norm : ''
    });

  return rows.map(rowToTrip).filter(Boolean);
}

export function getTripsByPhone(phone) {
  return getTripsForUser(phone);
}

export function getAllUsers() {
  const database = getRawDB();
  const userRows = database.prepare('SELECT payload FROM users').all();
  const userMap = new Map();

  userRows.forEach((r) => {
    try {
      const u = JSON.parse(r.payload);
      userMap.set(u.id || cleanPhoneNumber(u.phone), u);
    } catch {}
  });

  const tripRows = database.prepare('SELECT payload FROM trips WHERE type = ?').all('driver_offer');
  tripRows.forEach((r) => {
    try {
      const t = JSON.parse(r.payload);
      const key = t.userId || cleanPhoneNumber(t.phoneReal || t.phone || t.id);
      if (!userMap.has(key)) {
        userMap.set(key, {
          id: key,
          name: t.publicName || t.driverName || 'Chủ xe ' + (t.maskedCode || 'CX-000'),
          phone: t.phoneReal || t.phone || getPrimaryAdminPhone(),
          role: 'driver',
          hometown: t.hometown || 'Bình Phước',
          carModel: t.carType || 'Mitsubishi Xpander',
          licensePlate: t.licensePlateMasked || '93A-xxx.xx',
          isCccdVerified: Boolean(t.isCccdVerified ?? true),
          isGplxVerified: Boolean(t.isGplxVerified ?? true),
          isBanned: Boolean(t.isBanned ?? false),
          createdAt: t.createdAt || new Date().toISOString()
        });
      }
    } catch {}
  });

  return Array.from(userMap.values());
}

export async function updateUserStatus(userId, updates = {}) {
  const database = getRawDB();
  let found = null;
  const row = database
    .prepare('SELECT payload FROM users WHERE id = ? OR phone = ?')
    .get(userId, cleanPhoneNumber(userId));
  if (row) {
    try {
      found = JSON.parse(row.payload);
    } catch {}
  }

  if (!found) {
    found = {
      id: userId,
      phone: userId,
      name: 'Thành viên ' + userId,
      ...updates,
      updatedAt: new Date().toISOString()
    };
  } else {
    Object.assign(found, updates, { updatedAt: new Date().toISOString() });
  }

  if (updates.isBanned === false) {
    found.isBanned = false;
    found.status = 'active';
    found.bannedAt = null;
    found.deactivateAt = null;
    found.piiStrikes = 0;
    found.banReason = null;
    if ((found.trustScore || 0) < 85) {
      found.trustScore = 95;
    }
  }

  await saveUser(found);

  if (updates.isBanned !== undefined) {
    const isBannedInt = updates.isBanned ? 1 : 0;
    database
      .prepare('UPDATE trips SET isBanned = ? WHERE phoneReal = ? OR userId = ?')
      .run(isBannedInt, cleanPhoneNumber(found.phone), userId);
  }

  return found;
}

export function getAllTripsAdmin() {
  return getTrips({ includeHidden: true });
}

export async function toggleHideTrip(tripId, isHidden) {
  const database = getRawDB();
  const isHiddenInt = isHidden ? 1 : 0;
  database.prepare('UPDATE trips SET isHidden = ? WHERE id = ?').run(isHiddenInt, tripId);
  return getTripById(tripId);
}

export async function deleteTripPermanent(tripId) {
  return deleteTrip(tripId);
}

export function getAdminMetrics() {
  const database = getRawDB();
  const totalTripsCount = database.prepare('SELECT COUNT(*) as count FROM trips').get().count;
  const hiddenTripsCount = database.prepare('SELECT COUNT(*) as count FROM trips WHERE isHidden = 1').get().count;
  const activeTripsCount = database
    .prepare('SELECT COUNT(*) as count FROM trips WHERE isHidden = 0 AND isBanned = 0 AND status = ?')
    .get('active').count;
  const totalBookingsCount = database.prepare('SELECT COUNT(*) as count FROM bookings').get().count;
  const completedBookingsCount = database
    .prepare('SELECT COUNT(*) as count FROM bookings WHERE status = ?')
    .get('completed').count;
  const activeBookingsCount = database
    .prepare('SELECT COUNT(*) as count FROM bookings WHERE status = ?')
    .get('zalo_active').count;

  const allUsersList = getAllUsers();
  const totalMembersCount = allUsersList.length;
  const verifiedDriversCount = allUsersList.filter((u) => u.isCccdVerified && u.isGplxVerified).length;

  const uptimeSeconds = Math.floor(process.uptime());
  const heapUsedMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

  return {
    overview: {
      totalTripsCount,
      hiddenTripsCount,
      activeTripsCount,
      totalBookingsCount,
      completedBookingsCount,
      activeBookingsCount,
      totalMembersCount,
      verifiedDriversCount
    },
    systemHealth: {
      heapUsedMB,
      uptimeSeconds,
      uptimeFormatted: `${Math.floor(uptimeSeconds / 60)} phút`,
      nodeVersion: process.version
    },
    // Backward compatibility fields
    totalTrips: totalTripsCount,
    hiddenTrips: hiddenTripsCount,
    activeBookings: activeBookingsCount,
    totalMembers: totalMembersCount,
    tripsCompleted: SITE_INFO.stats.tripsCompleted,
    routes: SITE_INFO.stats.routes,
    uptimeSeconds,
    nodeVersion: process.version,
    memoryUsageMB: heapUsedMB
  };
}

/**
 * ── AI AGENTIC OBSERVABILITY (MIT & STANFORD TRAJECTORY HUB) ──
 */

export function recordAiTrajectory({
  userGoal,
  requestedRoute = '',
  reasoningSteps = [],
  suggestionsCount = 0,
  executionTimeMs = 0,
  unmetDemand = false
}) {
  const database = getRawDB();
  const id = `TRAJ-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const stmt = database.prepare(`
    INSERT INTO ai_trajectories (
      id, userGoal, requestedRoute, reasoningSteps, suggestionsCount, executionTimeMs, unmetDemand, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    userGoal,
    requestedRoute,
    JSON.stringify(reasoningSteps),
    suggestionsCount,
    executionTimeMs,
    unmetDemand ? 1 : 0,
    Date.now()
  );
  return id;
}

export function getAiTrajectories(limit = 30) {
  const database = getRawDB();
  const rows = database
    .prepare(
      `
    SELECT * FROM ai_trajectories ORDER BY createdAt DESC LIMIT ?
  `
    )
    .all(limit);
  return rows.map((r) => ({
    ...r,
    reasoningSteps: r.reasoningSteps ? JSON.parse(r.reasoningSteps) : [],
    unmetDemand: Boolean(r.unmetDemand)
  }));
}

export function getAiIntelligenceStats() {
  const database = getRawDB();
  const total = database.prepare('SELECT COUNT(*) as count FROM ai_trajectories').get().count;
  const resolved = database
    .prepare('SELECT COUNT(*) as count FROM ai_trajectories WHERE suggestionsCount > 0')
    .get().count;
  const avgLatencyRow = database.prepare('SELECT AVG(executionTimeMs) as avgLat FROM ai_trajectories').get();
  const avgLatencyMs = Math.round(avgLatencyRow?.avgLat || 0);
  const unmetTotal = database
    .prepare('SELECT COUNT(*) as count FROM ai_trajectories WHERE unmetDemand = 1')
    .get().count;

  // Nhóm các tuyến xe chưa được đáp ứng nhiều nhất (Unmet Demand)
  const unmetRoutes = database
    .prepare(
      `
    SELECT requestedRoute as route, COUNT(*) as count, MAX(createdAt) as lastQueriedAt
    FROM ai_trajectories
    WHERE unmetDemand = 1 AND requestedRoute IS NOT NULL AND requestedRoute != ''
    GROUP BY requestedRoute
    ORDER BY count DESC
    LIMIT 10
  `
    )
    .all();

  const recentTrajectories = getAiTrajectories(20);

  return {
    summary: {
      totalQueries: total,
      resolvedQueries: resolved,
      resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 100,
      avgLatencyMs,
      unmetDemandCount: unmetTotal
    },
    unmetDemandRoutes: unmetRoutes,
    recentTrajectories
  };
}

export function saveAnalyticsEvent({ id, eventName, properties, userId, createdAt }) {
  const database = getRawDB();
  const stmt = database.prepare(`
    INSERT INTO analytics_events (id, event_name, properties, user_id, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(
    id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    eventName,
    typeof properties === 'object' ? JSON.stringify(properties) : properties || '{}',
    userId || null,
    createdAt || Date.now()
  );
}

export function getAnalyticsSummary() {
  const database = getRawDB();
  const total = database.prepare('SELECT COUNT(*) as count FROM analytics_events').get().count;

  // Funnel events count
  const funnelEvents = ['page_view', 'search_route', 'view_trip', 'initiate_booking', 'open_zalo', 'driver_confirm'];
  const funnelCounts = {};
  for (const evt of funnelEvents) {
    const row = database.prepare('SELECT COUNT(*) as count FROM analytics_events WHERE event_name = ?').get(evt);
    funnelCounts[evt] = row?.count || 0;
  }

  // Top searched routes from properties
  const allSearchEvents = database
    .prepare(
      `
    SELECT properties FROM analytics_events 
    WHERE event_name = 'search_route' 
    ORDER BY created_at DESC LIMIT 500
  `
    )
    .all();

  const routeCounts = {};
  for (const row of allSearchEvents) {
    try {
      const p = JSON.parse(row.properties || '{}');
      let r = p.route || p.selectedRoute;
      if (!r && p.from && p.to) r = `${p.from} - ${p.to}`;
      else if (!r && (p.from || p.to)) r = p.from || p.to;
      if (typeof r === 'string') {
        r = r.trim().replace(/^-\s*|\s*-$/g, '');
      }
      if (r && r !== '-') {
        routeCounts[r] = (routeCounts[r] || 0) + 1;
      }
    } catch {
      // ignore json parse error
    }
  }

  const topRoutes = Object.entries(routeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([route, count]) => ({ route, count }));

  // Recent 20 events
  const recentEvents = database
    .prepare(
      `
    SELECT * FROM analytics_events ORDER BY created_at DESC LIMIT 20
  `
    )
    .all()
    .map((r) => ({
      ...r,
      properties: r.properties ? JSON.parse(r.properties) : {}
    }));

  return {
    totalEvents: total,
    funnel: {
      ...funnelCounts,
      open_zalo_chat: funnelCounts.open_zalo || 0
    },
    topRoutes,
    topSearchedRoutes: topRoutes,
    recentEvents
  };
}

export function clearAnalyticsEvents() {
  const database = getRawDB();
  const res = database.prepare('DELETE FROM analytics_events').run();
  return res.changes;
}

export function clearAiTrajectories() {
  const database = getRawDB();
  const res = database.prepare('DELETE FROM ai_trajectories').run();
  return res.changes;
}

export function clearSupportMessages() {
  const database = getRawDB();
  const res = database.prepare('DELETE FROM support_messages').run();
  return res.changes;
}

/**
 * Lấy cấu hình quy tắc tính điểm tín nhiệm (Dynamic Trust Policy Rules)
 */
export function getTrustRules() {
  const database = getRawDB();
  try {
    const row = database.prepare('SELECT value FROM key_values WHERE key = ?').get('trust_policy_rules');
    if (row && row.value) {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[SQLite DB] Lỗi đọc trust_policy_rules:', e.message);
  }
  return DEFAULT_TRUST_RULES;
}

/**
 * Lưu cấu hình quy tắc tính điểm tín nhiệm (Admin Update)
 */
export function saveTrustRules(rules) {
  if (!Array.isArray(rules)) {
    throw new Error('Rules phải là một danh sách mảng');
  }
  const database = getRawDB();
  const jsonStr = JSON.stringify(rules);
  database
    .prepare(
      `
    INSERT INTO key_values (key, value) VALUES ('trust_policy_rules', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `
    )
    .run(jsonStr);
  return rules;
}

/**
 * Khôi phục cấu hình quy tắc tính điểm tín nhiệm về mặc định
 */
export function resetTrustRules() {
  const database = getRawDB();
  database.prepare('DELETE FROM key_values WHERE key = ?').run('trust_policy_rules');
  return DEFAULT_TRUST_RULES;
}

/**
 * Kiểm tra xem người dùng có bị vô hiệu hóa hoàn toàn hay không (hết hạn ân hạn 3 ngày)
 */
export function isUserDeactivated(user) {
  if (!user) return false;
  if (user.isDeactivated || user.status === 'deactivated') return true;
  if (user.isBanned && user.deactivateAt && Date.now() >= user.deactivateAt) {
    return true;
  }
  return false;
}

/**
 * Lưu tin nhắn hỗ trợ giữa Người dùng và Platform Support / CSKH CarMate
 */
export function saveSupportMessage({
  id = `SUP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  bookingId = null,
  userId = null,
  phone = null,
  senderRole = 'user', // 'user' | 'platform' | 'admin'
  senderName = 'Thành viên',
  message = '',
  type = 'support', // 'support' | 'ban_dispute' | 'strike_dispute'
  status = 'open', // 'open' | 'resolved' | 'dismissed'
  createdAt = Date.now(),
  metadata = null
}) {
  const database = getRawDB();
  const metaStr = metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null;
  database
    .prepare(
      `
    INSERT INTO support_messages (id, bookingId, userId, phone, senderRole, senderName, message, type, status, createdAt, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .run(id, bookingId, userId, phone, senderRole, senderName, message, type, status, createdAt, metaStr);

  return {
    id,
    bookingId,
    userId,
    phone,
    senderRole,
    senderName,
    message,
    type,
    status,
    createdAt,
    metadata: metadata ? (typeof metadata === 'string' ? JSON.parse(metadata) : metadata) : null
  };
}

/**
 * Lấy lịch sử tin nhắn trò chuyện với Platform Support
 */
export function getSupportMessages({ bookingId, userId, phone, limit = 50 } = {}) {
  const database = getRawDB();
  const conditions = [];
  const params = [];

  if (bookingId) {
    conditions.push('bookingId = ?');
    params.push(bookingId);
  }
  if (userId) {
    conditions.push('userId = ?');
    params.push(userId);
  }
  if (phone) {
    conditions.push('phone = ?');
    params.push(phone);
  }

  let sql = 'SELECT * FROM support_messages';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' OR ');
  }
  sql += ' ORDER BY createdAt ASC LIMIT ?';
  params.push(limit);

  const rows = database.prepare(sql).all(...params);
  return rows.map((r) => ({
    ...r,
    metadata: r.metadata ? JSON.parse(r.metadata) : null
  }));
}

/**
 * Xử lý khiếu nại (Dispute) và gỡ khóa tài khoản (Unban) tự động hoặc theo phê duyệt
 */
export async function resolveDisputeAndUnban({ bookingId, userId, phone } = {}) {
  const database = getRawDB();
  // 1. Mở khóa booking nếu có
  if (bookingId) {
    const booking = getBookingById(bookingId);
    if (booking) {
      await updateBookingStatus(bookingId, booking.status, {
        isBanned: false,
        piiStrikes: {},
        disputeStatus: 'resolved',
        disputeResolvedAt: new Date().toISOString()
      });
    }
  }

  // 2. Mở khóa người dùng
  const targetKey = userId || phone;
  if (targetKey) {
    await updateUserStatus(targetKey, {
      isBanned: false,
      status: 'active',
      piiStrikes: 0,
      bannedAt: null,
      deactivateAt: null,
      trustScore: 98 // Phục hồi điểm tín nhiệm an toàn
    });
  }

  // 3. Đánh dấu các tin nhắn khiếu nại liên quan là resolved
  if (bookingId || userId || phone) {
    database
      .prepare(
        `
      UPDATE support_messages SET status = 'resolved'
      WHERE (bookingId = ? AND bookingId IS NOT NULL) OR (userId = ? AND userId IS NOT NULL) OR (phone = ? AND phone IS NOT NULL)
    `
      )
      .run(bookingId || null, userId || null, phone || null);
  }

  return { success: true, message: 'Đã xử lý khiếu nại và khôi phục tài khoản thành công.' };
}

/**
 * Gửi yêu cầu xóa tài khoản tới Quản trị viên CarMate
 * Bất biến & Công thái học: Không xóa tức thì, yêu cầu được tiếp nhận để đối soát nghĩa vụ & chuyến đi
 */
export async function createDeletionRequest({ userId, phone, name, email, reason = '' }) {
  const database = getRawDB();
  const id = `DEL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();

  // Kiểm tra nếu đã có yêu cầu xóa đang chờ xử lý (pending)
  const existingPending = database.prepare(
    `SELECT * FROM account_deletion_requests WHERE (userId = ? OR (phone = ? AND phone != '')) AND status = 'pending'`
  ).get(userId || '', phone || '');

  if (existingPending) {
    return {
      success: true,
      alreadyExists: true,
      data: existingPending,
      message: 'Bạn đã có một yêu cầu xóa tài khoản đang chờ Quản trị viên tiếp nhận và xử lý.'
    };
  }

  database.prepare(`
    INSERT INTO account_deletion_requests (id, userId, phone, name, email, reason, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(id, userId, phone || '', name || '', email || '', reason, now);

  const created = database.prepare('SELECT * FROM account_deletion_requests WHERE id = ?').get(id);
  return { success: true, alreadyExists: false, data: created };
}

/**
 * Lấy danh sách các yêu cầu xóa tài khoản dành cho Quản trị viên
 */
export function getDeletionRequests(status = '') {
  const database = getRawDB();
  if (status) {
    return database.prepare('SELECT * FROM account_deletion_requests WHERE status = ? ORDER BY createdAt DESC').all(status);
  }
  return database.prepare('SELECT * FROM account_deletion_requests ORDER BY createdAt DESC').all();
}

/**
 * Quản trị viên phê duyệt hoặc từ chối yêu cầu xóa tài khoản
 * Khi phê duyệt (action: 'approved'): Thực hiện xóa tài khoản, gỡ bài đăng và anonymize dữ liệu theo Nghị định 13/2023
 */
export async function processDeletionRequest(requestId, action, adminInfo = 'Admin') {
  const database = getRawDB();
  const req = database.prepare('SELECT * FROM account_deletion_requests WHERE id = ?').get(requestId);
  if (!req) {
    throw new Error('Không tìm thấy yêu cầu xóa tài khoản với mã ' + requestId);
  }

  const now = Date.now();
  if (action === 'approved') {
    // 1. Thực hiện xóa vĩnh viễn dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP
    await deleteUserAccount(req.userId, req.phone);

    // 2. Cập nhật trạng thái yêu cầu
    database.prepare(`
      UPDATE account_deletion_requests 
      SET status = 'approved', processedAt = ?, processedBy = ? 
      WHERE id = ?
    `).run(now, adminInfo, requestId);

    return {
      success: true,
      action: 'approved',
      message: 'Đã phê duyệt và xóa vĩnh viễn tài khoản thành công.'
    };
  } else if (action === 'rejected') {
    database.prepare(`
      UPDATE account_deletion_requests 
      SET status = 'rejected', processedAt = ?, processedBy = ? 
      WHERE id = ?
    `).run(now, adminInfo, requestId);

    return {
      success: true,
      action: 'rejected',
      message: 'Đã từ chối yêu cầu xóa tài khoản.'
    };
  } else {
    throw new Error('Hành động không hợp lệ (chỉ chấp nhận approved hoặc rejected).');
  }
}

/**
 * =========================================================================
 * KHỐI CHỨC NĂNG LEVEL 3: AUTONOMOUS ZERO-SEARCH MATCHING & GAME THEORY
 * =========================================================================
 */

/**
 * Tạo mới một Khai báo Ý định Di chuyển (Intent)
 */
export async function createIntent(intentData) {
  const database = getRawDB();
  const id = intentData.id || `INT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = Date.now();

  const full = {
    ...intentData,
    id,
    seats: Number(intentData.seats) || 1,
    isDoorstep: intentData.isDoorstep ? 1 : 0,
    doorstepAddress: intentData.doorstepAddress || '',
    doorstepLat: intentData.doorstepLat != null ? Number(intentData.doorstepLat) : null,
    doorstepLng: intentData.doorstepLng != null ? Number(intentData.doorstepLng) : null,
    status: intentData.status || 'pending',
    createdAt: intentData.createdAt || now
  };

  database
    .prepare(
      `
    INSERT OR REPLACE INTO intents (
      id, userId, role, originHubId, originName, destinationHubId, destinationName,
      corridor, date, timeSlot, seats, isDoorstep, doorstepAddress, doorstepLat, doorstepLng,
      phone, contactName, status, matchedTripId, matchedBookingId, createdAt, payload
    ) VALUES (
      @id, @userId, @role, @originHubId, @originName, @destinationHubId, @destinationName,
      @corridor, @date, @timeSlot, @seats, @isDoorstep, @doorstepAddress, @doorstepLat, @doorstepLng,
      @phone, @contactName, @status, @matchedTripId, @matchedBookingId, @createdAt, @payload
    )
  `
    )
    .run({
      id,
      userId: full.userId || '',
      role: full.role || 'passenger',
      originHubId: full.originHubId || '',
      originName: full.originName || '',
      destinationHubId: full.destinationHubId || '',
      destinationName: full.destinationName || '',
      corridor: full.corridor || 'Tuyến QL13',
      date: full.date || '',
      timeSlot: full.timeSlot || '',
      seats: full.seats,
      isDoorstep: full.isDoorstep,
      doorstepAddress: full.doorstepAddress,
      doorstepLat: full.doorstepLat,
      doorstepLng: full.doorstepLng,
      phone: cleanPhoneNumber(full.phone || ''),
      contactName: full.contactName || '',
      status: full.status,
      matchedTripId: full.matchedTripId || null,
      matchedBookingId: full.matchedBookingId || null,
      createdAt: full.createdAt,
      payload: JSON.stringify(full)
    });

  return full;
}

/**
 * Lấy danh sách các Intent theo bộ lọc (status, role, corridor, date)
 */
export function getIntents(filters = {}) {
  const database = getRawDB();
  const conditions = [];
  const params = [];

  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.role) {
    conditions.push('role = ?');
    params.push(filters.role);
  }
  if (filters.corridor) {
    conditions.push('corridor = ?');
    params.push(filters.corridor);
  }
  if (filters.date) {
    conditions.push('date = ?');
    params.push(filters.date);
  }
  if (filters.userId) {
    conditions.push('userId = ?');
    params.push(filters.userId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `SELECT payload FROM intents ${whereClause} ORDER BY createdAt ASC`;
  const rows = database.prepare(query).all(...params);

  return rows
    .map((r) => {
      try {
        return JSON.parse(r.payload);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Lấy chi tiết một Intent theo ID
 */
export function getIntentById(id) {
  const database = getRawDB();
  const row = database.prepare('SELECT payload FROM intents WHERE id = ?').get(id);
  if (!row) return null;
  try {
    return JSON.parse(row.payload);
  } catch {
    return null;
  }
}

/**
 * Cập nhật trạng thái và dữ liệu Intent
 */
export async function updateIntent(id, updates = {}) {
  const database = getRawDB();
  const row = database.prepare('SELECT payload FROM intents WHERE id = ?').get(id);
  if (!row) return null;

  try {
    const full = JSON.parse(row.payload);
    Object.assign(full, updates);

    database
      .prepare(
        `
      UPDATE intents 
      SET status = ?, matchedTripId = ?, matchedBookingId = ?, payload = ?
      WHERE id = ?
    `
      )
      .run(
        full.status || 'pending',
        full.matchedTripId || null,
        full.matchedBookingId || null,
        JSON.stringify(full),
        id
      );

    return full;
  } catch {
    return null;
  }
}

/**
 * Xóa một Intent
 */
export async function deleteIntent(id) {
  const database = getRawDB();
  const info = database.prepare('DELETE FROM intents WHERE id = ?').run(id);
  return info.changes > 0;
}

/**
 * Lưu trữ nhật ký một Phiên Khớp Lệnh (Matching Epoch)
 */
export async function createMatchingEpoch(epochData) {
  const database = getRawDB();
  const id = epochData.id || `EP-${Date.now()}`;
  const now = Date.now();

  database
    .prepare(
      `
    INSERT INTO matching_epochs (
      id, epochType, corridor, matchedCount, driverCount, passengerCount, createdAt, summary
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?
    )
  `
    )
    .run(
      id,
      epochData.epochType || 'micro_batch',
      epochData.corridor || 'Toàn sàn',
      Number(epochData.matchedCount || 0),
      Number(epochData.driverCount || 0),
      Number(epochData.passengerCount || 0),
      now,
      typeof epochData.summary === 'string' ? epochData.summary : JSON.stringify(epochData.summary || {})
    );

  return { id, createdAt: now, ...epochData };
}

/**
 * Lấy lịch sử các phiên khớp lệnh gần nhất
 */
export function getMatchingEpochs(limit = 20) {
  const database = getRawDB();
  return database.prepare('SELECT * FROM matching_epochs ORDER BY createdAt DESC LIMIT ?').all(limit);
}

/**
 * =========================================================================
 * KHỐI CHỨC NĂNG LEVEL 3.5: SÀN GIAO DỊCH GHẾ TRỐNG (SEAT EXCHANGE - LOB & CDA)
 * =========================================================================
 */

/**
 * Tạo mới một Lệnh trên Sàn Giao Dịch Ghế Trống (Ask hoặc Bid)
 */
export async function createExchangeOrderDb(orderData) {
  const database = getRawDB();
  const id = orderData.id || `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const now = Date.now();
  const full = {
    ...orderData,
    id,
    seats: Number(orderData.seats) || 1,
    remainingSeats: Number(orderData.remainingSeats ?? orderData.seats) || 1,
    status: orderData.status || 'OPEN',
    createdAt: orderData.createdAt || now
  };

  database
    .prepare(
      `
    INSERT OR REPLACE INTO seat_exchange_orders (
      id, userId, orderType, stationId, stationName, corridor, direction, date,
      targetTime, targetTimeMinutes, deltaMinutes, timeStartMins, timeEndMins,
      seats, remainingSeats, status, orderTier, ttlTimestamp, ttlTimeString,
      phone, contactName, plate, vehicleModel, trustScore,
      matchedWithOrderId, matchedBookingId, pinCode, rendezvousTime, rendezvousMinutes,
      createdAt, matchedAt, expiredAt, payload
    ) VALUES (
      @id, @userId, @orderType, @stationId, @stationName, @corridor, @direction, @date,
      @targetTime, @targetTimeMinutes, @deltaMinutes, @timeStartMins, @timeEndMins,
      @seats, @remainingSeats, @status, @orderTier, @ttlTimestamp, @ttlTimeString,
      @phone, @contactName, @plate, @vehicleModel, @trustScore,
      @matchedWithOrderId, @matchedBookingId, @pinCode, @rendezvousTime, @rendezvousMinutes,
      @createdAt, @matchedAt, @expiredAt, @payload
    )
  `
    )
    .run({
      id,
      userId: full.userId || '',
      orderType: full.orderType || 'BID',
      stationId: full.stationId || '',
      stationName: full.stationName || '',
      corridor: full.corridor || 'Tuyến QL13',
      direction: full.direction || '',
      date: full.date || '',
      targetTime: full.targetTime || '',
      targetTimeMinutes: full.targetTimeMinutes || 0,
      deltaMinutes: full.deltaMinutes || 10,
      timeStartMins: full.timeStartMins || 0,
      timeEndMins: full.timeEndMins || 0,
      seats: full.seats,
      remainingSeats: full.remainingSeats,
      status: full.status,
      orderTier: full.orderTier || 'SAFE_ADVANCE',
      ttlTimestamp: full.ttlTimestamp || null,
      ttlTimeString: full.ttlTimeString || '',
      phone: cleanPhoneNumber(full.phone || ''),
      contactName: full.contactName || '',
      plate: full.plate || '',
      vehicleModel: full.vehicleModel || '',
      trustScore: Number(full.trustScore || 98),
      matchedWithOrderId: full.matchedWithOrderId || null,
      matchedBookingId: full.matchedBookingId || null,
      pinCode: full.pinCode || null,
      rendezvousTime: full.rendezvousTime || null,
      rendezvousMinutes: full.rendezvousMinutes || null,
      createdAt: full.createdAt,
      matchedAt: full.matchedAt || null,
      expiredAt: full.expiredAt || null,
      payload: JSON.stringify(full)
    });

  return full;
}

/**
 * Lấy danh sách lệnh trên sàn giao dịch theo bộ lọc
 */
export function getExchangeOrdersDb(filters = {}) {
  const database = getRawDB();
  const conditions = [];
  const params = [];

  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.orderType) {
    conditions.push('orderType = ?');
    params.push(filters.orderType);
  }
  if (filters.corridor) {
    conditions.push('corridor = ?');
    params.push(filters.corridor);
  }
  if (filters.direction) {
    conditions.push('direction = ?');
    params.push(filters.direction);
  }
  if (filters.stationId) {
    conditions.push('stationId = ?');
    params.push(filters.stationId);
  }
  if (filters.date) {
    conditions.push('date = ?');
    params.push(filters.date);
  }
  if (filters.userId) {
    conditions.push('userId = ?');
    params.push(filters.userId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `SELECT payload FROM seat_exchange_orders ${whereClause} ORDER BY createdAt ASC`;
  const rows = database.prepare(query).all(...params);

  return rows
    .map((r) => {
      try {
        return JSON.parse(r.payload);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Lấy chi tiết lệnh theo ID
 */
export function getExchangeOrderByIdDb(id) {
  const database = getRawDB();
  const row = database.prepare('SELECT payload FROM seat_exchange_orders WHERE id = ?').get(id);
  if (!row) return null;
  try {
    return JSON.parse(row.payload);
  } catch {
    return null;
  }
}

/**
 * Cập nhật trạng thái lệnh (FILLED, PARTIALLY_FILLED, EXPIRED, CANCELLED)
 */
export async function updateExchangeOrderDb(id, updates = {}) {
  const current = getExchangeOrderByIdDb(id);
  if (!current) return null;
  const updated = { ...current, ...updates, updatedAt: Date.now() };

  const database = getRawDB();
  database
    .prepare(
      `
    UPDATE seat_exchange_orders
    SET status = ?, remainingSeats = ?, matchedWithOrderId = ?, matchedBookingId = ?,
        pinCode = ?, rendezvousTime = ?, rendezvousMinutes = ?, matchedAt = ?, expiredAt = ?, payload = ?
    WHERE id = ?
  `
    )
    .run(
      updated.status || 'OPEN',
      Number(updated.remainingSeats ?? updated.seats ?? 1),
      updated.matchedWithOrderId || null,
      updated.matchedBookingId || null,
      updated.pinCode || null,
      updated.rendezvousTime || null,
      updated.rendezvousMinutes || null,
      updated.matchedAt || null,
      updated.expiredAt || null,
      JSON.stringify(updated),
      id
    );

  return updated;
}

/**
 * Quét các lệnh OPEN trên sàn đã vượt quá TTL trượt động và chuyển sang EXPIRED
 */
export async function expireSlidingTTLOrdersDb(currentTimestamp = Date.now()) {
  const database = getRawDB();
  const rows = database
    .prepare(
      `
    SELECT payload FROM seat_exchange_orders
    WHERE (status = 'OPEN' OR status = 'PARTIALLY_FILLED') AND ttlTimestamp IS NOT NULL AND ttlTimestamp <= ?
  `
    )
    .all(currentTimestamp);

  const expiredList = [];
  for (const row of rows) {
    try {
      const order = JSON.parse(row.payload);
      order.status = 'EXPIRED';
      order.expiredAt = currentTimestamp;
      await updateExchangeOrderDb(order.id, {
        status: 'EXPIRED',
        expiredAt: currentTimestamp
      });
      expiredList.push(order);
    } catch {
      // Bỏ qua lỗi parse nếu có
    }
  }

  return expiredList;
}


/**
 * KHỚP LỆNH NGUYÊN TỬ (ATOMIC MATCH COMMIT — MIT INVARIANT)
 *
 * Một lần khớp lệnh gồm 3 thao tác ghi: cập nhật lệnh ASK, cập nhật lệnh BID và
 * tạo booking. Nếu ghi rời rạc, sự cố giữa chừng sẽ để lại ghế đã bị trừ mà KHÔNG
 * có booking — sàn rơi vào trạng thái mâu thuẫn (khách mất ghế nhưng không có vé).
 *
 * Hàm này gói cả 3 trong MỘT transaction SQLite: hoặc cả 3 cùng được ghi, hoặc
 * không gì được ghi. better-sqlite3 tự ROLLBACK khi callback ném lỗi.
 */
export function commitExchangeMatchDb({ askOrder, bidOrder, booking, isNewOrderAsk = false }) {
  const database = getRawDB();

  const run = database.transaction(() => {
    // Lệnh mới (chưa có trong DB) phải INSERT; lệnh đã nằm trên sàn thì UPDATE
    // để không xoá mất các trường không được truyền vào.
    if (isNewOrderAsk) {
      upsertExchangeOrderRow(database, askOrder);
      updateExchangeOrderRow(database, bidOrder.id, bidOrder);
    } else {
      upsertExchangeOrderRow(database, bidOrder);
      updateExchangeOrderRow(database, askOrder.id, askOrder);
    }

    const escrowId = booking.escrowId || `ESC-${Date.now()}`;
    const existing = database.prepare('SELECT payload FROM bookings WHERE escrowId = ?').get(escrowId);
    let accessToken = booking.accessToken;
    if (!accessToken && existing) {
      try {
        accessToken = JSON.parse(existing.payload)?.accessToken;
      } catch {
        accessToken = null;
      }
    }
    if (!accessToken) accessToken = crypto.randomBytes(16).toString('hex');

    const fullBooking = {
      ...booking,
      escrowId,
      accessToken,
      status: booking.status || 'zalo_active',
      commitmentType: booking.commitmentType || 'zalo_direct',
      createdAt: booking.createdAt || Date.now()
    };

    database
      .prepare(
        `INSERT OR REPLACE INTO bookings (escrowId, tripId, passengerPhone, status, createdAt, payload)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        escrowId,
        fullBooking.tripId || '',
        cleanPhoneNumber(fullBooking.passengerPhone || ''),
        fullBooking.status,
        fullBooking.createdAt,
        JSON.stringify(fullBooking)
      );

    return fullBooking;
  });

  return run();
}

/**
 * Ghi đè trọn vẹn một dòng lệnh (dùng cho lệnh MỚI vào sàn).
 */
function upsertExchangeOrderRow(database, order) {
  const full = {
    ...order,
    seats: Number(order.seats) || 1,
    remainingSeats: Number(order.remainingSeats ?? order.seats) || 0,
    status: order.status || 'OPEN',
    createdAt: order.createdAt || Date.now()
  };

  database
    .prepare(
      `INSERT OR REPLACE INTO seat_exchange_orders (
        id, userId, orderType, stationId, stationName, corridor, direction, date,
        targetTime, targetTimeMinutes, deltaMinutes, timeStartMins, timeEndMins,
        seats, remainingSeats, status, orderTier, ttlTimestamp, ttlTimeString,
        phone, contactName, plate, vehicleModel, trustScore,
        matchedWithOrderId, matchedBookingId, pinCode, rendezvousTime, rendezvousMinutes,
        createdAt, matchedAt, expiredAt, payload
      ) VALUES (
        @id, @userId, @orderType, @stationId, @stationName, @corridor, @direction, @date,
        @targetTime, @targetTimeMinutes, @deltaMinutes, @timeStartMins, @timeEndMins,
        @seats, @remainingSeats, @status, @orderTier, @ttlTimestamp, @ttlTimeString,
        @phone, @contactName, @plate, @vehicleModel, @trustScore,
        @matchedWithOrderId, @matchedBookingId, @pinCode, @rendezvousTime, @rendezvousMinutes,
        @createdAt, @matchedAt, @expiredAt, @payload
      )`
    )
    .run({
      id: full.id,
      userId: full.userId || '',
      orderType: full.orderType || 'BID',
      stationId: full.stationId || '',
      stationName: full.stationName || '',
      corridor: full.corridor || 'Tuyến QL13',
      direction: full.direction || '',
      date: full.date || '',
      targetTime: full.targetTime || '',
      targetTimeMinutes: full.targetTimeMinutes || 0,
      deltaMinutes: full.deltaMinutes || 10,
      timeStartMins: full.timeStartMins || 0,
      timeEndMins: full.timeEndMins || 0,
      seats: full.seats,
      remainingSeats: full.remainingSeats,
      status: full.status,
      orderTier: full.orderTier || 'SAFE_ADVANCE',
      ttlTimestamp: full.ttlTimestamp || null,
      ttlTimeString: full.ttlTimeString || '',
      phone: cleanPhoneNumber(full.phone || ''),
      contactName: full.contactName || '',
      plate: full.plate || '',
      vehicleModel: full.vehicleModel || '',
      trustScore: Number(full.trustScore || 98),
      matchedWithOrderId: full.matchedWithOrderId || null,
      matchedBookingId: full.matchedBookingId || null,
      pinCode: full.pinCode || null,
      rendezvousTime: full.rendezvousTime || null,
      rendezvousMinutes: full.rendezvousMinutes || null,
      createdAt: full.createdAt,
      matchedAt: full.matchedAt || null,
      expiredAt: full.expiredAt || null,
      payload: JSON.stringify(full)
    });

  return full;
}

/**
 * Cập nhật một lệnh ĐANG NẰM trên sàn — hợp nhất với payload cũ để không
 * xoá mất các trường không được truyền vào (khác hẳn INSERT OR REPLACE).
 */
function updateExchangeOrderRow(database, id, updates = {}) {
  const row = database.prepare('SELECT payload FROM seat_exchange_orders WHERE id = ?').get(id);
  if (!row) return null;

  let current = {};
  try {
    current = JSON.parse(row.payload);
  } catch {
    current = {};
  }

  const updated = { ...current, ...updates, id, updatedAt: Date.now() };

  database
    .prepare(
      `UPDATE seat_exchange_orders
       SET status = ?, remainingSeats = ?, matchedWithOrderId = ?, matchedBookingId = ?,
           pinCode = ?, rendezvousTime = ?, rendezvousMinutes = ?, matchedAt = ?, expiredAt = ?, payload = ?
       WHERE id = ?`
    )
    .run(
      updated.status || 'OPEN',
      Number(updated.remainingSeats ?? updated.seats ?? 1),
      updated.matchedWithOrderId || null,
      updated.matchedBookingId || null,
      updated.pinCode || null,
      updated.rendezvousTime || null,
      updated.rendezvousMinutes || null,
      updated.matchedAt || null,
      updated.expiredAt || null,
      JSON.stringify(updated),
      id
    );

  return updated;
}

/**
 * Lấy hồ sơ người dùng để GHI CHẾ TÀI, tự tạo hồ sơ tối thiểu nếu chưa có.
 *
 * CarMate cho phép đăng chuyến mà không cần đăng ký trước (Unified Auth /
 * Upsert Flow) — đó là chủ ý sản phẩm để giảm ma sát. Nhưng hệ quả là mọi
 * đường trừ điểm đều bọc `if (user) {...}`, nên chủ xe chưa có tài khoản
 * THOÁT TOÀN BỘ chế tài: huỷ sát giờ, bị tố giác nhồi nhét, bỏ bom khách —
 * không gì bám được vào họ. Ai muốn né phạt chỉ cần đừng bấm đăng nhập.
 *
 * Hàm này khép lỗ hổng đó mà không thêm bước đăng ký nào: khi cần ghi chế tài
 * cho một số điện thoại chưa có hồ sơ, tạo hồ sơ tối thiểu ngay tại chỗ. Lần
 * sau người đó đăng nhập bằng số ấy sẽ nhận đúng lịch sử tín nhiệm của mình.
 */
export async function getOrCreateUserForPenalty(phone, seed = {}) {
  const clean = cleanPhoneNumber(phone || '');
  if (!clean) return null;

  const existing = getUserByPhone(clean);
  if (existing) return existing;

  await saveUser({
    id: `USR-${clean}`,
    phone: clean,
    name: seed.name || '',
    role: seed.role || 'member',
    trustScore: 98,
    // Đánh dấu hồ sơ sinh tự động do chế tài, chưa từng đăng nhập.
    isAutoCreated: 1,
    createdAt: Date.now()
  });

  return getUserByPhone(clean);
}

/**
 * Áp dụng kỷ luật hủy chuyến theo hàm suy giảm thời gian (Time-Decay Penalty Engine)
 * - deltaMinutes > 120: An toàn 0đ, không phạt.
 * - 30 <= deltaMinutes <= 120: Cảnh cáo, trừ 15 điểm tín nhiệm.
 * - deltaMinutes < 30 hoặc sau khởi hành: Vi phạm nặng, trừ 40 điểm tín nhiệm, khoá 7 ngày.
 */
export async function applyCancellationPenalty(booking, cancellingUserPhone, deltaMinutes, cancellingRole = null) {
  const cleanPhone = cleanPhoneNumber(cancellingUserPhone);
  const isDriver =
    cancellingRole === 'driver' ||
    (cleanPhone && booking?.driverPhone && cleanPhoneNumber(booking.driverPhone) === cleanPhone);

  let penaltyTier = 'safe_free';
  let penaltyPoints = 0;
  let freezeDays = 0;
  let message = 'Huỷ chuyến an toàn trước > 2 tiếng. Không bị trừ điểm tín nhiệm.';

  if (deltaMinutes < 45) {
    // 1. GRIM TRIGGER (ĐÒN BẨY THẶNG DƯ TƯƠNG LAI):
    // Tước quyền tiếp cận dòng tiền thặng dư 4-5 triệu/tháng trong 30 ngày nếu chủ xe huỷ sát giờ
    penaltyTier = isDriver ? 'grim_trigger_freeze' : 'severe_freeze';
    penaltyPoints = isDriver ? 35 : 30;
    freezeDays = isDriver ? 30 : 7;
    message = isDriver
      ? 'KÍCH HOẠT GRIM TRIGGER: Chủ xe huỷ chuyến sát giờ (< 45 phút). Trừ 35 điểm tín nhiệm và tước quyền ưu tiên ghép cuốc trong 30 ngày (thiệt hại cơ hội ~4.4 triệu VNĐ). Hệ thống tự động chuyển làn cứu hộ khách.'
      : 'Huỷ chuyến sát giờ (< 45 phút). Trừ 30 điểm tín nhiệm và tạm khoá quyền đặt chuyến 7 ngày. Hệ thống đã kích hoạt Radar cứu hộ.';
  } else if (deltaMinutes <= 120) {
    penaltyTier = 'warning';
    penaltyPoints = isDriver ? 20 : 15;
    freezeDays = isDriver ? 14 : 0;
    message = isDriver
      ? 'Cảnh cáo chủ xe huỷ chuyến cận giờ (45 phút - 2 tiếng). Trừ 20 điểm tín nhiệm và giãn cách ghép chuyến 14 ngày.'
      : 'Cảnh cáo huỷ chuyến cận giờ (45 phút - 2 tiếng). Trừ 15 điểm tín nhiệm và giãn cách ưu tiên 24h.';
  }

  // Khấu trừ điểm tín nhiệm nếu có người dùng
  if (cleanPhone && penaltyPoints > 0) {
    // Tạo hồ sơ nếu chưa có, để chủ xe chưa đăng ký KHÔNG thoát chế tài.
    const user = await getOrCreateUserForPenalty(cleanPhone, { role: isDriver ? 'driver' : 'passenger' });
    if (user) {
      const currentScore = Number(user.trustScore ?? 98);
      const newScore = Math.max(10, currentScore - penaltyPoints);
      const userUpdates = {
        trustScore: newScore
      };

      if (freezeDays > 0) {
        userUpdates.freezeUntil = Date.now() + freezeDays * 24 * 3600 * 1000;
        userUpdates.freezeReason = message;
        userUpdates.isSuspended = true;
      }

      await saveUser({
        ...user,
        ...userUpdates
      });
    }
  }

  return {
    penaltyTier,
    penaltyPoints,
    freezeDays,
    isDriver,
    grimTriggerApplied: isDriver && freezeDays >= 30,
    message,
    deltaMinutes: Math.round(deltaMinutes)
  };
}

/**
 * Chuẩn hóa tên trạm để gom nhóm các yêu cầu trùng hoặc gần trùng
 */
function normalizeStationRequestName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Thêm hoặc gộp yêu cầu mở trạm ảo mới (Station Request Pool)
 * - Tự động gom nhóm dựa trên tên chuẩn hóa
 * - Tăng số lượt đề xuất (requestCount) khi có nhiều người cùng đề xuất
 * - Ngưỡng kích hoạt khảo sát: >= 50 lượt
 */
export async function addStationRequest({ stationName, note = '', lat = null, lng = null, userPhone = '' }) {
  const database = getRawDB();
  const rawName = String(stationName || '').trim();
  if (!rawName) {
    throw new Error('Tên trạm đề xuất không được để trống');
  }

  const cleanPhone = cleanPhoneNumber(userPhone || '');
  const normName = normalizeStationRequestName(rawName);
  const now = Date.now();

  // Kiểm tra xem đã có trạm tương tự trong pool chưa
  const existing = database
    .prepare('SELECT * FROM station_requests WHERE normalizedName = ? OR stationName LIKE ? LIMIT 1')
    .get(normName, rawName);

  if (existing) {
    let phones = [];
    try {
      const payload = existing.payload ? JSON.parse(existing.payload) : {};
      phones = Array.isArray(payload.phones) ? payload.phones : [];
    } catch {
      phones = [];
    }

    if (cleanPhone && !phones.includes(cleanPhone)) {
      phones.push(cleanPhone);
    }

    const newCount = (existing.requestCount || 1) + 1;
    const newStatus = newCount >= 50 && existing.status === 'pending' ? 'threshold_met' : existing.status;

    const payloadStr = JSON.stringify({
      phones,
      lastNote: note || existing.note || '',
      history: [
        { at: now, phone: cleanPhone, note: note || '' }
      ]
    });

    database
      .prepare(`
        UPDATE station_requests
        SET requestCount = ?,
            status = ?,
            updatedAt = ?,
            note = CASE WHEN (note IS NULL OR note = '') AND ? != '' THEN ? ELSE note END,
            lat = COALESCE(?, lat),
            lng = COALESCE(?, lng),
            payload = ?
        WHERE id = ?
      `)
      .run(newCount, newStatus, now, note, note, lat != null ? Number(lat) : null, lng != null ? Number(lng) : null, payloadStr, existing.id);

    return {
      ...existing,
      requestCount: newCount,
      status: newStatus,
      updatedAt: now,
      isGrouped: true
    };
  }

  // Tạo yêu cầu mới
  const id = `STR-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const payloadStr = JSON.stringify({
    phones: cleanPhone ? [cleanPhone] : [],
    history: [{ at: now, phone: cleanPhone, note: note || '' }]
  });

  database
    .prepare(`
      INSERT INTO station_requests (
        id, stationName, normalizedName, note, lat, lng, userPhone,
        requestCount, status, createdAt, updatedAt, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'pending', ?, ?, ?)
    `)
    .run(
      id,
      rawName,
      normName,
      note || '',
      lat != null ? Number(lat) : null,
      lng != null ? Number(lng) : null,
      cleanPhone,
      now,
      now,
      payloadStr
    );

  return {
    id,
    stationName: rawName,
    normalizedName: normName,
    note,
    lat: lat != null ? Number(lat) : null,
    lng: lng != null ? Number(lng) : null,
    userPhone: cleanPhone,
    requestCount: 1,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    isGrouped: false
  };
}

/**
 * Lấy danh sách các đề xuất mở trạm mới
 */
export function getStationRequests(status = '') {
  const database = getRawDB();
  if (status) {
    return database
      .prepare('SELECT * FROM station_requests WHERE status = ? ORDER BY requestCount DESC, updatedAt DESC')
      .all(status);
  }
  return database
    .prepare('SELECT * FROM station_requests ORDER BY requestCount DESC, updatedAt DESC')
    .all();
}

/**
 * Cập nhật trạng thái đề xuất trạm (pending, surveying, approved, rejected)
 */
export async function updateStationRequestStatus(id, status, adminNote = '') {
  const database = getRawDB();
  const now = Date.now();
  database
    .prepare('UPDATE station_requests SET status = ?, updatedAt = ? WHERE id = ?')
    .run(status, now, id);
  return { id, status, updatedAt: now, adminNote };
}

/**
 * Thông báo chuẩn về giới hạn 2 lượt di chuyển/ngày
 */
export const DRIVER_DAILY_CAP_NOTICE =
  '⛔ Giới hạn 2 lượt di chuyển/ngày: Theo Nghị định 10/2020/NĐ-CP và Điều 3 Bộ Luật Dân sự 2015, CarMate là nền tảng chia sẻ chi phí hành trình cá nhân (sáng đi làm - chiều về nhà). Mỗi chủ xe chỉ được tạo tối đa 2 chuyến/ngày để bảo đảm bản chất dân sự phi thương mại. Xe chạy tần suất cao bị từ chối để tránh biến tướng thành xe vận tải chuyên nghiệp.';

/**
 * Đếm số chuyến chủ xe đã đăng hoặc thực hiện trong ngày (Anti-Commercial Capping)
 * @param {string} phone - Số điện thoại chủ xe
 * @param {string} targetDate - Ngày mục tiêu (mặc định hôm nay)
 * @returns {number} Số chuyến trong ngày
 */
export function getDailyDriverTripCount(phone, targetDate = '') {
  const database = getRawDB();
  const clean = cleanPhoneNumber(phone || '');
  if (!clean) return 0;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = startOfDay + 24 * 3600 * 1000 - 1;

  const cleanDate = String(targetDate || '').trim();
  const isToday = !cleanDate || cleanDate === 'Hôm nay';

  const sql = isToday
    ? `
      SELECT COUNT(*) as count FROM trips
      WHERE (phoneReal = ? OR phoneReal = ?)
        AND type = 'driver_offer'
        AND status != 'cancelled'
        AND (
          (createdAt >= ? AND createdAt <= ?)
          OR date = 'Hôm nay'
        )
    `
    : `
      SELECT COUNT(*) as count FROM trips
      WHERE (phoneReal = ? OR phoneReal = ?)
        AND type = 'driver_offer'
        AND status != 'cancelled'
        AND (date = ? OR date = ?)
    `;

  const params = isToday
    ? [clean, '0' + clean.replace(/^0/, ''), startOfDay, endOfDay]
    : [clean, '0' + clean.replace(/^0/, ''), cleanDate, cleanDate];

  const res = database.prepare(sql).get(...params);
  return res?.count || 0;
}

/**
 * Kiểm tra xem chủ xe có bị giới hạn chuyến hay không.
 * Theo yêu cầu: CarMate không giới hạn số chuyến, chủ xe tự chịu trách nhiệm dân sự về tần suất di chuyển.
 */
export function isDriverDailyTripCapped(_phone, _targetDate = '') {
  return false;
}

/**
 * Ghi nhận sự cố chuyến đi (Unhappy Cases) vào cơ sở dữ liệu
 */
export async function reportTripIncidentDb(incident) {
  const db = getRawDB();
  const id = incident.id || `inc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const record = {
    id,
    bookingId: incident.bookingId || null,
    tripId: incident.tripId || null,
    incidentType: incident.incidentType,
    reporterRole: incident.reporterRole || 'Chủ xe',
    reporterPhone: incident.reporterPhone ? cleanPhoneNumber(incident.reporterPhone) : null,
    riderPhone: incident.riderPhone ? cleanPhoneNumber(incident.riderPhone) : null,
    driverPhone: incident.driverPhone ? cleanPhoneNumber(incident.driverPhone) : null,
    sanctionAction: incident.sanctionAction || null,
    driverPenalty: Number(incident.driverPenalty || 0),
    riderPenalty: Number(incident.riderPenalty || 0),
    fareExempt: incident.fareExempt ? 1 : 0,
    isBanned: incident.isBanned ? 1 : 0,
    note: incident.note || null,
    createdAt: incident.createdAt || now,
    payload: JSON.stringify(incident)
  };

  db.prepare(`
    INSERT INTO trip_incidents (
      id, bookingId, tripId, incidentType, reporterRole, reporterPhone,
      riderPhone, driverPhone, sanctionAction, driverPenalty, riderPenalty,
      fareExempt, isBanned, note, createdAt, payload
    ) VALUES (
      @id, @bookingId, @tripId, @incidentType, @reporterRole, @reporterPhone,
      @riderPhone, @driverPhone, @sanctionAction, @driverPenalty, @riderPenalty,
      @fareExempt, @isBanned, @note, @createdAt, @payload
    )
  `).run(record);

  return record;
}

/**
 * Truy vấn danh sách sự cố chuyến đi
 */
export function getTripIncidents({ riderPhone, driverPhone, incidentType, limit = 50 } = {}) {
  const db = getRawDB();
  let sql = 'SELECT * FROM trip_incidents WHERE 1=1';
  const params = [];

  if (riderPhone) {
    sql += ' AND riderPhone = ?';
    params.push(cleanPhoneNumber(riderPhone));
  }
  if (driverPhone) {
    sql += ' AND driverPhone = ?';
    params.push(cleanPhoneNumber(driverPhone));
  }
  if (incidentType) {
    sql += ' AND incidentType = ?';
    params.push(incidentType);
  }

  sql += ' ORDER BY createdAt DESC LIMIT ?';
  params.push(Number(limit));

  const rows = db.prepare(sql).all(...params);
  return rows.map(r => {
    try {
      return { ...JSON.parse(r.payload), ...r };
    } catch {
      return r;
    }
  });
}

/**
 * Permaban vĩnh viễn người dùng (áp dụng cho hành vi quỵt tiền phụ xăng UNPAID_FARE_FRAUD)
 */
export async function permabanUser(phone, reason = 'UNPAID_FARE_FRAUD') {
  if (!phone) return null;
  const cleanPhone = cleanPhoneNumber(phone);
  const user = getUserByPhone(cleanPhone);
  const userId = user?.id || cleanPhone;

  const updated = await updateUserStatus(userId, {
    isBanned: true,
    status: 'banned',
    bannedAt: new Date().toISOString(),
    banReason: reason,
    trustScore: 0
  });

  return updated;
}

export { updateUserStatus as updateUser };

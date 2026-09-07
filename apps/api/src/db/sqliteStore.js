import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  INITIAL_DRIVER_OFFERS,
  INITIAL_PASSENGER_REQUESTS,
  INITIAL_BOOKED_ESCROWS,
  SITE_INFO,
  cleanPhoneNumber,
  isTripExpired,
  getTomorrowISO
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
  } catch (migErr) {
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

  // 7. Tự động chuyển đổi dữ liệu từ file JSON cũ sang SQLite (Migration)
  const tripCount = db.prepare('SELECT COUNT(*) as count FROM trips').get().count;
  if (tripCount === 0) {
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

  const completeTrip = {
    ...tripData,
    id,
    maskedCode,
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

export async function updateTrip(id, updates) {
  const existing = getTripById(id);
  if (!existing) return null;

  const merged = { ...existing, ...updates, updatedAt: Date.now() };
  await addTrip(merged);
  return merged;
}

/**
 * Tái đăng 1 chạm (1-Tap Re-publish) chuyến xe sang ngày mới
 * Giúp tài xế nhân bản toàn bộ thông tin lộ trình, xe, giá sang ngày mai chỉ trong 1 chạm.
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
  const full = {
    ...bookingData,
    escrowId,
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
  if (
    user?.role === 'admin' ||
    (effectivePhone && (effectivePhone.includes('0984883750') || effectivePhone.includes('0984 883 750')))
  ) {
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

export function getTripsByPhone(phone) {
  const database = getRawDB();
  const clean = cleanPhoneNumber(phone);
  if (!clean) return [];

  const rows = database
    .prepare('SELECT payload FROM trips WHERE phoneReal = ? OR userId = ? ORDER BY createdAt DESC')
    .all(clean, 'USR-' + clean);
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
          phone: t.phoneReal || t.phone || '0984883750',
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

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  INITIAL_DRIVER_OFFERS,
  INITIAL_PASSENGER_REQUESTS,
  INITIAL_BOOKED_ESCROWS,
  SITE_INFO,
  cleanPhoneNumber
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

  // 5. Tự động chuyển đổi dữ liệu từ file JSON cũ sang SQLite (Migration)
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
        if (Array.isArray(legacy.passengerRequests) && legacy.passengerRequests.length > 0) initialPassengers = legacy.passengerRequests;
        if (Array.isArray(legacy.bookings) && legacy.bookings.length > 0) initialBookings = legacy.bookings;
        if (Array.isArray(legacy.users) && legacy.users.length > 0) initialUsers = legacy.users;
        console.log(`[SQLite DB] Đọc thành công dữ liệu di chuyển (${initialDrivers.length} chủ xe, ${initialPassengers.length} khách, ${initialBookings.length} lượt ghép)`);
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

  return db;
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
      avgRating: SITE_INFO.stats.avgRating,
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

  sql += ' ORDER BY createdAt DESC';

  const rows = database.prepare(sql).all(...params);
  let list = rows.map(rowToTrip).filter(Boolean);

  if (filters.q && filters.q.trim()) {
    const kw = filters.q.trim().toLowerCase();
    list = list.filter((item) => {
      const searchTarget = `${item.from} ${item.to} ${item.routeCategory} ${item.hometown || ''} ${item.notes || ''}`.toLowerCase();
      return searchTarget.includes(kw);
    });
  }

  return list;
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
  const maskedCode = tripData.maskedCode || `${tripData.type === 'passenger_request' ? 'HK' : 'CX'}-${Math.floor(100 + Math.random() * 900)}`;
  const completeTrip = {
    ...tripData,
    id,
    maskedCode,
    phoneReal: cleanPhone,
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
    timeSlot: completeTrip.timeSlot || '07:00-08:00',
    date: completeTrip.date || 'Hôm nay',
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

export async function deleteTrip(id) {
  const database = getRawDB();
  const info = database.prepare('DELETE FROM trips WHERE id = ?').run(id);
  return info.changes > 0;
}

export function getBookings() {
  const database = getRawDB();
  const rows = database.prepare('SELECT payload FROM bookings ORDER BY createdAt DESC').all();
  return rows.map((r) => {
    try {
      return JSON.parse(r.payload);
    } catch {
      return null;
    }
  }).filter(Boolean);
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

  database.prepare(`
    INSERT OR REPLACE INTO bookings (escrowId, tripId, passengerPhone, status, createdAt, payload)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    escrowId,
    full.tripId || '',
    cleanPhoneNumber(full.passengerPhone || ''),
    full.status || 'zalo_active',
    full.createdAt,
    JSON.stringify(full)
  );

  return full;
}

export async function updateBookingStatus(id, status, extra = {}) {
  const database = getRawDB();
  const row = database.prepare('SELECT payload FROM bookings WHERE escrowId = ?').get(id);
  if (!row) return null;

  try {
    const full = JSON.parse(row.payload);
    full.status = status;
    Object.assign(full, extra);

    database.prepare(`
      UPDATE bookings SET status = ?, payload = ? WHERE escrowId = ?
    `).run(status, JSON.stringify(full), id);

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

export async function saveUser(user) {
  const database = getRawDB();
  const clean = cleanPhoneNumber(user.phone);
  const id = user.id || (clean ? 'USR-' + clean : 'USR-' + Date.now());
  const now = new Date().toISOString();

  const full = {
    ...user,
    id,
    phone: clean,
    updatedAt: now,
    createdAt: user.createdAt || now
  };

  database.prepare(`
    INSERT OR REPLACE INTO users (
      id, phone, name, role, avatar, trustScore, isCccdVerified, isGplxVerified, isBanned, createdAt, updatedAt, payload
    ) VALUES (
      @id, @phone, @name, @role, @avatar, @trustScore, @isCccdVerified, @isGplxVerified, @isBanned, @createdAt, @updatedAt, @payload
    )
  `).run({
    id,
    phone: clean,
    name: full.name || 'Thành viên ' + clean.slice(-4),
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

export function getTripsByPhone(phone) {
  const database = getRawDB();
  const clean = cleanPhoneNumber(phone);
  if (!clean) return [];

  const rows = database.prepare('SELECT payload FROM trips WHERE phoneReal = ? OR userId = ? ORDER BY createdAt DESC').all(clean, 'USR-' + clean);
  return rows.map((r) => {
    try {
      return JSON.parse(r.payload);
    } catch {
      return null;
    }
  }).filter(Boolean);
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
  const row = database.prepare('SELECT payload FROM users WHERE id = ? OR phone = ?').get(userId, cleanPhoneNumber(userId));
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
    database.prepare('UPDATE trips SET isBanned = ? WHERE phoneReal = ? OR userId = ?').run(isBannedInt, cleanPhoneNumber(found.phone), userId);
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
  const activeTripsCount = database.prepare('SELECT COUNT(*) as count FROM trips WHERE isHidden = 0 AND isBanned = 0 AND status = ?').get('active').count;
  const totalBookingsCount = database.prepare('SELECT COUNT(*) as count FROM bookings').get().count;
  const completedBookingsCount = database.prepare('SELECT COUNT(*) as count FROM bookings WHERE status = ?').get('completed').count;
  const activeBookingsCount = database.prepare('SELECT COUNT(*) as count FROM bookings WHERE status = ?').get('zalo_active').count;

  const allUsersList = getAllUsers();
  const totalMembersCount = allUsersList.length;
  const verifiedDriversCount = allUsersList.filter(u => u.isCccdVerified && u.isGplxVerified).length;

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

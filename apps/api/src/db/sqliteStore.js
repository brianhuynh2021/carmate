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
  getTripEndTimestamp,
  getTomorrowISO,
  DEFAULT_TRUST_RULES,
  sanitizeTimeLabel,
  VERIFIED_HOTLINES,
  setDailyFuelPrice,
  getDailyFuelPrice,
  resetDailyFuelPrice,
  DEFAULT_DAILY_FUEL_PRICE,
  getTariffParams,
  setTariffParams,
  resetTariffParams,
  validateTariffParams,
  DEFAULT_TARIFF_PARAMS
} from '@carmate/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(process.env.CARMATE_DATA_DIR || path.resolve(__dirname, '../../data'));
const DB_PATH = path.join(DATA_DIR, 'carmate.sqlite');
const LEGACY_JSON_FILE = path.join(DATA_DIR, 'carmate_db.json');

let db = null;

/**
 * Initializes the SQLite database in WAL Mode (Write-Ahead Logging)
 * Production standard: handles thousands of concurrent queries, absolutely safe, no file locking.
 */
export async function initDB() {
  if (db) return db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);

  // Enable WAL Mode & performance tuning
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  // Merge the WAL back into the main file after every ~1000 pages (~4MB) so the WAL does not grow without bound.
  // Without this mark, carmate.sqlite-wal can grow larger than the main DB.
  db.pragma('wal_autocheckpoint = 1000');
  db.pragma('cache_size = -64000'); // 64MB cache
  db.pragma('foreign_keys = ON');

  // 1. Create the Trips table (trips)
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

  // 2. Create the Members table (users)
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

  // Safe migration for existing databases that do not yet have the email column
  try {
    const userColumns = db.pragma('table_info(users)').map((col) => col.name);
    if (!userColumns.includes('email')) {
      db.exec('ALTER TABLE users ADD COLUMN email TEXT');
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
  } catch {
    // Ignore if it already exists or is running inside a transaction
  }

  // 3. Create the Matching & Trip Booking table (bookings)
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

    // Migration adding the Level 3 columns to bookings if they are not present yet
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
      // Ignore if it already exists
    }

    // 4. Metadata & Configuration table (key_values)
    db.exec(`
      CREATE TABLE IF NOT EXISTS key_values (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // 5. AI Trajectory Storage table (ai_trajectories - MIT & Stanford Observability)
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

    // 6. Behavior Analytics & Funnel table (analytics_events)
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

    // 7. Chat & Complaints table with Platform Customer Support (support_messages)
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

    // 8. Account Deletion Requests Sent to the Admin table (account_deletion_requests)
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

    // 9. Movement Intent Declarations table (intents - Zero-Search Autonomous Engine)
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

    // 10. Matching Session Storage table (matching_epochs)
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

    // 11. New Virtual Station Request Aggregation table (station_requests - Hard Whitelist & Zero Roadside Stops)
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

    // 12. Two-Sided Order Book & Continuous Matching table (seat_exchange_orders - LOB & CDA Spot Market)
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

    // 13. Route Incident Management & Unhappy Cases Penalties table (trip_incidents)
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

  // 9. Seed initial data (Seed) — development environment only
  //
  // MARKETPLACE INVARIANT: every trip displayed on the marketplace must be reachable by
  // a real person. The sample data violates this invariant — a passenger who taps to book would call
  // a number with no one answering, destroying trust on the very first use.
  //
  // Sample data is disabled by default in every environment. It is only loaded when
  // SEED_DEMO_DATA=true is deliberately set, so that a preview does not accidentally create a source of vehicles.
  const tripCount = db.prepare('SELECT COUNT(*) as count FROM trips').get().count;
  const demoSeedAllowed = process.env.SEED_DEMO_DATA === 'true';

  if (tripCount === 0 && !demoSeedAllowed) {
    console.log(
      '[SQLite DB] Sàn khởi tạo trống: bỏ qua dữ liệu mẫu để không hiển thị chuyến ảo.'
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

    // Load bookings
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

    // Load users
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

  // Automatically clean up old HTML entities (such as &#x2F;) in the DB if any
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

  // Resync the departure date & recurring attributes for the sample trips (DRV-101, REQ-201...)
  try {
    const allSeeds = [...INITIAL_DRIVER_OFFERS, ...INITIAL_PASSENGER_REQUESTS];
    const updateStmt = db.prepare(`
      UPDATE trips 
      SET date = ?, timeSlot = ?, price = ?, payload = ?
      WHERE id = ?
    `);
    // Sample trips of routes that were removed from mockData (outside the corridor with real virtual stations)
    // must disappear from the marketplace, otherwise they stay forever in SQLite and
    // display like real trips that the platform cannot serve.
    // ONLY delete the exact seed IDs that HAVE ONCE been in mockData and have now been removed.
    // Absolutely do not detect by ID pattern: real trips created by an Admin also carry the form
    // `DRV-<timestamp>` (adminController.js), so a GLOB 'DRV-[0-9]*' would sweep
    // away users' real trips on every server start.
    const liveSeedIds = new Set(allSeeds.map((s) => s.id));
    const RETIRED_SEED_IDS = [
      'DRV-103', 'DRV-104', 'DRV-106', 'DRV-108', 'DRV-110', 'DRV-111',
      'REQ-203', 'REQ-204', 'REQ-205'
    ];
    const staleSeeds = RETIRED_SEED_IDS.filter((id) => !liveSeedIds.has(id));

    const deleteTripStmt = db.prepare('DELETE FROM trips WHERE id = ?');
    // The targetTripId column only exists in some DB versions: probe first, because prepare() with a column
    // that does not exist throws immediately rather than waiting until run time.
    const bookingCols = db.prepare('PRAGMA table_info(bookings)').all().map((c) => c.name);
    const hasTargetTripId = bookingCols.includes('targetTripId');
    const deleteBookingStmt = hasTargetTripId
      ? db.prepare('DELETE FROM bookings WHERE tripId = ? OR targetTripId = ?')
      : db.prepare('DELETE FROM bookings WHERE tripId = ?');

    const syncSeeds = db.transaction(() => {
      for (const s of allSeeds) {
        const price = Number(s.basePricePerSeat || s.expectedPrice || 0) || null;
        updateStmt.run(s.date || 'Hôm nay', s.timeSlot || '07:00-08:00', price, JSON.stringify(s), s.id);
      }
      for (const id of staleSeeds) {
        if (hasTargetTripId) deleteBookingStmt.run(id, id);
        else deleteBookingStmt.run(id);
        deleteTripStmt.run(id);
      }
    });
    syncSeeds();
    if (staleSeeds.length > 0) {
      console.log(`[SQLite DB] Đã gỡ ${staleSeeds.length} chuyến mẫu của tuyến không còn phục vụ.`);
    }
  } catch (err) {
    console.warn('[SQLite DB] Bỏ qua đồng bộ seed:', err.message);
  }

  // Sync the fuel price stored in key_values into the dynamicTariff in-memory engine
  try {
    const fuelConfig = getDailyFuelPriceConfig();
    if (fuelConfig && fuelConfig.ron95Price) {
      setDailyFuelPrice(
        fuelConfig.ron95Price,
        fuelConfig.updatedAt,
        fuelConfig.updatedBy || 'system',
        fuelConfig.source || 'sqlite'
      );
      console.log(
        `\x1b[33m[Fuel Engine]\x1b[0m Giá xăng RON 95 nạp thành công: ${new Intl.NumberFormat('vi-VN').format(fuelConfig.ron95Price)}đ/Lít (${fuelConfig.isDefault ? 'Mặc định' : 'Do Admin cấu hình'})`
      );
    }
  } catch (err) {
    console.warn('[SQLite DB] Không thể nạp daily_fuel_price ban đầu:', err.message);
  }

  // Load the pricing formula parameter set configured by the admin
  try {
    const tariffConfig = getTariffParamsConfig();
    if (tariffConfig && !tariffConfig.isDefault) {
      setTariffParams(tariffConfig, tariffConfig.updatedAt, tariffConfig.updatedBy || 'admin', 'sqlite');
      console.log(
        `\x1b[33m[Tariff Engine]\x1b[0m Công thức định giá nạp từ cấu hình Quản trị viên (cập nhật ${tariffConfig.updatedAt})`
      );
    }
  } catch (err) {
    console.warn('[SQLite DB] Không thể nạp tariff_params ban đầu:', err.message);
  }

  return db;
}

/**
 * Merges the whole WAL into the main file and then closes the connection.
 * Call when shutting down the server so data sits fully in carmate.sqlite,
 * avoiding the loss of transactions stuck in the WAL if the volume is destroyed.
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
 * Compatibility getDB() for the controllers:
 * Provides a dynamic getter to access db.driverOffers, db.passengerRequests, db.bookings, db.users
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
// ASYNC CRUD FUNCTIONS FOR BUSINESS LOGIC (COMPATIBLE API)
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
    obj.availableSeats = row.seats ?? obj.availableSeats;
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

  // By default, automatically drop trips that have expired (>30 minutes after departure time)
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

  // `status` used to be silently swallowed: the caller passes it in, the SQL does not read it, no error
  // and no warning — so every call filtering by status received cancelled trips
  // and full trips as well while believing it had filtered.
  // (isHidden already has its own `includeHidden` branch below, so it is not added here.)
  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }

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

  // By default, filter out trips past their time so marketplace data always stays fresh
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
  const id = tripData.id || `${tripData.type === 'passenger_request' ? 'REQ' : 'DRV'}-${crypto.randomUUID()}`;
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
    // Use ?? and NOT ||: a seat count of 0 (a trip that is full) is a valid value,
    // with || it is treated as falsy and overwritten to 1, so a full trip would still show seats left
    // and accept unlimited extra bookings.
    seats: Number(completeTrip.availableSeats ?? completeTrip.seatsNeeded ?? 1),
    carCategory: completeTrip.carCategory || 'family_car',
    carType: completeTrip.carType || 'Xe 7 chỗ',
    isHidden: completeTrip.isHidden ? 1 : 0,
    isBanned: completeTrip.isBanned ? 1 : 0,
    createdAt: completeTrip.createdAt,
    payload: JSON.stringify(completeTrip)
  });

  return completeTrip;
}

// Identity / ownership fields must NEVER be accepted from the client via updateTrip.
// Prevents Mass-Assignment: a post owner changing phoneReal to someone else's number, taking over userId, self-raising trustScore...
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

  // Strip every immutable field from the client payload before merging.
  const safeUpdates = {};
  for (const key of Object.keys(updates || {})) {
    if (!IMMUTABLE_TRIP_FIELDS.has(key)) {
      safeUpdates[key] = updates[key];
    }
  }

  const merged = {
    ...existing,
    ...safeUpdates,
    // Ownership & identity are always inherited from the original record in the DB.
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
 * 1-Tap Re-publish of a trip to a new date
 * Lets the driver clone all route, vehicle and price information to tomorrow in just 1 tap.
 */
/**
 * =============================================================================
 * CLOSING OUT TRIPS THAT HAVE FINISHED (TRIP LIFECYCLE SWEEP)
 * =============================================================================
 * Previously the system replaced "closing a trip" with "hiding a trip": getTrips()
 * filters isTripExpired() at the read layer so the UI looks clean, while in the DB every
 * trip stays `active` forever. Consequences that cannot be seen by eye:
 *
 *   - Every `WHERE status = 'active'` query also counts trips that have already finished,
 *     so a rescue vehicle could be dispatched from a trip from last month.
 *   - Weekly recurring trips are exempted by isTripExpired(), so they escape both the display
 *     filter and the lifecycle — showing on the marketplace forever with last week's date.
 *
 * This function is the ONLY actor that closes out trips by time:
 *   - Past end time + GRACE_HOURS with passengers booked  ➔ completed
 *   - Past end time + GRACE_HOURS with no one booked      ➔ expired
 *   - Weekly recurring trip                               ➔ pushed to next week
 *
 * A 6-hour tolerance so that a driver running an afternoon trip can still make it back, and so that a trip
 * departing at midnight is not closed right as it starts rolling.
 */
export const TRIP_CLOSE_GRACE_HOURS = 6;

/** Whether a trip is a weekly recurring trip (same rule as isTripExpired). */
function isRecurringTrip(trip) {
  return Boolean(
    trip.isRecurringWeekly ||
      (trip.date && (String(trip.date).includes('hàng tuần') || String(trip.date).includes('Lặp lại')))
  );
}

/**
 * Scans and closes out every trip that is past its time.
 * @param {object} options
 * @param {number} options.nowMs - The timestamp treated as "now" (for testing)
 * @param {number} options.graceHours - Tolerance after the end time
 * @param {boolean} options.dryRun - Only list, do not write
 * @returns {{completed: string[], expired: string[], rolled: string[]}}
 */
export function sweepFinishedTrips({ nowMs = Date.now(), graceHours = TRIP_CLOSE_GRACE_HOURS, dryRun = false } = {}) {
  const database = getRawDB();
  const result = { completed: [], expired: [], rolled: [] };

  // Only consider trips that are still open: those already cancelled/completed/expired are left alone.
  // The comparison is case-insensitive because old data contains both 'OPEN' and 'active'
  // — a trip written in upper case that slipped through would be stuck forever, exactly the bug being fixed.
  const rows = database
    .prepare("SELECT * FROM trips WHERE LOWER(status) IN ('active', 'full', 'open')")
    .all()
    .map(rowToTrip)
    .filter(Boolean);

  if (rows.length === 0) return result;

  const graceMs = Math.max(0, graceHours) * 60 * 60 * 1000;
  const allBookings = getBookings();

  const updateStmt = database.prepare('UPDATE trips SET status = ?, payload = ? WHERE id = ?');
  const rollStmt = database.prepare('UPDATE trips SET date = ?, payload = ? WHERE id = ?');

  const apply = database.transaction((jobs) => {
    for (const job of jobs) {
      if (job.kind === 'roll') rollStmt.run(job.date, JSON.stringify(job.payload), job.id);
      else updateStmt.run(job.status, JSON.stringify(job.payload), job.id);
    }
  });

  const jobs = [];

  for (const trip of rows) {
    // A schedule timeout cannot complete a live passenger commitment.
    if (allBookings.some(b => b.tripId === trip.id && (b.bothConfirmed || b.seatReserved) && !['cancelled','completed','expired'].includes(b.status))) continue;
    const endMs = getTripEndTimestamp(trip, new Date(nowMs));
    if (!Number.isFinite(endMs) || nowMs <= endMs + graceMs) continue;

    // Recurring trip: push to next week instead of closing, otherwise a driver who runs the same trip
    // every week would lose the familiar trip and have to repost it by hand.
    if (isRecurringTrip(trip)) {
      const nextDate = new Date(endMs);
      // Jump week by week until past the present (a trip neglected for several weeks)
      while (nextDate.getTime() + graceMs <= nowMs) {
        nextDate.setDate(nextDate.getDate() + 7);
      }
      const isoDate = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(
        nextDate.getDate()
      ).padStart(2, '0')}`;
      // Keep the recurrence marker: some trips are only recognized through the string "Lặp lại hàng
      // tuần" ("Repeats weekly") inside the date field itself. Overwriting date with a concrete date would erase
      // that marker, and on the next sweep the trip would be closed outright instead of continuing to roll.
      const payload = {
        ...trip,
        date: isoDate,
        isRecurringWeekly: true,
        rolledOverAt: new Date(nowMs).toISOString()
      };
      jobs.push({ kind: 'roll', id: trip.id, date: isoDate, payload });
      result.rolled.push(trip.id);
      continue;
    }

    const hadPassenger = allBookings.some(
      (b) => (b.tripId === trip.id || b.targetTripId === trip.id) && b.status !== 'cancelled'
    );
    const status = hadPassenger ? 'completed' : 'expired';
    const payload = { ...trip, status, closedAt: new Date(nowMs).toISOString(), closedBy: 'scheduler' };
    jobs.push({ kind: 'close', id: trip.id, status, payload });
    result[hadPassenger ? 'completed' : 'expired'].push(trip.id);
  }

  if (jobs.length > 0 && !dryRun) apply(jobs);
  return result;
}

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

  // Only allow schedule fields to be changed on re-publish. Do not take `updates`
  // wholesale, to avoid overwriting ownership (phoneReal/userId) — otherwise
  // a post owner could re-publish as a trip under someone else's phone number.
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
    // Ownership is always inherited from the original post, never accepted from the client
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

  // Secret access token (128-bit) for the driver's Magic Link to confirm / view the summary without logging in.
  // escrowId (CX-xxxx) is guessable -> this token prevents IDOR enumeration of other people's bookings.
  // Keep the token unchanged if the booking already exists (to avoid invalidating the old link on update).
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
  const norm = normalizePhoneNumber(phone) || clean;

  const row = database.prepare('SELECT payload FROM users WHERE phone = ? OR phone = ?').get(clean, norm);
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
  // Prefer querying via the email column's Index O(1), fall back to scanning the payload for legacy data
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
 * Permanently deletes a user account & cleanses personal data (PII Cleanse)
 * Complies with Apple App Store Guideline 5.1.1 (v) & Decree 13/2023/ND-CP (Article 16)
 */
export async function deleteUserAccount(userId, phone) {
  const database = getRawDB();

  let user = null;
  if (userId) user = getUserById(userId);
  if (!user && phone) user = getUserByPhone(phone);

  const effectiveUserId = user?.id || userId;
  const effectivePhone = user?.phone || (phone ? cleanPhoneNumber(phone) : null);

  // MIT Invariant Guard: never delete an Admin account (ensures the system always has an owner)
  if (user?.role === 'admin' || (effectivePhone && isAdminPhone(effectivePhone))) {
    throw new Error('Tài khoản Quản trị viên (Admin) được bảo vệ bởi luật bất biến MIT, không thể tự xoá vĩnh viễn.');
  }

  // 1. Delete this user's posts (so they no longer appear on the marketplace)
  if (effectiveUserId) {
    database.prepare('DELETE FROM trips WHERE userId = ?').run(effectiveUserId);
  }
  if (effectivePhone) {
    database.prepare('DELETE FROM trips WHERE phoneReal = ?').run(effectivePhone);
  }

  // 1b. Delete this user's movement intents (intents)
  try {
    if (effectiveUserId) {
      database.prepare('DELETE FROM intents WHERE userId = ?').run(effectiveUserId);
    }
    if (effectivePhone) {
      database.prepare('DELETE FROM intents WHERE phone = ?').run(effectivePhone);
    }
  } catch {}

  // 2. Anonymize the matched rides in history so the fellow riders' data is not corrupted
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

  // 3. Permanently delete from the users table
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

  if (updates.isDeactivated !== undefined) {
    const isHiddenInt = updates.isDeactivated ? 1 : 0;
    database
      .prepare('UPDATE trips SET isHidden = ? WHERE phoneReal = ? OR userId = ?')
      .run(isHiddenInt, cleanPhoneNumber(found.phone), userId);
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

  // Group the routes with the most unmet demand (Unmet Demand)
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

export function clearAllTrips() {
  const database = getRawDB();
  const res = database.prepare('DELETE FROM trips').run();
  return res.changes;
}

export function clearAllIntents() {
  const database = getRawDB();
  const res = database.prepare('DELETE FROM intents').run();
  return res.changes;
}

export function clearAllStationRequests() {
  const database = getRawDB();
  const res = database.prepare('DELETE FROM station_requests').run();
  return res.changes;
}

export function clearAllTripIncidents() {
  const database = getRawDB();
  const res = database.prepare('DELETE FROM trip_incidents').run();
  return res.changes;
}

export function clearAllMatchingEpochs() {
  const database = getRawDB();
  const res = database.prepare('DELETE FROM matching_epochs').run();
  return res.changes;
}

export function clearAllSeatExchangeOrders() {
  const database = getRawDB();
  const res = database.prepare('DELETE FROM seat_exchange_orders').run();
  return res.changes;
}

export function clearNonAdminUsers() {
  const database = getRawDB();
  const res = database.prepare("DELETE FROM users WHERE role != 'admin' AND phone != '0984883750' AND id NOT LIKE 'USR-GG-%'").run();
  return res.changes;
}

/**
 * Gets the trust score calculation rule configuration (Dynamic Trust Policy Rules)
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
 * Saves the trust score calculation rule configuration (Admin Update)
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
 * =============================================================================
 * FIXED-ROUTE BUS OPERATOR DIRECTORY (TRANSIT FALLBACK DIRECTORY)
 * =============================================================================
 * Stored in key_values so the Admin Portal can edit it without a redeploy.
 *
 * INVARIANT: each number must have `verified: true` together with `verifiedAt` before the UI
 * shows the call button. Unverified numbers can still be stored (so the operations team can track them) but
 * must NEVER be exposed to passengers — a passenger who taps call at the most urgent moment and reaches a wrong
 * number loses trust permanently, far worse than there being no number at all.
 */
export function getTransitDirectory() {
  const database = getRawDB();
  try {
    const row = database.prepare('SELECT value FROM key_values WHERE key = ?').get('transit_directory');
    if (row && row.value) {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('[SQLite DB] Lỗi đọc transit_directory:', e.message);
  }
  return [...VERIFIED_HOTLINES];
}

export function resetTransitDirectory() {
  const database = getRawDB();
  database.prepare('DELETE FROM key_values WHERE key = ?').run('transit_directory');
  return [...VERIFIED_HOTLINES];
}

/** Saves the bus operator directory (updated by Admin). */
export function saveTransitDirectory(providers) {
  if (!Array.isArray(providers)) {
    throw new Error('Danh bạ phải là một danh sách mảng');
  }
  const database = getRawDB();
  database
    .prepare(
      `
    INSERT INTO key_values (key, value) VALUES ('transit_directory', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `
    )
    .run(JSON.stringify(providers));
  return providers;
}

/**
 * Restores the trust score calculation rule configuration to the default
 */
export function resetTrustRules() {
  const database = getRawDB();
  database.prepare('DELETE FROM key_values WHERE key = ?').run('trust_policy_rules');
  return DEFAULT_TRUST_RULES;
}

/**
 * =============================================================================
 * DAILY FUEL INDEX (DAILY PETROLIMEX FUEL INDEX)
 * =============================================================================
 * An admin manually updates the RON 95-III gasoline price.
 * Persisted in the key_values table so it survives server restarts.
 */

/**
 * Gets the daily fuel price configuration saved in SQLite
 */
export function getDailyFuelPriceConfig() {
  const database = getRawDB();
  try {
    const row = database.prepare('SELECT value FROM key_values WHERE key = ?').get('daily_fuel_price');
    if (row && row.value) {
      const parsed = JSON.parse(row.value);
      if (parsed && typeof parsed.ron95Price === 'number' && parsed.ron95Price >= 15000 && parsed.ron95Price <= 45000) {
        return {
          ...parsed,
          isDefault: false
        };
      }
    }
  } catch (e) {
    console.warn('[SQLite DB] Lỗi đọc daily_fuel_price:', e.message);
  }
  const current = getDailyFuelPrice();
  return {
    ron95Price: current.ron95Price || DEFAULT_DAILY_FUEL_PRICE,
    fuelType: 'RON 95-III',
    unit: 'VNĐ/Lít',
    updatedAt: current.updatedAt,
    updatedBy: current.updatedBy || 'default',
    source: 'default',
    isDefault: true,
    note: 'Mức giá tham chiếu mặc định của nền tảng'
  };
}

/**
 * Saves the daily fuel price configuration (Admin Manual Update)
 */
export function saveDailyFuelPriceConfig({ ron95Price, updatedBy = 'admin', note = '' }) {
  const priceNum = Number(ron95Price);
  if (!Number.isFinite(priceNum) || priceNum < 15000 || priceNum > 45000) {
    throw new Error('Giá xăng RON 95 không hợp lệ (phải từ 15.000đ đến 45.000đ/lít)');
  }
  const roundedPrice = Math.round(priceNum);
  const nowISO = new Date().toISOString();
  const config = {
    ron95Price: roundedPrice,
    fuelType: 'RON 95-III',
    unit: 'VNĐ/Lít',
    updatedAt: nowISO,
    updatedBy: String(updatedBy || 'admin').trim(),
    note: String(note || '').trim(),
    source: 'admin'
  };

  const database = getRawDB();
  database
    .prepare(
      `
    INSERT INTO key_values (key, value) VALUES ('daily_fuel_price', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `
    )
    .run(JSON.stringify(config));

  // Apply immediately to the in-memory dynamicTariff engine of @carmate/shared
  setDailyFuelPrice(roundedPrice, nowISO, config.updatedBy, 'admin');

  return {
    ...config,
    isDefault: false
  };
}

/**
 * Reads the pricing formula parameter set currently stored in SQLite.
 * If there is no record, returns the platform's default set.
 */
export function getTariffParamsConfig() {
  const database = getRawDB();
  try {
    const row = database.prepare('SELECT value FROM key_values WHERE key = ?').get('tariff_params');
    if (row && row.value) {
      const parsed = JSON.parse(row.value);
      // Re-read from the DB: this is the FULL record, so merge it onto the default set so that the
      // stored copy is the single source of truth, not mixed with the running session's parameters.
      const { params, errors } = validateTariffParams(parsed, DEFAULT_TARIFF_PARAMS);
      if (errors.length === 0) {
        return {
          ...params,
          updatedAt: parsed.updatedAt || new Date().toISOString(),
          updatedBy: parsed.updatedBy || 'admin',
          note: parsed.note || '',
          source: 'admin',
          isDefault: false
        };
      }
      console.warn('[SQLite DB] tariff_params đã lưu không hợp lệ, dùng mặc định:', errors.join(' '));
    }
  } catch (e) {
    console.warn('[SQLite DB] Lỗi đọc tariff_params:', e.message);
  }
  const current = getTariffParams();
  return {
    ...DEFAULT_TARIFF_PARAMS,
    updatedAt: current.updatedAt,
    updatedBy: 'default',
    note: 'Bộ tham số công thức mặc định của nền tảng',
    source: 'default',
    isDefault: true
  };
}

/**
 * Saves the pricing formula parameter set (admins only).
 * Writes to SQLite then applies immediately to the in-memory engine of @carmate/shared,
 * so the price of every trip on the marketplace changes instantly.
 */
export function saveTariffParamsConfig({ params, updatedBy = 'admin', note = '' }) {
  const { params: cleanParams, errors } = validateTariffParams(params || {});
  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }
  const nowISO = new Date().toISOString();
  const config = {
    ...cleanParams,
    updatedAt: nowISO,
    updatedBy: String(updatedBy || 'admin').trim(),
    note: String(note || '').trim(),
    source: 'admin'
  };

  const database = getRawDB();
  database
    .prepare(
      `
    INSERT INTO key_values (key, value) VALUES ('tariff_params', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `
    )
    .run(JSON.stringify(config));

  setTariffParams(cleanParams, nowISO, config.updatedBy, 'admin');

  return { ...config, isDefault: false };
}

/**
 * Restores the pricing formula to the platform's default parameter set.
 */
export function resetTariffParamsConfig() {
  const database = getRawDB();
  try {
    database.prepare('DELETE FROM key_values WHERE key = ?').run('tariff_params');
  } catch (e) {
    console.warn('[SQLite DB] Lỗi xoá tariff_params:', e.message);
  }
  resetTariffParams();
  return getTariffParamsConfig();
}

/**
 * Restores the fuel price to the default reference level (24,120 VND)
 */
export function resetDailyFuelPriceConfig() {
  const database = getRawDB();
  database.prepare('DELETE FROM key_values WHERE key = ?').run('daily_fuel_price');
  resetDailyFuelPrice();
  return {
    ron95Price: DEFAULT_DAILY_FUEL_PRICE,
    fuelType: 'RON 95-III',
    unit: 'VNĐ/Lít',
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
    source: 'default',
    isDefault: true,
    note: 'Đã khôi phục về mức tham chiếu mặc định'
  };
}

/**
 * Checks whether a user is completely disabled (the 3-day grace period has expired)
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
 * Saves support messages between a User and Platform Support / CarMate Customer Support
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
 * Gets the chat history with Platform Support
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
 * Handles a complaint (Dispute) and unbans the account (Unban), automatically or upon approval
 */
export async function resolveDisputeAndUnban({ bookingId, userId, phone } = {}) {
  const database = getRawDB();
  // 1. Unlock the booking if there is one
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

  // 2. Unlock the user
  const targetKey = userId || phone;
  if (targetKey) {
    await updateUserStatus(targetKey, {
      isBanned: false,
      status: 'active',
      piiStrikes: 0,
      bannedAt: null,
      deactivateAt: null,
      trustScore: 98 // Restore a safe trust score
    });
  }

  // 3. Mark the related complaint messages as resolved
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
 * Sends a request to delete an account to the CarMate Admin
 * Invariant & Ergonomics: not deleted instantly; the request is received so obligations & trips can be reconciled
 */
export async function createDeletionRequest({ userId, phone, name, email, reason = '' }) {
  const database = getRawDB();
  const id = `DEL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();

  // Check whether there is already a deletion request awaiting processing (pending)
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
 * Gets the list of account deletion requests for the Admin
 */
export function getDeletionRequests(status = '') {
  const database = getRawDB();
  if (status) {
    return database.prepare('SELECT * FROM account_deletion_requests WHERE status = ? ORDER BY createdAt DESC').all(status);
  }
  return database.prepare('SELECT * FROM account_deletion_requests ORDER BY createdAt DESC').all();
}

/**
 * An admin approves or rejects an account deletion request
 * On approval (action: 'approved'): performs the account deletion, removes posts and anonymizes data per Decree 13/2023
 */
export async function processDeletionRequest(requestId, action, adminInfo = 'Admin') {
  const database = getRawDB();
  const req = database.prepare('SELECT * FROM account_deletion_requests WHERE id = ?').get(requestId);
  if (!req) {
    throw new Error('Không tìm thấy yêu cầu xóa tài khoản với mã ' + requestId);
  }

  const now = Date.now();
  if (action === 'approved') {
    // 1. Permanently delete personal data per Decree 13/2023/ND-CP
    await deleteUserAccount(req.userId, req.phone);

    // 2. Update the request status
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
 * LEVEL 3 FEATURE BLOCK: AUTONOMOUS ZERO-SEARCH MATCHING & GAME THEORY
 * =========================================================================
 */

/**
 * Creates a new Movement Intent Declaration (Intent)
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
 * Gets the list of Intents by filter (status, role, corridor, date)
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
 * Gets the details of one Intent by ID
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
 * Updates the status and data of an Intent
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
      SET status = ?, matchedTripId = ?, matchedBookingId = ?, date = ?, timeSlot = ?, seats = ?, payload = ?
      WHERE id = ?
    `
      )
      .run(
        full.status || 'pending',
        full.matchedTripId || null,
        full.matchedBookingId || null,
        full.date || '',
        full.timeSlot || 'all',
        Number(full.seats || 1),
        JSON.stringify(full),
        id
      );

    return full;
  } catch {
    return null;
  }
}

/**
 * Deletes an Intent
 */
export async function deleteIntent(id) {
  const database = getRawDB();
  const info = database.prepare('DELETE FROM intents WHERE id = ?').run(id);
  return info.changes > 0;
}

/**
 * Stores the log of one Matching Session (Matching Epoch)
 */
export async function createMatchingEpoch(epochData) {
  const database = getRawDB();
  const id = epochData.id || `EP-${crypto.randomUUID()}`;
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
 * Gets the history of the most recent matching sessions
 */
export function getMatchingEpochs(limit = 20) {
  const database = getRawDB();
  return database.prepare('SELECT * FROM matching_epochs ORDER BY createdAt DESC LIMIT ?').all(limit);
}

/**
 * =========================================================================
 * LEVEL 3.5 FEATURE BLOCK: EMPTY-SEAT EXCHANGE MARKETPLACE (SEAT EXCHANGE - LOB & CDA)
 * =========================================================================
 */

/**
 * Creates a new Order on the Empty-Seat Exchange (Ask or Bid)
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
 * Gets the list of orders on the exchange by filter
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
 * Gets the details of an order by ID
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
 * Updates the order status (FILLED, PARTIALLY_FILLED, EXPIRED, CANCELLED)
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
 * Scans the OPEN orders on the exchange that have exceeded the dynamic sliding TTL and moves them to EXPIRED
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
      // Ignore the parse error if any
    }
  }

  return expiredList;
}


/**
 * ATOMIC ORDER MATCHING (ATOMIC MATCH COMMIT — MIT INVARIANT)
 *
 * One match consists of 3 write operations: updating the ASK order, updating the BID order, and
 * creating the booking. If written separately, a failure midway would leave a seat already deducted but NO
 * booking — the exchange ends up in a contradictory state (the passenger loses the seat but has no ticket).
 *
 * This function wraps all 3 in ONE SQLite transaction: either all 3 are written, or
 * nothing is. better-sqlite3 automatically ROLLBACKs when the callback throws.
 */
export function commitExchangeMatchDb({ askOrder, bidOrder, booking, isNewOrderAsk = false }) {
  const database = getRawDB();

  const run = database.transaction(() => {
    // A new order (not yet in the DB) must be INSERTed; an order already on the exchange is UPDATEd
    // so that fields not passed in are not erased.
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
 * Fully overwrites an order row (used for a NEW order entering the exchange).
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
 * Updates an order that is CURRENTLY on the exchange — merges with the old payload so
 * fields not passed in are not erased (very different from INSERT OR REPLACE).
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
 * Gets a user profile in order to RECORD A SANCTION, auto-creating a minimal profile if none exists.
 *
 * CarMate allows posting a trip without registering first (Unified Auth /
 * Upsert Flow) — that is a deliberate product choice to reduce friction. But the consequence is that every
 * point-deduction path is wrapped in `if (user) {...}`, so a driver without an account
 * ESCAPES ALL sanctions: last-minute cancellations, being reported for overloading, ditching passengers —
 * nothing can attach to them. Anyone who wants to dodge penalties just needs to not tap log in.
 *
 * This function closes that hole without adding any registration step: when a sanction needs to be recorded
 * for a phone number with no profile, a minimal profile is created on the spot. The next
 * time that person logs in with that number they will receive their own trust history.
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
    // Mark the profile as auto-generated by a sanction, never logged in.
    isAutoCreated: 1,
    createdAt: Date.now()
  });

  return getUserByPhone(clean);
}

/**
 * Applies cancellation discipline via a time-decay function (Time-Decay Penalty Engine)
 * - deltaMinutes > 120: Safe (0 VND), no penalty.
 * - 30 <= deltaMinutes <= 120: Warning, deduct 15 trust points.
 * - deltaMinutes < 30 or after departure: Severe violation, deduct 40 trust points, 7-day lock.
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
    // 1. GRIM TRIGGER (FUTURE SURPLUS LEVERAGE):
    // Strip access to the surplus income stream of 4-5 million VND/month for 30 days if the driver cancels at the last minute
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

  // Deduct trust points if there is a user
  if (cleanPhone && penaltyPoints > 0) {
    // Create the profile if none exists, so that an unregistered driver does NOT escape sanctions.
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
 * Normalizes station names to group duplicate or near-duplicate requests
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
 * Adds or merges a new virtual station opening request (Station Request Pool)
 * - Automatically groups based on the normalized name
 * - Increments the proposal count (requestCount) when several people propose the same
 * - Survey trigger threshold: >= 50 proposals
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

  // Check whether a similar station already exists in the pool
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

  // Create a new request
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
 * Gets the list of proposals to open new stations
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
 * Updates the station proposal status (pending, surveying, approved, rejected)
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
 * Standard notice about the limit of 2 trips per day
 */
export const DRIVER_DAILY_CAP_NOTICE =
  '⛔ Giới hạn 2 lượt di chuyển/ngày: Theo Nghị định 10/2020/NĐ-CP và Điều 3 Bộ Luật Dân sự 2015, CarMate là nền tảng chia sẻ chi phí hành trình cá nhân (sáng đi làm - chiều về nhà). Mỗi chủ xe chỉ được tạo tối đa 2 chuyến/ngày để bảo đảm bản chất dân sự phi thương mại. Xe chạy tần suất cao bị từ chối để tránh biến tướng thành xe vận tải chuyên nghiệp.';

/**
 * Counts the number of trips a driver has posted or made in the day (Anti-Commercial Capping)
 * @param {string} phone - The driver's phone number
 * @param {string} targetDate - Target date (defaults to today)
 * @returns {number} Number of trips in the day
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
 * Checks whether a driver is restricted in trip count.
 * Per requirement: CarMate does not limit the number of trips; the driver bears civil liability for their travel frequency.
 */
export function isDriverDailyTripCapped(_phone, _targetDate = '') {
  return false;
}

/**
 * Records a trip incident (Unhappy Cases) into the database
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
 * Queries the list of trip incidents
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
 * Permanently bans a user (applied to the behavior of evading the fuel-cost contribution, UNPAID_FARE_FRAUD)
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

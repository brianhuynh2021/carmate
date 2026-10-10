/**
 * seatExchangeController.js
 *
 * CONTROLLER: EMPTY-SEAT TRADING EXCHANGE (SEAT EXCHANGE)
 * Two-Sided Order Book (Limit Order Book - LOB) & Continuous Order Matching (Continuous Double Auction - CDA)
 * 24/7 spot market (Continuous Spot Market) & Dynamic Sliding TTL.
 */

import {
  parseTimeToMinutes,
  buildInterval,
  calculateUnifiedOrderTTL,
  matchOrderContinuous,
  buildOrderExpiredNotification,
  cleanPhoneNumber,
  isValidVietnamesePhone,
  VIRTUAL_HUBS
} from '@carmate/shared';

import {
  getExchangeOrdersDb,
  commitExchangeMatchDb,
  createExchangeOrderDb,
  expireSlidingTTLOrdersDb,
  getUserByPhone
} from '../db/sqliteStore.js';

import { sendBusinessAlert } from '../utils/telegramAlert.js';

/**
 * =========================================================================
 * PII SHIELD (DECREE 13/2023/ND-CP) FOR THE PUBLIC ORDER BOOK
 * =========================================================================
 * The public exchange must ABSOLUTELY NOT expose real phone numbers, real names or
 * full license plates. Real identities are only revealed to the 2 parties AFTER an order match
 * (via booking + PIN code), in sync with `sanitizeTripForPublic` of /api/trips.
 */
export function sanitizeOrderForPublic(order, reqUser) {
  if (!order) return null;

  const viewerPhone = reqUser ? cleanPhoneNumber(reqUser.phone || '') : null;
  const orderPhone = cleanPhoneNumber(order.phone || '');
  const isOwner = Boolean(
    (viewerPhone && orderPhone && viewerPhone === orderPhone) ||
    (reqUser && (reqUser.role === 'admin' || reqUser.role === 'super_admin')) ||
    (reqUser && reqUser.id && reqUser.id === order.userId)
  );

  if (isOwner) return { ...order, isOwner: true };

  const safe = { ...order };

  // 1. Mask the phone number: 098***2233
  safe.phoneMasked =
    orderPhone.length >= 7
      ? `${orderPhone.slice(0, 3)}***${orderPhone.slice(-4)}`
      : '09x***xxxx';
  delete safe.phone;
  delete safe.phoneReal;

  // 2. Public alias in place of the real name
  const tail = String(order.id || '').slice(-3).toUpperCase() || 'XXX';
  safe.publicName = order.orderType === 'ASK' ? `Chủ xe CX-${tail}` : `Người đi cùng KX-${tail}`;
  delete safe.contactName;

  // 3. Mask the last 2 digits of the license plate
  if (safe.plate && typeof safe.plate === 'string') {
    safe.plate = safe.plate.replace(/\d{2}$/, 'xx');
  }

  // 4. Operational secret: the PIN & counterpart identity never go onto the public exchange
  delete safe.pinCode;
  delete safe.userId;
  delete safe.matchedBookingId;
  delete safe.matchedWithOrderId;
  delete safe.payload;

  return safe;
}

/**
 * POST /api/seat-exchange/order
 * Place an order on the exchange (Ask or Bid) -> Continuous CDA matching happens immediately!
 */
export async function placeOrderHandler(req, res) {
  try {
    const {
      orderType = 'BID', // 'ASK' (driver selling a seat) | 'BID' (passenger buying a seat)
      stationId = '',
      stationName = '',
      corridor = 'Tuyến QL13',
      direction = 'SG_BINHPHUOC',
      date = '',
      targetTime = '06:15',
      deltaMinutes = 10,
      seats = 1,
      phone = '',
      contactName = '',
      plate = '',
      vehicleModel = ''
    } = req.body || {};

    // IDENTITY INVARIANT (ANTI-SPOOFING):
    // When logged in, the phone number in the token ALWAYS wins over the phone number sent from the body — otherwise
    // an attacker could place orders in someone else's name. Only anonymous guests
    // (not logged in) may declare their own phone number.
    const tokenPhone = cleanPhoneNumber(req.user?.phone || '');
    const clean = tokenPhone || cleanPhoneNumber(phone);

    if (!clean || !isValidVietnamesePhone(clean)) {
      return res.status(400).json({
        success: false,
        error: 'Số điện thoại không hợp lệ (cần đủ 10 số di động Việt Nam)'
      });
    }

    // Normalize the pickup station if there is an id in Virtual Hubs
    let resolvedStationId = stationId;
    let resolvedStationName = stationName;
    if (resolvedStationId && !resolvedStationName) {
      const hub = VIRTUAL_HUBS.find((h) => h.id === resolvedStationId);
      if (hub) resolvedStationName = hub.name;
    }

    const targetTimeMinutes = parseTimeToMinutes(targetTime);
    const timeInterval = buildInterval(targetTimeMinutes, deltaMinutes);
    const now = Date.now();

    // Compute the unified TTL: TTL = min(T_sleep, T_pickup - delta t_switch)
    const ttlResult = calculateUnifiedOrderTTL({
      orderCreatedAt: now,
      targetPickupMinutes: targetTimeMinutes,
      pickupDate: date
    });

    const isAsk = orderType.toUpperCase() === 'ASK';
    const parsedSeats = Number(seats) || 1;

    // TRUST-SCORE INVARIANT: trustScore decides the order-matching priority
    // (candidates.sort) so it must ABSOLUTELY NOT be accepted from the client — otherwise an
    // attacker could give themselves 100 points to grab every ride. Always read it from the DB profile.
    const ownerProfile = getUserByPhone(clean);
    const resolvedTrustScore = Number(ownerProfile?.trustScore ?? 98);

    const newOrder = {
      id: `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      userId: req.user?.id || `USR-${clean}`,
      orderType: isAsk ? 'ASK' : 'BID',
      stationId: resolvedStationId,
      stationName: resolvedStationName || 'Trạm đón QL13',
      corridor,
      direction,
      date,
      targetTime,
      targetTimeMinutes,
      deltaMinutes: Number(deltaMinutes) || 10,
      timeStartMins: timeInterval[0],
      timeEndMins: timeInterval[1],
      timeInterval,
      seats: parsedSeats,
      remainingSeats: parsedSeats,
      status: 'OPEN',
      ttlTimestamp: ttlResult.ttlTimestamp,
      ttlTimeString: ttlResult.ttlTimeString,
      isSleepCutoff: ttlResult.isSleepCutoff,
      userNotice: ttlResult.userNotice,
      phone: clean,
      contactName: contactName || (isAsk ? 'Chủ xe' : 'Người đi cùng'),
      plate: plate || (isAsk ? '93A-541.86' : ''),
      vehicleModel: vehicleModel || (isAsk ? 'Xe 5-7 chỗ' : ''),
      trustScore: resolvedTrustScore,
      userMessage: ttlResult.userMessage,
      createdAt: now
    };

    // 1. Scan the OPEN orders on the same corridor for continuous matching (CDA)
    const openOrders = getExchangeOrdersDb({
      corridor,
      direction,
      date
    }).filter((o) => o.status === 'OPEN' || o.status === 'PARTIALLY_FILLED');

    const matchResult = matchOrderContinuous(newOrder, openOrders);

    if (matchResult.matched) {
      // 2a. ORDER MATCH SUCCEEDED (FILLED)
      const askOrder = matchResult.askOrder;
      const bidOrder = matchResult.bidOrder;
      const escrowId = `CX-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

      // ATOMICITY INVARIANT (MIT INVARIANT):
      // An order match consists of 3 write operations (ASK order + BID order + booking). If separated,
      // a mid-way failure would leave a seat already deducted with NO corresponding booking —
      // the exchange falls into a contradictory state. Wrap everything in ONE SQLite transaction:
      // either all 3 succeed together, or nothing is written.
      commitExchangeMatchDb({
        askOrder: { ...askOrder, matchedBookingId: escrowId, matchedAt: now },
        bidOrder: { ...bidOrder, matchedBookingId: escrowId, matchedAt: now },
        isNewOrderAsk: newOrder.orderType === 'ASK',
        booking: {
          escrowId,
          tripId: askOrder.id,
          passengerPhone: bidOrder.phone,
          passengerName: bidOrder.contactName,
          driverPhone: askOrder.phone,
          driverName: askOrder.contactName,
          seats: matchResult.seatsTraded,
          status: 'zalo_active',
          pinCode: matchResult.pinCode,
          pickupPoint: bidOrder.stationName,
          rendezvousTime: matchResult.rendezvousTime,
          createdAt: now
        }
      });

      // Fire a business notification
      sendBusinessAlert({
        title: `SÀN KHỚP LỆNH THÀNH CÔNG (${matchResult.rendezvousTime})`,
        details: {
          'Trạm đón': bidOrder.stationName,
          'Giờ hẹn': matchResult.rendezvousTime,
          'Mã PIN': matchResult.pinCode,
          'Chủ xe': askOrder.contactName,
          'Người đi cùng': bidOrder.contactName,
          'Số ghế khớp': matchResult.seatsTraded
        },
        req
      }).catch(() => {});

      return res.status(200).json({
        success: true,
        matched: true,
        order: newOrder.orderType === 'ASK' ? askOrder : bidOrder,
        counterpart: newOrder.orderType === 'ASK' ? bidOrder : askOrder,
        rendezvousTime: matchResult.rendezvousTime,
        pinCode: matchResult.pinCode,
        bookingId: escrowId,
        notifications: matchResult.notifications,
        message: 'Lệnh đã KHỚP THÀNH CÔNG ngay lập tức! Vé và mã PIN đã được sinh an toàn.'
      });
    }

    // 2b. NO SATISFYING COUNTERPART YET -> STORE A RESTING ORDER (RESTING ORDER / OPEN)
    const savedOrder = await createExchangeOrderDb(newOrder);

    return res.status(201).json({
      success: true,
      matched: false,
      order: sanitizeOrderForPublic(savedOrder, { ...(req.user || {}), phone: clean }),
      ttlTimeString: ttlResult.ttlTimeString,
      isSleepCutoff: ttlResult.isSleepCutoff,
      message: ttlResult.userNotice
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/seat-exchange/order-book
 * View the Two-Sided Order Book (LOB) per pickup station (Depth of Market)
 */
export function getOrderBookHandler(req, res) {
  try {
    const { corridor = 'Tuyến QL13', direction, date } = req.query || {};
    const filters = { status: 'OPEN', corridor };
    if (direction) filters.direction = direction;
    if (date) filters.date = date;

    const openOrders = getExchangeOrdersDb(filters);

    // Group by pickup station
    const stationMap = new Map();
    for (const order of openOrders) {
      const stnKey = order.stationId || order.stationName || 'Trạm chung';
      if (!stationMap.has(stnKey)) {
        stationMap.set(stnKey, {
          stationId: order.stationId || '',
          stationName: order.stationName || stnKey,
          asks: [], // driver selling seats
          bids: []  // passenger buying seats
        });
      }
      const stn = stationMap.get(stnKey);
      // Every order that goes onto the public exchange must pass through the PII shield (Decree 13/2023)
      const publicOrder = sanitizeOrderForPublic(order, req.user);
      if (order.orderType === 'ASK') {
        stn.asks.push(publicOrder);
      } else {
        stn.bids.push(publicOrder);
      }
    }

    // Sort in chronological order within each station
    for (const stn of stationMap.values()) {
      stn.asks.sort((a, b) => (a.targetTimeMinutes || 0) - (b.targetTimeMinutes || 0));
      stn.bids.sort((a, b) => (a.targetTimeMinutes || 0) - (b.targetTimeMinutes || 0));
    }

    return res.status(200).json({
      success: true,
      corridor,
      totalOpenOrders: openOrders.length,
      stations: Array.from(stationMap.values())
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/seat-exchange/my-orders
 * Get the current user's order history
 */
export function getMyOrdersHandler(req, res) {
  try {
    // ANTI-ENUMERATION: identity is taken ONLY from the JWT.
    // Previously the handler accepted `?phone=` from the query — anyone who knew another person's
    // phone number could read that person's entire order history without logging in.
    const userId = req.user?.id;
    const clean = cleanPhoneNumber(req.user?.phone || '');

    if (!userId && !clean) {
      return res.status(401).json({
        success: false,
        error: 'Vui lòng đăng nhập để xem lịch sử lệnh của bạn'
      });
    }

    const allOrders = getExchangeOrdersDb({});
    const myOrders = allOrders.filter((o) => {
      if (userId && o.userId === userId) return true;
      if (clean && cleanPhoneNumber(o.phone || '') === clean) return true;
      return false;
    });

    return res.status(200).json({
      success: true,
      count: myOrders.length,
      data: myOrders
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/seat-exchange/expire-ttl
 * Trigger a sweep that automatically cancels OPEN orders that have passed the Dynamic Sliding TTL deadline
 */
export async function expireSlidingTTLHandler(req, res) {
  try {
    // BUSINESS-LOGIC DoS PROTECTION: the TTL sweep timestamp is ALWAYS the server clock.
    // Previously the handler accepted `timestamp` from the body — an anonymous POST with a
    // timestamp far in the future would EXPIRE the whole exchange's order book.
    const now = Date.now();
    const expiredOrders = await expireSlidingTTLOrdersDb(now);

    const notifications = expiredOrders.map((order) =>
      buildOrderExpiredNotification({
        order,
        cutoffTimeStr: order.ttlTimeString || 'Hạn chót'
      })
    );

    return res.status(200).json({
      success: true,
      count: expiredOrders.length,
      expiredOrders,
      notifications,
      message: `Đã tự động hủy ${expiredOrders.length} lệnh quá hạn TTL. Phao cứu sinh xe khách liên tỉnh đã kích hoạt.`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

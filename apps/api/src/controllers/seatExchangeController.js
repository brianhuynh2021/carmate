/**
 * seatExchangeController.js
 *
 * CONTROLLER: SÀN GIAO DỊCH GHẾ TRỐNG (SEAT EXCHANGE)
 * Sổ Lệnh Hai Chiều (Limit Order Book - LOB) & Khớp Lệnh Liên Tục (Continuous Double Auction - CDA)
 * Thị trường giao ngay 24/7 (Continuous Spot Market) & Dynamic Sliding TTL.
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
 * LỚP CHẮN PII (NGHỊ ĐỊNH 13/2023/NĐ-CP) CHO SỔ LỆNH CÔNG KHAI
 * =========================================================================
 * Sàn công khai TUYỆT ĐỐI không được lộ số điện thoại thật, tên thật hay
 * biển số đầy đủ. Danh tính thật chỉ hiện ra cho đúng 2 bên SAU khi khớp lệnh
 * (qua booking + mã PIN), đồng bộ với `sanitizeTripForPublic` của /api/trips.
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

  // 1. Che số điện thoại: 098***2233
  safe.phoneMasked =
    orderPhone.length >= 7
      ? `${orderPhone.slice(0, 3)}***${orderPhone.slice(-4)}`
      : '09x***xxxx';
  delete safe.phone;
  delete safe.phoneReal;

  // 2. Bí danh công khai thay cho tên thật
  const tail = String(order.id || '').slice(-3).toUpperCase() || 'XXX';
  safe.publicName = order.orderType === 'ASK' ? `Chủ xe CX-${tail}` : `Người đi cùng KX-${tail}`;
  delete safe.contactName;

  // 3. Che 2 số cuối biển số
  if (safe.plate && typeof safe.plate === 'string') {
    safe.plate = safe.plate.replace(/\d{2}$/, 'xx');
  }

  // 4. Bí mật vận hành: PIN & danh tính đối ứng không bao giờ ra sàn công khai
  delete safe.pinCode;
  delete safe.userId;
  delete safe.matchedBookingId;
  delete safe.matchedWithOrderId;
  delete safe.payload;

  return safe;
}

/**
 * POST /api/seat-exchange/order
 * Ném lệnh vào sàn (Ask hoặc Bid) -> Khớp liên tục CDA ngay lập tức!
 */
export async function placeOrderHandler(req, res) {
  try {
    const {
      orderType = 'BID', // 'ASK' (Chủ xe bán ghế) | 'BID' (Người đi cùng mua ghế)
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

    // BẤT BIẾN DANH TÍNH (ANTI-SPOOFING):
    // Khi đã đăng nhập, SĐT trong token LUÔN thắng SĐT gửi từ body — nếu không
    // kẻ tấn công có thể ném lệnh mang danh người khác. Chỉ khách vãng lai
    // (chưa đăng nhập) mới được tự khai SĐT của chính mình.
    const tokenPhone = cleanPhoneNumber(req.user?.phone || '');
    const clean = tokenPhone || cleanPhoneNumber(phone);

    if (!clean || !isValidVietnamesePhone(clean)) {
      return res.status(400).json({
        success: false,
        error: 'Số điện thoại không hợp lệ (cần đủ 10 số di động Việt Nam)'
      });
    }

    // Chuẩn hóa trạm đón nếu có id trong Virtual Hubs
    let resolvedStationId = stationId;
    let resolvedStationName = stationName;
    if (resolvedStationId && !resolvedStationName) {
      const hub = VIRTUAL_HUBS.find((h) => h.id === resolvedStationId);
      if (hub) resolvedStationName = hub.name;
    }

    const targetTimeMinutes = parseTimeToMinutes(targetTime);
    const timeInterval = buildInterval(targetTimeMinutes, deltaMinutes);
    const now = Date.now();

    // Tính toán TTL hợp nhất: TTL = min(T_sleep, T_pickup - delta t_switch)
    const ttlResult = calculateUnifiedOrderTTL({
      orderCreatedAt: now,
      targetPickupMinutes: targetTimeMinutes,
      pickupDate: date
    });

    const isAsk = orderType.toUpperCase() === 'ASK';
    const parsedSeats = Number(seats) || 1;

    // BẤT BIẾN ĐIỂM TÍN NHIỆM: trustScore quyết định thứ tự ưu tiên khớp lệnh
    // (candidates.sort) nên TUYỆT ĐỐI không được nhận từ client — nếu không kẻ
    // tấn công tự cho mình 100 điểm để chiếm mọi cuốc. Luôn đọc từ hồ sơ DB.
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

    // 1. Quét các lệnh OPEN trên cùng hành lang để khớp liên tục (CDA)
    const openOrders = getExchangeOrdersDb({
      corridor,
      direction,
      date
    }).filter((o) => o.status === 'OPEN' || o.status === 'PARTIALLY_FILLED');

    const matchResult = matchOrderContinuous(newOrder, openOrders);

    if (matchResult.matched) {
      // 2a. KHỚP LỆNH THÀNH CÔNG (FILLED)
      const askOrder = matchResult.askOrder;
      const bidOrder = matchResult.bidOrder;
      const escrowId = `CX-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

      // BẤT BIẾN NGUYÊN TỬ (ATOMICITY — MIT INVARIANT):
      // Khớp lệnh gồm 3 thao tác ghi (lệnh ASK + lệnh BID + booking). Nếu tách rời,
      // một sự cố giữa chừng sẽ để lại ghế đã bị trừ mà KHÔNG có booking tương ứng —
      // sàn rơi vào trạng thái mâu thuẫn. Gói toàn bộ trong MỘT transaction SQLite:
      // hoặc cả 3 cùng thành công, hoặc không gì được ghi.
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

      // Bắn thông báo nghiệp vụ
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

    // 2b. CHƯA CÓ ĐỐI ỨNG THỎA MÃN -> LƯU LỆNH TREO (RESTING ORDER / OPEN)
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
 * Xem Sổ Lệnh Hai Chiều (LOB) theo từng trạm đón (Depth of Market)
 */
export function getOrderBookHandler(req, res) {
  try {
    const { corridor = 'Tuyến QL13', direction, date } = req.query || {};
    const filters = { status: 'OPEN', corridor };
    if (direction) filters.direction = direction;
    if (date) filters.date = date;

    const openOrders = getExchangeOrdersDb(filters);

    // Gom nhóm theo từng trạm đón
    const stationMap = new Map();
    for (const order of openOrders) {
      const stnKey = order.stationId || order.stationName || 'Trạm chung';
      if (!stationMap.has(stnKey)) {
        stationMap.set(stnKey, {
          stationId: order.stationId || '',
          stationName: order.stationName || stnKey,
          asks: [], // Chủ xe bán ghế
          bids: []  // Khách mua ghế
        });
      }
      const stn = stationMap.get(stnKey);
      // Mọi lệnh ra sàn công khai đều phải đi qua lớp chắn PII (Nghị định 13/2023)
      const publicOrder = sanitizeOrderForPublic(order, req.user);
      if (order.orderType === 'ASK') {
        stn.asks.push(publicOrder);
      } else {
        stn.bids.push(publicOrder);
      }
    }

    // Sắp xếp thứ tự thời gian trong từng trạm
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
 * Lấy lịch sử lệnh của người dùng hiện tại
 */
export function getMyOrdersHandler(req, res) {
  try {
    // CHỐNG DÒ QUÉT (ANTI-ENUMERATION): danh tính CHỈ được lấy từ JWT.
    // Trước đây handler nhận `?phone=` từ query — bất kỳ ai biết số điện thoại
    // của người khác đều đọc được toàn bộ lịch sử lệnh của họ mà không cần đăng nhập.
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
 * Kích hoạt phiên quét tự động hủy các lệnh OPEN đã quá hạn Dynamic Sliding TTL
 */
export async function expireSlidingTTLHandler(req, res) {
  try {
    // CHỐNG DoS NGHIỆP VỤ: mốc thời gian quét TTL LUÔN là đồng hồ máy chủ.
    // Trước đây handler nhận `timestamp` từ body — một POST ẩn danh với
    // timestamp ở tương lai xa sẽ EXPIRE sạch toàn bộ sổ lệnh của cả sàn.
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

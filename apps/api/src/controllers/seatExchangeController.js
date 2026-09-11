/**
 * seatExchangeController.js
 *
 * CONTROLLER: SÀN GIAO DỊCH GHẾ TRỐNG (SEAT EXCHANGE)
 * Sổ Lệnh Hai Chiều (Limit Order Book - LOB) & Khớp Lệnh Liên Tục (Continuous Double Auction - CDA)
 * Thị trường giao ngay 24/7 (Continuous Spot Market) & Dynamic Sliding TTL.
 */

import {
  parseTimeToMinutes,
  minutesToTimeString,
  buildInterval,
  calculateOrderTTL,
  matchOrderContinuous,
  evaluateOrderBookExpirations,
  buildOrderMatchedNotification,
  buildOrderExpiredNotification,
  cleanPhoneNumber,
  isValidVietnamesePhone,
  VIRTUAL_HUBS
} from '@carmate/shared';

import {
  createExchangeOrderDb,
  getExchangeOrdersDb,
  getExchangeOrderByIdDb,
  updateExchangeOrderDb,
  expireSlidingTTLOrdersDb,
  addBooking
} from '../db/sqliteStore.js';

import { sendBusinessAlert } from '../utils/telegramAlert.js';

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
      vehicleModel = '',
      trustScore = 98
    } = req.body || {};

    const clean = cleanPhoneNumber(phone || req.user?.phone || '');
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

    // Tính toán TTL và phân tầng kỳ vọng
    const ttlResult = calculateOrderTTL({
      orderCreatedAt: now,
      targetPickupMinutes: targetTimeMinutes,
      pickupDate: date
    });

    const isAsk = orderType.toUpperCase() === 'ASK';
    const parsedSeats = Number(seats) || 1;

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
      orderTier: ttlResult.tier,
      ttlTimestamp: ttlResult.ttlTimestamp,
      ttlTimeString: ttlResult.ttlTimeString,
      phone: clean,
      contactName: contactName || (isAsk ? 'Chủ xe' : 'Người đi cùng'),
      plate: plate || (isAsk ? '93A-541.86' : ''),
      vehicleModel: vehicleModel || (isAsk ? 'Xe 5-7 chỗ' : ''),
      trustScore: Number(trustScore) || (req.user?.trustScore ?? 98),
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

      // Cập nhật cả 2 lệnh trong DB
      if (newOrder.orderType === 'ASK') {
        await createExchangeOrderDb({ ...askOrder, matchedBookingId: escrowId });
        await updateExchangeOrderDb(bidOrder.id, {
          status: bidOrder.status,
          matchedWithOrderId: askOrder.id,
          matchedBookingId: escrowId,
          rendezvousTime: matchResult.rendezvousTime,
          rendezvousMinutes: matchResult.rendezvousMinutes,
          pinCode: matchResult.pinCode,
          matchedAt: now
        });
      } else {
        await createExchangeOrderDb({ ...bidOrder, matchedBookingId: escrowId });
        await updateExchangeOrderDb(askOrder.id, {
          status: askOrder.status,
          remainingSeats: askOrder.remainingSeats,
          matchedWithOrderId: bidOrder.id,
          matchedBookingId: escrowId,
          rendezvousTime: matchResult.rendezvousTime,
          rendezvousMinutes: matchResult.rendezvousMinutes,
          pinCode: matchResult.pinCode,
          matchedAt: now
        });
      }

      // Tạo booking chính thức trong hệ thống
      await addBooking({
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
      order: savedOrder,
      tier: ttlResult.tier,
      tierLabel: ttlResult.tierLabel,
      ttlTimeString: ttlResult.ttlTimeString,
      message: ttlResult.userMessage
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
      if (order.orderType === 'ASK') {
        stn.asks.push(order);
      } else {
        stn.bids.push(order);
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
    const userId = req.user?.id;
    const phone = req.user?.phone || req.query?.phone;

    if (!userId && !phone) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin nhận diện người dùng' });
    }

    const clean = phone ? cleanPhoneNumber(phone) : null;
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
    const now = req.body?.timestamp ? Number(req.body.timestamp) : Date.now();
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

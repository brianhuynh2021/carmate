import { addStationRequest, getStationRequests, updateStationRequestStatus } from '../db/sqliteStore.js';
import { sendTelegramMessage } from '../utils/telegramAlert.js';
import { cleanPhoneNumber } from '@carmate/shared';

/**
 * Tạo mới hoặc tăng lượt gom đề xuất mở trạm ảo (Station Request Pool)
 * Ngăn chặn việc đón tự do ngoài đường gây bẫy phạt nguội P.130 và ức chế chủ xe.
 */
export async function createStationRequestHandler(req, res) {
  try {
    const { stationName, note, lat, lng, userPhone } = req.body || {};

    if (!stationName || typeof stationName !== 'string' || stationName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Tên trạm hoặc vị trí đề xuất cần tối thiểu 2 ký tự'
      });
    }

    const phone = userPhone || req.user?.phone || '';
    const cleanedPhone = cleanPhoneNumber(phone);

    const result = await addStationRequest({
      stationName: stationName.trim(),
      note: note ? String(note).trim() : '',
      lat: lat != null ? Number(lat) : null,
      lng: lng != null ? Number(lng) : null,
      userPhone: cleanedPhone
    });

    // Cảnh báo Telegram cho Admin khi có đề xuất hoặc đạt ngưỡng khảo sát
    try {
      const isThresholdMet = result.requestCount >= 50;
      const teleMsg = isThresholdMet
        ? `🔥 <b>[CARMATE THRESHOLD MET] ĐẠT NGƯỠNG KHẢO SÁT TRẠM MỚI!</b>\n` +
          `📍 <b>Điểm đề xuất:</b> ${result.stationName}\n` +
          `📊 <b>Số lượt yêu cầu:</b> ${result.requestCount}/50\n` +
          `📝 <b>Ghi chú an toàn:</b> ${result.note || 'Không có'}\n` +
          `📞 <b>Liên hệ gần nhất:</b> ${cleanedPhone || 'Ẩn danh'}\n` +
          `⚡ <i>Hành động: Khảo sát thực địa bãi đỗ an toàn ngoài hành lang QL13 trước khi cắm Trạm ảo!</i>`
        : `💡 <b>[CARMATE] ĐỀ XUẤT MỞ TRẠM MỚI TỪ CỘNG ĐỒNG</b>\n` +
          `📍 <b>Điểm:</b> ${result.stationName}\n` +
          `📊 <b>Lượt gom:</b> ${result.requestCount}/50\n` +
          `📝 <b>Ghi chú:</b> ${result.note || 'Không có'}\n` +
          `📞 <b>SĐT:</b> ${cleanedPhone || 'Không cung cấp'}`;

      sendTelegramMessage(teleMsg, { parseMode: 'HTML', req }).catch(() => {});
    } catch {
      // Non-blocking telegram alert
    }

    return res.status(201).json({
      success: true,
      request: result,
      threshold: 50,
      message: result.requestCount >= 50
        ? `Đã đạt ${result.requestCount}/50 đề xuất! CarMate sẽ cử đội ngũ khảo sát thực địa bãi đỗ an toàn.`
        : `Đã ghi nhận đề xuất! Hiện có ${result.requestCount}/50 lượt yêu cầu mở trạm tại khu vực này.`
    });
  } catch (error) {
    console.error('[StationRequestController] Lỗi tạo đề xuất:', error);
    return res.status(500).json({
      success: false,
      error: 'Không thể lưu đề xuất mở trạm. Vui lòng thử lại sau.'
    });
  }
}

/**
 * Lấy danh sách các đề xuất mở trạm mới (sắp xếp theo số lượt yêu cầu giảm dần)
 */
export async function listStationRequestsHandler(req, res) {
  try {
    const { status } = req.query || {};
    const requests = getStationRequests(status || '');
    return res.json({
      success: true,
      requests,
      count: requests.length
    });
  } catch (error) {
    console.error('[StationRequestController] Lỗi lấy danh sách đề xuất:', error);
    return res.status(500).json({
      success: false,
      error: 'Không thể tải danh sách đề xuất trạm'
    });
  }
}

/**
 * Quản trị viên cập nhật trạng thái đề xuất trạm (pending -> surveying -> approved / rejected)
 */
export async function updateStationRequestStatusHandler(req, res) {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body || {};

    if (!['pending', 'surveying', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Trạng thái không hợp lệ (pending, surveying, approved, rejected)'
      });
    }

    const updated = await updateStationRequestStatus(id, status, adminNote || '');
    return res.json({
      success: true,
      updated
    });
  } catch (error) {
    console.error('[StationRequestController] Lỗi cập nhật đề xuất:', error);
    return res.status(500).json({
      success: false,
      error: 'Không thể cập nhật trạng thái đề xuất'
    });
  }
}

/**
 * transitDirectoryController.js
 * Danh bạ nhà xe tuyến cố định — "lưới đỡ" khi CarMate chưa có chuyến hợp giờ.
 *
 * Chiến lược: khách mở app luôn nhận được giá trị, kể cả khi sàn chưa có xe.
 * Nhưng giá trị đó phải THẬT — một số điện thoại sai còn tệ hơn không có số.
 */

import { getTransitDirectory, saveTransitDirectory } from '../db/sqliteStore.js';

/** Chỉ số đã gọi kiểm chứng mới được lộ ra cho khách. */
function publicView(list, corridor) {
  return list
    .filter((p) => p.verified === true && p.hotline)
    .filter((p) => !corridor || !p.corridor || p.corridor === corridor)
    .map((p) => ({
      id: p.id,
      operator: p.operator,
      hotline: p.hotline,
      type: p.type || 'intercity_coach',
      frequency: p.frequency || null,
      note: p.note || null
    }));
}

/**
 * GET /api/transit-directory?corridor=...
 * Danh bạ công khai. Chỉ trả số ĐÃ kiểm chứng — số chưa kiểm chứng vẫn nằm
 * trong database cho đội vận hành theo dõi, nhưng không bao giờ tới tay khách.
 */
export function getTransitDirectoryHandler(req, res) {
  try {
    const corridor = req.query?.corridor || null;
    const all = getTransitDirectory();
    const data = publicView(all, corridor);
    return res.json({
      success: true,
      data,
      // Nói thật với giao diện là chưa có số nào, để nó chuyển sang chỉ dẫn
      // thực địa thay vì hiện một danh sách rỗng vô nghĩa.
      hasVerified: data.length > 0
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/** GET /api/admin/transit-directory — Admin thấy CẢ số chưa kiểm chứng. */
export function getAdminTransitDirectoryHandler(req, res) {
  try {
    const all = getTransitDirectory();
    return res.json({
      success: true,
      data: all,
      verifiedCount: all.filter((p) => p.verified === true && p.hotline).length,
      totalCount: all.length
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/** PUT /api/admin/transit-directory — Admin cập nhật toàn bộ danh bạ. */
export function updateAdminTransitDirectoryHandler(req, res) {
  try {
    const { providers } = req.body || {};
    if (!Array.isArray(providers)) {
      return res.status(400).json({
        success: false,
        error: 'Dữ liệu danh bạ không hợp lệ (cần danh sách array)'
      });
    }

    const cleaned = providers.map((p, idx) => {
      const hotline = String(p.hotline || '').trim();
      const isVerified = p.verified === true && hotline.length >= 4;
      return {
        id: p.id || `TRANSIT-${Date.now()}-${idx}`,
        operator: String(p.operator || '').trim(),
        corridor: p.corridor || 'Tuyến QL13',
        hotline,
        type: p.type || 'intercity_coach',
        frequency: String(p.frequency || '').trim() || null,
        note: String(p.note || '').trim() || null,
        verified: isVerified,
        // Dấu vết kiểm chứng: ai gọi, gọi lúc nào. Có tranh cãi về sau thì
        // còn lần được, thay vì chỉ có một cờ boolean trơ trọi.
        verifiedAt: isVerified ? p.verifiedAt || new Date().toISOString().slice(0, 10) : null,
        verifiedBy: isVerified ? String(p.verifiedBy || '').trim() || null : null
      };
    });

    const invalid = cleaned.find((p) => !p.operator);
    if (invalid) {
      return res.status(400).json({ success: false, error: 'Mỗi nhà xe phải có tên' });
    }

    saveTransitDirectory(cleaned);
    return res.json({
      success: true,
      message: 'Đã cập nhật danh bạ nhà xe',
      data: cleaned,
      verifiedCount: cleaned.filter((p) => p.verified).length
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

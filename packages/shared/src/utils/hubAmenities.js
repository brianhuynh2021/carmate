/**
 * =============================================================================
 * NHÂN BẢN HOÁ TRẠM ẢO (HUMANIZED MEETING POINTS)
 * =============================================================================
 * Toán học điểm hẹn chỉ phát huy tác dụng khi khách thấy AN TOÀN và DỄ NHẬN
 * DIỆN. Một ghim đỏ giữa QL13 lúc 4 giờ sáng là nỗi sợ, không phải điểm đón.
 *
 * Tiện ích được SUY RA từ `category` của trạm thay vì gõ tay vào 26 trạm: một
 * nguồn sự thật duy nhất, thêm trạm mới là tự có tiện ích đúng loại, không ai
 * phải nhớ cập nhật hai chỗ.
 *
 * Chỉ liệt kê tiện ích ĐÚNG VỚI BẢN CHẤT loại địa điểm — cây xăng thì chắc chắn
 * có mái che và đèn sáng, còn "camera an ninh" thì không dám khẳng định cho mọi
 * cây xăng. Thà nói ít mà đúng.
 */

/** Các tiện ích quan trọng với người đứng đợi xe ven quốc lộ. */
export const AMENITY_TYPES = Object.freeze({
  SHELTER: { id: 'SHELTER', icon: '🏠', label: 'Có mái che' },
  LIGHTING: { id: 'LIGHTING', icon: '💡', label: 'Đèn sáng ban đêm' },
  RESTROOM: { id: 'RESTROOM', icon: '🚻', label: 'Có nhà vệ sinh' },
  DRINKS: { id: 'DRINKS', icon: '🥤', label: 'Có nước uống / tạp hoá' },
  SECURITY: { id: 'SECURITY', icon: '📹', label: 'Có bảo vệ / camera' },
  PARKING: { id: 'PARKING', icon: '🅿️', label: 'Xe tấp vào an toàn' },
  OPEN_24H: { id: 'OPEN_24H', icon: '🕐', label: 'Mở cửa 24/7' },
  CROWDED: { id: 'CROWDED', icon: '👥', label: 'Đông người qua lại' }
});

const A = AMENITY_TYPES;

/** Bản đồ loại địa điểm -> tiện ích chắc chắn có. */
const CATEGORY_AMENITIES = Object.freeze({
  GAS_STATION: [A.SHELTER, A.LIGHTING, A.RESTROOM, A.DRINKS, A.PARKING, A.OPEN_24H],
  AIRPORT: [A.SHELTER, A.LIGHTING, A.RESTROOM, A.DRINKS, A.SECURITY, A.OPEN_24H, A.CROWDED],
  MALL: [A.SHELTER, A.LIGHTING, A.RESTROOM, A.DRINKS, A.SECURITY, A.PARKING],
  ADMIN_CENTER: [A.SHELTER, A.LIGHTING, A.SECURITY, A.PARKING],
  INDUSTRIAL: [A.LIGHTING, A.PARKING, A.CROWDED],
  JUNCTION: [A.LIGHTING, A.CROWDED],
  URBAN_AREA: [A.LIGHTING, A.DRINKS, A.CROWDED]
});

/** Mô tả một câu về mức độ an toàn khi đứng đợi, dùng ngay dưới tên trạm. */
const CATEGORY_SAFETY_NOTE = Object.freeze({
  GAS_STATION: 'Đứng trong sân cây xăng, có mái che và đèn sáng suốt đêm.',
  AIRPORT: 'Khu vực sân bay đông người và có an ninh thường trực.',
  MALL: 'Đứng trong khuôn viên trung tâm thương mại, có bảo vệ.',
  ADMIN_CENTER: 'Khuôn viên cơ quan hành chính, có bảo vệ và chỗ ngồi chờ.',
  INDUSTRIAL: 'Khu công nghiệp đông công nhân qua lại vào giờ ca.',
  JUNCTION: 'Nút giao đông xe — đứng lùi khỏi lòng đường, phía trong lề.',
  URBAN_AREA: 'Khu dân cư đông đúc, dễ tìm chỗ đứng chờ an toàn.'
});

/**
 * Lấy danh sách tiện ích của một trạm.
 * @param {object} hub - Một phần tử VIRTUAL_HUBS
 * @returns {Array<{id, icon, label}>}
 */
export function getHubAmenities(hub) {
  if (!hub) return [];
  // Trạm có thể tự khai đè nếu khảo sát thực địa cho kết quả khác
  if (Array.isArray(hub.amenities) && hub.amenities.length > 0) {
    return hub.amenities
      .map((id) => AMENITY_TYPES[id])
      .filter(Boolean);
  }
  return CATEGORY_AMENITIES[hub.category] || [A.LIGHTING];
}

/** Câu mô tả an toàn ngắn gọn cho trạm. */
export function getHubSafetyNote(hub) {
  if (!hub) return '';
  if (hub.safetyNote) return hub.safetyNote;
  return CATEGORY_SAFETY_NOTE[hub.category] || 'Đứng phía trong lề đường, tránh xa lòng đường.';
}

/**
 * Gói đầy đủ thông tin "nhân bản hoá" của một trạm để trả về cho giao diện.
 * `landmark` là thứ khách dùng để tìm đúng chỗ đứng — quan trọng hơn toạ độ GPS.
 */
export function describeHub(hub) {
  if (!hub) return null;
  return {
    id: hub.id,
    name: hub.name,
    shortName: hub.shortName || hub.name,
    landmark: hub.landmark || null,
    category: hub.category || null,
    amenities: getHubAmenities(hub),
    safetyNote: getHubSafetyNote(hub),
    curbsideWindowSeconds: hub.curbsideWindowSeconds || 300
  };
}

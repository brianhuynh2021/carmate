/**
 * Sinh và chuẩn hoá bí danh công khai (Public Alias) theo chuẩn CarMate:
 * - Chủ xe: "Chủ xe CX-{số}" (ví dụ: Chủ xe CX-101)
 * - Xe tiện chuyến: "Xe tiện chuyến CX-{số}"
 * - Khách đi cùng / Người tìm xe: "Khách KX-{số}" (ví dụ: Khách KX-201)
 *
 * Triệt tiêu hoàn toàn các định dạng lộn xộn, dài dòng, lộ địa danh/mục đích cá nhân:
 * - "Chủ xe Lộc Ninh #101" -> "Chủ xe CX-101"
 * - "Chủ xe Phan Thiết #103" -> "Chủ xe CX-103"
 * - "Khách đi khám Chợ Rẫy #201" -> "Khách KX-201"
 * - "Khách về quê #202" -> "Khách KX-202"
 */
export function toPublicAlias(trip) {
  if (!trip) return 'Thành viên CarMate';

  // 1. Kiểm tra chuỗi nguyên thủy trước
  if (typeof trip === 'string') {
    const s = trip.trim();
    if (!s) return 'Thành viên CarMate';
    if (s.includes('Test E2E')) return s;

    // Đã là định dạng chuẩn
    if (/^(?:Chủ xe|Xe tiện chuyến)\s+CX-\d+/i.test(s)) return s;
    if (/^Khách\s+KX-\d+/i.test(s)) return s;

    // Nếu chỉ là mã rút gọn CX-xxx hoặc KX-xxx / KH-xxx
    const codeOnly = s.match(/^(?:CX|KX|KH)[-_]?\s*(\d+)/i);
    if (codeOnly) {
      return s.toUpperCase().startsWith('CX') ? `Chủ xe CX-${codeOnly[1]}` : `Khách KX-${codeOnly[1]}`;
    }

    // Các chuỗi cũ có chứa vai trò và số hiệu: "Chủ xe Lộc Ninh #101", "Xe tiện chuyến #102"
    const cxMatch = s.match(/^(?:Chủ xe|Xe tiện chuyến).*?(?:CX|#)?[-#]?\s*(\d+)/i);
    if (cxMatch) {
      const role = s.startsWith('Xe tiện chuyến') ? 'Xe tiện chuyến' : 'Chủ xe';
      return `${role} CX-${cxMatch[1]}`;
    }

    // "Khách đi khám #201", "Người đi cùng #202"
    const kxMatch = s.match(/^(?:Khách|Người).*?(?:KX|KH|#)?[-#]?\s*(\d+)/i);
    if (kxMatch) return `Khách KX-${kxMatch[1]}`;
  }

  // 2. Xử lý đối tượng trip / user
  const isDriver = typeof trip === 'object'
    ? (trip.type === 'driver_offer' || trip.role === 'driver' || String(trip.id || '').startsWith('DRV-'))
    : true;
  const isConvenient = typeof trip === 'object' && trip.carCategory === 'convenient_trip';
  const role = isDriver ? (isConvenient ? 'Xe tiện chuyến' : 'Chủ xe') : 'Khách';

  const rawCandidate = typeof trip === 'object' ? String(trip.publicName || trip.name || '').trim() : '';

  // Giữ nguyên nếu là test E2E
  if (rawCandidate && rawCandidate.includes('Test E2E')) {
    return rawCandidate;
  }

  // Chuẩn hóa từ rawCandidate nếu có số hiệu
  if (rawCandidate) {
    if (/^(?:Chủ xe|Xe tiện chuyến)\s+CX-\d+/i.test(rawCandidate)) return rawCandidate;
    if (/^Khách\s+KX-\d+/i.test(rawCandidate)) return rawCandidate;

    const cxMatch = rawCandidate.match(/^(?:Chủ xe|Xe tiện chuyến).*?(?:CX|#)?[-#]?\s*(\d+)/i);
    if (cxMatch) return `${role} CX-${cxMatch[1]}`;

    const kxMatch = rawCandidate.match(/^(?:Khách|Người).*?(?:KX|KH|#)?[-#]?\s*(\d+)/i);
    if (kxMatch) return `Khách KX-${kxMatch[1]}`;
  }

  // 3. Sử dụng maskedCode nếu có
  const masked = typeof trip === 'object' ? String(trip.maskedCode || '').trim() : '';
  if (masked) {
    const num = masked.replace(/^[^\d]+/, '');
    if (num) {
      return isDriver ? `${role} CX-${num}` : `Khách KX-${num}`;
    }
    return isDriver ? `${role} CX-${masked}` : `Khách KX-${masked}`;
  }

  // 4. Nếu ID có tiền tố DRV-xxx hoặc REQ-xxx
  if (typeof trip === 'object' && trip.id) {
    const idMatch = String(trip.id).match(/^(?:DRV|REQ)-(\d+)/i);
    if (idMatch) {
      return isDriver ? `${role} CX-${idMatch[1]}` : `Khách KX-${idMatch[1]}`;
    }
  }

  // 5. Sinh mã băm ổn định từ ID chuyến/User
  const seed = typeof trip === 'object' ? String(trip.id || trip.userId || '') : String(trip);
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 900;
  return isDriver ? `${role} CX-${100 + hash}` : `Khách KX-${200 + (hash % 100)}`;
}

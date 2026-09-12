/**
 * corridors.js — SỔ ĐĂNG KÝ HÀNH LANG (CORRIDOR REGISTRY)
 *
 * BẤT BIẾN SCALE: Giao diện TUYỆT ĐỐI không được biết "QL13" là gì.
 *
 * Trước đây trang chủ rẽ nhánh cứng theo TO_SAIGON / TO_BINH_PHUOC ở 19 chỗ,
 * nên thêm tuyến thứ ba đồng nghĩa phải sửa cả 19 nhánh đó và mọi chuỗi hiển
 * thị đi kèm. Nay mỗi hành lang chỉ là MỘT object khai báo ở đây; UI đọc từ
 * registry và tự dựng. Thêm tuyến mới = thêm một object, 0 dòng code UI.
 *
 * Mỗi hành lang có đúng hai đầu (endpoint A và B). "Chiều đi" chỉ là câu hỏi
 * đang đi từ đầu nào sang đầu nào — không còn khái niệm "về Sài Gòn" gắn chết
 * vào mã nguồn.
 */

import { VIRTUAL_HUBS } from './routes.js';

export const CORRIDORS = [
  {
    id: 'ql13',
    // Khớp với trường `corridor` trong VIRTUAL_HUBS
    dataKey: 'Tuyến QL13',
    shortName: 'QL13',
    name: 'Hành lang Quốc lộ 13',
    isDefault: true,
    status: 'live',
    endpoints: {
      // Đầu A: cụm đô thị (điểm đến của chiều "lên thành phố")
      a: {
        id: 'saigon',
        label: 'Sài Gòn',
        fullLabel: 'TP. Hồ Chí Minh',
        hubIds: [
          'hub_ql13_cho_ray',
          'hub_ql13_hang_xanh',
          'hub_ql13_san_bay_tsn',
          'hub_ql13_binh_trieu',
          'hub_ql13_van_phuc_city',
          'hub_ql13_nga4_binh_phuoc'
        ]
      },
      // Đầu B: cụm tỉnh (điểm xuất phát của chiều "lên thành phố")
      b: {
        id: 'binhphuoc',
        label: 'Bình Phước',
        fullLabel: 'Bình Phước & Bình Dương',
        hubIds: null // null = mọi hub còn lại của hành lang
      }
    }
  },
  {
    id: 'n2',
    dataKey: 'Tuyến N2 - Kiên Giang',
    shortName: 'N2',
    name: 'Hành lang N2 - Miền Tây',
    isDefault: false,
    status: 'draft',
    endpoints: {
      a: {
        id: 'saigon',
        label: 'Sài Gòn',
        fullLabel: 'TP. Hồ Chí Minh',
        hubIds: null // suy ra theo vĩ độ: cụm phía Bắc hành lang
      },
      b: {
        id: 'kiengiang',
        label: 'Kiên Giang',
        fullLabel: 'Kiên Giang & Miền Tây',
        hubIds: null
      }
    }
  }
];

/** Lấy toàn bộ hành lang đang phục vụ (chỉ tuyến live đang chạy thực tế). */
export function getActiveCorridors() {
  return CORRIDORS.filter((c) => c.status === 'live');
}

export function getCorridorById(id) {
  return CORRIDORS.find((c) => c.id === id) || null;
}

/** Tra hành lang theo trường `corridor` của hub (chuỗi trong dữ liệu trạm). */
export function getCorridorByDataKey(dataKey) {
  return CORRIDORS.find((c) => c.dataKey === dataKey) || null;
}

export function getDefaultCorridor() {
  return CORRIDORS.find((c) => c.isDefault) || CORRIDORS[0];
}

/** Toàn bộ trạm ảo thuộc một hành lang. */
export function getCorridorHubs(corridorId) {
  const c = getCorridorById(corridorId);
  if (!c) return [];
  return VIRTUAL_HUBS.filter((h) => h.corridor === c.dataKey);
}

/**
 * Phân trạm của hành lang về hai đầu A / B.
 *
 * Ưu tiên danh sách hubIds khai báo tường minh; nếu không có thì suy ra theo
 * vĩ độ (đầu A luôn là cụm gần cực Nam hơn với QL13, nên dùng mốc trung vị
 * để chia — cách này áp dụng được cho mọi hành lang chạy theo trục Bắc-Nam mà
 * không cần liệt kê tay từng trạm).
 */
export function getEndpointHubs(corridorId, endpointKey, heading = null) {
  const c = getCorridorById(corridorId);
  if (!c) return [];

  const hubs = getCorridorHubs(corridorId);
  const ep = c.endpoints[endpointKey];
  if (!ep) return [];

  let result = [];
  if (Array.isArray(ep.hubIds)) {
    result = hubs.filter((h) => ep.hubIds.includes(h.id));
  } else {
    // Suy luận theo vĩ độ: đầu A = nửa gần thành phố (vĩ độ thấp hơn với QL13).
    const other = endpointKey === 'a' ? 'b' : 'a';
    const otherIds = c.endpoints[other]?.hubIds;
    if (Array.isArray(otherIds)) {
      result = hubs.filter((h) => !otherIds.includes(h.id));
    } else {
      const lats = hubs.map((h) => h.lat).sort((x, y) => x - y);
      const median = lats[Math.floor(lats.length / 2)];
      result = endpointKey === 'a' ? hubs.filter((h) => h.lat < median) : hubs.filter((h) => h.lat >= median);
    }
  }

  // Sắp xếp thứ tự trạm hợp lý theo hướng tuyến (Stanford Ergonomics & MIT Invariants):
  // Tuyến QL13 chạy dọc trục Bắc-Nam (Đầu B = Bình Phước ở phía Bắc, Đầu A = Sài Gòn ở phía Nam).
  // - Nếu là đầu B (Bình Phước):
  //   + Khi heading === 'a_to_b' (Sài Gòn đi Bình Phước): xe chạy từ Nam ra Bắc, trả khách từ Lái Thiêu xuôi về Bù Đốp (lat tăng dần).
  //   + Khi heading === 'b_to_a' hoặc mặc định (Bình Phước về Sài Gòn): xe đón khách từ đầu tuyến Bù Đốp xuôi về Lái Thiêu (lat giảm dần).
  if (endpointKey === 'b') {
    if (heading === 'a_to_b') {
      result = [...result].sort((h1, h2) => (h1.lat || 0) - (h2.lat || 0));
    } else {
      result = [...result].sort((h1, h2) => (h2.lat || 0) - (h1.lat || 0));
    }
  }

  return result;
}

/**
 * Nhãn hiển thị của một chiều đi.
 * @param {string} corridorId
 * @param {'a_to_b'|'b_to_a'} heading
 */
export function getHeadingLabel(corridorId, heading) {
  const c = getCorridorById(corridorId);
  if (!c) return { from: '', to: '', short: '', full: '' };
  const [from, to] = heading === 'b_to_a' ? [c.endpoints.b, c.endpoints.a] : [c.endpoints.a, c.endpoints.b];
  return {
    from: from.label,
    to: to.label,
    short: `Về ${to.label}`,
    full: `${from.label} ➔ ${to.label}`
  };
}

/** Chiều ngược lại. */
export function flipHeading(heading) {
  return heading === 'a_to_b' ? 'b_to_a' : 'a_to_b';
}

/** Tìm hành lang phù hợp nhất với một toạ độ GPS (dùng để tự chọn tuyến). */
export function detectCorridorByCoords(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return getDefaultCorridor();

  let best = null;
  let bestDist = Infinity;
  for (const c of getActiveCorridors()) {
    for (const h of getCorridorHubs(c.id)) {
      const d = (h.lat - lat) ** 2 + (h.lng - lng) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
  }
  return best || getDefaultCorridor();
}

/** Xác định một hub thuộc đầu nào của hành lang. */
export function getHubEndpoint(corridorId, hubId) {
  if (getEndpointHubs(corridorId, 'a').some((h) => h.id === hubId)) return 'a';
  if (getEndpointHubs(corridorId, 'b').some((h) => h.id === hubId)) return 'b';
  return null;
}

/**
 * Location Auto-Suggest Controller
 * Tích hợp hệ thống tìm kiếm địa chỉ thông minh theo chuẩn Grab / Google Maps
 * Kết hợp cơ sở dữ liệu nút giao/bến xe liên tỉnh với dịch vụ Geocoding OpenStreetMap/Photon
 */

export const CURATED_LOCATIONS = [
  // --- BÌNH PHƯỚC & ĐÔNG NAM BỘ ---
  {
    name: 'Trung tâm Hành chính Huyện Hớn Quản',
    detail: 'Khu phố 3, TT. Tân Khai, Huyện Hớn Quản, Tỉnh Bình Phước',
    category: 'building',
    keywords: ['tan khai', 'hon quan', 'trung tam hanh chinh hon quan', 'binh phuoc', 'ql13']
  },
  {
    name: 'Trung tâm Y tế Khu vực Hớn Quản',
    detail: 'Quốc lộ 13, Phường Tân Khai, Huyện Hớn Quản, Bình Phước',
    category: 'hospital',
    keywords: ['benh vien hon quan', 'tan khai', 'y te hon quan', 'ql13']
  },
  {
    name: 'Chợ Tân Khai (Hớn Quản)',
    detail: 'Đường ĐT756C & Quốc lộ 13, TT. Tân Khai, Hớn Quản, Bình Phước',
    category: 'building',
    keywords: ['cho tan khai', 'hon quan', 'binh phuoc']
  },
  {
    name: 'Cổng chào TX. Bình Long',
    detail: 'Quốc lộ 13, Phường An Lộc, TX. Bình Long, Bình Phước',
    category: 'highway',
    keywords: ['binh long', 'an loc', 'cong chao binh long', 'binh phuoc']
  },
  {
    name: 'Ngã 4 Chơn Thành',
    detail: 'Nút giao QL13 & QL14, Phường Hưng Long, TX. Chơn Thành, Bình Phước',
    category: 'highway',
    keywords: ['chon thanh', 'nga 4 chon thanh', 'nga tu chon thanh', 'ql13', 'ql14']
  },
  {
    name: 'Cây xăng Petrolimex 17 (Lộc Ninh)',
    detail: 'Quốc lộ 13, Xã Lộc Hưng, Huyện Lộc Ninh, Bình Phước',
    category: 'station',
    keywords: ['cay xang 17', 'loc ninh', 'loc hung', 'binh phuoc']
  },
  {
    name: 'Bến xe Thành phố Đồng Xoài',
    detail: 'Đường Phú Riềng Đỏ, Phường Tân Bình, TP. Đồng Xoài, Bình Phước',
    category: 'station',
    keywords: ['dong xoai', 'ben xe dong xoai', 'phu rieng do']
  },

  // --- TP. HỒ CHÍ MINH ---
  {
    name: 'Nhà khách Quân đội (Cống Quỳnh)',
    detail: '168 Cống Quỳnh, Phường Phạm Ngũ Lão, Quận 1, TP. Hồ Chí Minh',
    category: 'building',
    keywords: ['nha khach quan doi', 'cong quynh', 'quan 1', 'pham ngu lao', 'sai gon']
  },
  {
    name: 'Đường Cống Quỳnh (Quận 1)',
    detail: 'Phường Bến Thành & Cầu Ông Lãnh, Quận 1, TP. Hồ Chí Minh',
    category: 'street',
    keywords: ['cong quynh', 'quan 1', 'ben thanh', 'cau ong lanh']
  },
  {
    name: 'Bệnh viện Từ Dũ',
    detail: '284 Cống Quỳnh, Phường Phạm Ngũ Lão, Quận 1, TP. Hồ Chí Minh',
    category: 'hospital',
    keywords: ['benh vien tu du', 'tu du', 'cong quynh', 'quan 1']
  },
  {
    name: 'Bến xe Miền Đông mới',
    detail: '501 Hoàng Hữu Nam, Phường Long Bình, TP. Thủ Đức, TP.HCM',
    category: 'station',
    keywords: ['ben xe mien dong moi', 'mien dong moi', 'thu duc', 'xa lo ha noi']
  },
  {
    name: 'Bến xe Miền Đông cũ',
    detail: '292 Đinh Bộ Lĩnh, Phường 26, Quận Bình Thạnh, TP.HCM',
    category: 'station',
    keywords: ['ben xe mien dong cu', 'dinh bo linh', 'binh thanh', 'cau binh trieu']
  },
  {
    name: 'Bến xe Miền Tây',
    detail: '395 Kinh Dương Vương, Phường An Lạc, Quận Bình Tân, TP.HCM',
    category: 'station',
    keywords: ['ben xe mien tay', 'kinh duong vuong', 'binh tan', 'an lac']
  },
  {
    name: 'Bến xe An Sương',
    detail: 'Quốc lộ 22, Xã Bà Điểm, Huyện Hóc Môn / Quận 12, TP.HCM',
    category: 'station',
    keywords: ['ben xe an suong', 'an suong', 'ql22', 'hoc mon', 'quan 12']
  },
  {
    name: 'Sân bay Quốc tế Tân Sơn Nhất',
    detail: 'Đường Trường Sơn, Phường 2, Quận Tân Bình, TP.HCM',
    category: 'airport',
    keywords: ['san bay tan son nhat', 'tan son nhat', 'tan binh', 'truong son']
  },
  {
    name: 'Ngã tư Hàng Xanh',
    detail: 'Giao lộ Điện Biên Phủ & Xô Viết Nghệ Tĩnh, Quận Bình Thạnh, TP.HCM',
    category: 'highway',
    keywords: ['hang xanh', 'nga tu hang xanh', 'dien bien phu', 'binh thanh']
  },
  {
    name: 'Ngã tư Bình Phước (Thủ Đức)',
    detail: 'Nút giao QL1A & QL13, Phường Hiệp Bình Phước, TP. Thủ Đức, TP.HCM',
    category: 'highway',
    keywords: ['nga 4 binh phuoc', 'nga tu binh phuoc', 'thu duc', 'ql13', 'ql1a']
  },
  {
    name: 'Chợ Bến Thành',
    detail: 'Đường Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
    category: 'building',
    keywords: ['cho ben thanh', 'ben thanh', 'quan 1', 'le loi']
  },

  // --- HÀ NỘI & MIỀN BẮC ---
  {
    name: 'Bến xe Mỹ Đình',
    detail: 'Số 20 Phạm Hùng, Phường Mỹ Đình 2, Quận Nam Từ Liêm, Hà Nội',
    category: 'station',
    keywords: ['ben xe my dinh', 'my dinh', 'pham hung', 'nam tu liem', 'ha noi']
  },
  {
    name: 'Bến xe Giáp Bát',
    detail: 'Km6 Đường Giải Phóng, Phường Giáp Bát, Quận Hoàng Mai, Hà Nội',
    category: 'station',
    keywords: ['ben xe giap bat', 'giap bat', 'giai phong', 'hoang mai', 'ha noi']
  },
  {
    name: 'Bến xe Nước Ngầm',
    detail: 'Số 1 Ngọc Hồi, Phường Hoàng Liệt, Quận Hoàng Mai, Hà Nội',
    category: 'station',
    keywords: ['ben xe nuoc ngam', 'nuoc ngam', 'ngoc hoi', 'hoang mai', 'ha noi']
  },
  {
    name: 'Bến xe Gia Lâm',
    detail: 'Số 9 Ngô Gia Khảm, Phường Gia Thụy, Quận Long Biên, Hà Nội',
    category: 'station',
    keywords: ['ben xe gia lam', 'gia lam', 'long bien', 'ha noi']
  },
  {
    name: 'Sân bay Quốc tế Nội Bài',
    detail: 'Xã Phú Minh, Huyện Sóc Sơn, Hà Nội (Nhà ga T1, T2)',
    category: 'airport',
    keywords: ['san bay noi bai', 'noi bai', 'soc son', 'ha noi']
  },
  {
    name: 'Nút giao Cổ Linh (Cao tốc 5B Hà Nội - Hải Phòng)',
    detail: 'Đường Cổ Linh, Phường Thạch Bàn, Quận Long Biên, Hà Nội',
    category: 'highway',
    keywords: ['nut giao co linh', 'co linh', 'cao toc 5b', 'long bien', 'ha noi']
  },
  {
    name: 'Bến xe Vĩnh Niệm (Hải Phòng)',
    detail: 'Đường Bùi Viện, Phường Vĩnh Niệm, Quận Lê Chân, Hải Phòng',
    category: 'station',
    keywords: ['ben xe vinh niem', 'vinh niem', 'bui vien', 'le chan', 'hai phong']
  },
  {
    name: 'Bến xe Cầu Rào (Hải Phòng)',
    detail: 'Số 1 Thiên Lôi, Phường Đằng Giang, Quận Ngô Quyền, Hải Phòng',
    category: 'station',
    keywords: ['ben xe cau rao', 'cau rao', 'thien loi', 'hai phong']
  },
  {
    name: 'Bến xe Bãi Cháy (Quảng Ninh)',
    detail: 'Số 17 Đường 279, Phường Bãi Cháy, TP. Hạ Long, Quảng Ninh',
    category: 'station',
    keywords: ['ben xe bai chay', 'bai chay', 'ha long', 'quang ninh']
  },

  // --- ĐÀ NẴNG & MIỀN TRUNG ---
  {
    name: 'Bến xe Trung tâm TP. Đà Nẵng',
    detail: 'Số 185 Tôn Đức Thắng, Phường Hòa Minh, Quận Liên Chiểu, Đà Nẵng',
    category: 'station',
    keywords: ['ben xe da nang', 'ton duc thang', 'lien chieu', 'da nang']
  },
  {
    name: 'Sân bay Quốc tế Đà Nẵng',
    detail: 'Đường Duy Tân, Phường Hòa Thuận Tây, Quận Hải Châu, Đà Nẵng',
    category: 'airport',
    keywords: ['san bay da nang', 'duy tan', 'hai chau', 'da nang']
  },
  {
    name: 'Bến xe Phía Nam TP. Huế',
    detail: 'Số 97 An Dương Vương, Phường An Đông, TP. Huế, Thừa Thiên Huế',
    category: 'station',
    keywords: ['ben xe hue', 'ben xe phia nam hue', 'an duong vuong', 'hue']
  },

  // --- VŨNG TÀU, BÌNH DƯƠNG, ĐỒNG NAI, TÂY NINH ---
  {
    name: 'Bến xe Thành phố Vũng Tàu',
    detail: 'Số 192 Nam Kỳ Khởi Nghĩa, Phường Thắng Tam, TP. Vũng Tàu',
    category: 'station',
    keywords: ['ben xe vung tau', 'nam ky khoi nghia', 'vung tau', 'ba ria']
  },
  {
    name: 'Cổng chào Thành phố Bà Rịa',
    detail: 'Quốc lộ 51, Phường Kim Dinh, TP. Bà Rịa, Bà Rịa - Vũng Tàu',
    category: 'highway',
    keywords: ['cong chao ba ria', 'ba ria', 'ql51', 'kim dinh']
  },
  {
    name: 'Bến xe Liên tỉnh Đà Lạt',
    detail: 'Số 1 Tô Hiến Thành, Phường 3, TP. Đà Lạt, Tỉnh Lâm Đồng',
    category: 'station',
    keywords: ['ben xe da lat', 'da lat', 'to hien thanh', 'lam dong']
  },
  {
    name: 'Khu du lịch Đại Nam (Bình Dương)',
    detail: 'Số 1765A Đại lộ Bình Dương, Phường Hiệp An, TP. Thủ Dầu Một',
    category: 'building',
    keywords: ['dai nam', 'thu dau mot', 'binh duong', 'hiep an']
  },
  {
    name: 'KCN Bàu Bàng',
    detail: 'Quốc lộ 13, Huyện Bàu Bàng, Tỉnh Bình Dương',
    category: 'highway',
    keywords: ['bau bang', 'kcn bau bang', 'ql13', 'binh duong']
  },
  {
    name: 'Bến xe Tây Ninh',
    detail: 'Đường Trưng Nữ Vương, Phường 2, TP. Tây Ninh, Tỉnh Tây Ninh',
    category: 'station',
    keywords: ['ben xe tay ninh', 'trung nu vuong', 'tay ninh']
  }
];

function removeAccents(str = '') {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/**
 * Tra cứu địa điểm theo từ khoá với ưu tiên điểm mốc giao thông & geocoding
 */
export async function suggestLocationsHandler(req, res) {
  const query = (req.query.q || '').trim();
  const limit = Math.min(Number(req.query.limit) || 8, 15);

  if (!query) {
    // Trả về các điểm nút giao thông quan trọng nhất khi chưa gõ
    return res.json({
      success: true,
      query: '',
      count: 6,
      data: CURATED_LOCATIONS.slice(0, 6)
    });
  }

  const cleanQ = removeAccents(query);
  const rawTokens = cleanQ.split(/[\s,.-]+/).filter(t => t.length >= 2);

  // 1. Tìm kiếm trong kho Curated với chấm điểm mức độ khớp (Matching Score)
  const localMatches = CURATED_LOCATIONS.map(item => {
    const normName = removeAccents(item.name);
    const normDetail = removeAccents(item.detail);
    const normKeywords = item.keywords.map(k => removeAccents(k)).join(' ');

    let score = 0;
    if (normName.includes(cleanQ)) score += 100;
    if (normDetail.includes(cleanQ)) score += 60;
    if (normKeywords.includes(cleanQ)) score += 80;

    // Khớp từng từ đơn lẻ (Token matching)
    let tokenMatches = 0;
    rawTokens.forEach(t => {
      if (normName.includes(t)) tokenMatches += 3;
      else if (normDetail.includes(t) || normKeywords.includes(t)) tokenMatches += 1;
    });
    score += tokenMatches * 15;

    return { ...item, score };
  })
  .filter(item => item.score > 0)
  .sort((a, b) => b.score - a.score);

  // 2. Gọi Photon Geocoding nếu truy vấn dài hơn 2 ký tự và chưa đủ kết quả
  let onlineMatches = [];
  if (query.length >= 2) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout an toàn

      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6`;
      const response = await fetch(photonUrl, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const json = await response.json();
        if (Array.isArray(json.features)) {
          onlineMatches = json.features
            .map(f => {
              const p = f.properties || {};
              const name = p.name || p.street || p.city || query;
              const parts = [
                p.housenumber ? `Số ${p.housenumber}` : null,
                p.street,
                p.locality,
                p.district,
                p.city || p.state,
                p.country
              ].filter(Boolean);

              // Loại bớt các kết quả trùng lặp
              const detail = parts.join(', ') || p.name;
              let category = 'building';
              if (p.osm_value === 'bus_stop' || p.osm_key === 'highway') category = 'station';
              else if (p.osm_key === 'aeroway') category = 'airport';
              else if (p.type === 'street' || p.osm_key === 'highway') category = 'street';

              return {
                name,
                detail,
                category,
                lat: f.geometry?.coordinates?.[1],
                lng: f.geometry?.coordinates?.[0],
                isOnline: true
              };
            })
            .filter(item => {
              // Lọc chỉ giữ kết quả tại Việt Nam hoặc liên quan
              const d = removeAccents(item.detail);
              return d.includes('viet nam') || d.includes('ho chi minh') || d.includes('ha noi') || d.includes('binh phuoc');
            });
        }
      }
    } catch (e) {
      // Offline hoặc timeout -> dùng kết quả local, không crash
      console.warn('[Location Suggest] Geocoding fallback to local cache:', e.message);
    }
  }

  // 3. Hợp nhất, khử trùng lặp và giới hạn số lượng trả về
  const seen = new Set();
  const merged = [];

  for (const item of [...localMatches, ...onlineMatches]) {
    const key = removeAccents(item.name).toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push({
        name: item.name,
        detail: item.detail,
        category: item.category || 'building',
        lat: item.lat,
        lng: item.lng
      });
    }
    if (merged.length >= limit) break;
  }

  return res.json({
    success: true,
    query,
    count: merged.length,
    data: merged
  });
}

/**
 * ============================================================================
 * FEEDER COORDINATOR FOR SPARSE-VEHICLE AREAS (HUB-HOPPING FEEDER ENGINE)
 * ============================================================================
 * 
 * Simulates an operations research phenomenon: the "Watershed Funnel Effect"
 * - Headwater area (Bù Đốp, Lộc Ninh): thin liquidity, few private cars.
 * - Mid-stream area (Bình Long, Tân Khai, Chơn Thành): dense liquidity.
 * - Automatically warns and suggests that passengers make a short hop to a major gathering station.
 */

const HUB_LIQUIDITY_MAP = {
  // ── HEADWATER BRANCH AREA (THIN LIQUIDITY - THIN) ──
  hub_ql13_budop: {
    status: 'THIN',
    badgeLabel: 'VÙNG GOM ĐẶT TRƯỚC',
    recommendedFeederHubId: 'hub_ql13_cho_loc_ninh',
    recommendedFeederHubName: 'TT. Lộc Ninh (Chợ Lộc Ninh / Cây xăng 17 QL13)',
    distanceToFeederKm: 15,
    transitAdvice: 'Nên đặt trước hoặc chạy xe máy ~15 phút ra Trạm Lộc Ninh (hoặc Bình Long) trên trục QL13 để đón xe ngay',
    densityRatio: 'gấp 4 lần'
  },

  // ── QL13 ROUTE START & MID-STREAM (ABUNDANT VEHICLE DENSITY - DENSE) ──
  hub_ql13_cho_loc_ninh: {
    status: 'DENSE',
    badgeLabel: 'ĐẦU TUYẾN QL13 - XE CHẠY THƯỜNG XUYÊN',
    densityNotice: 'Trục chính QL13, lượng xe cá nhân và tiện chuyến di chuyển về TP.HCM dồi dào'
  },
  hub_ql13_hoa_lu: { status: 'DENSE', badgeLabel: 'CỬA KHẨU QUỐC TẾ - XE CHẠY THƯỜNG XUYÊN' },
  hub_ql13_binh_long: { status: 'DENSE', badgeLabel: 'XE TIỆN CHUYẾN LIÊN TỤC' },
  hub_ql13_tthc_binh_long: { status: 'DENSE', badgeLabel: 'XE TIỆN CHUYẾN LIÊN TỤC' },
  hub_ql13_tan_khai: { status: 'MEDIUM', badgeLabel: 'MẬT ĐỘ XE TỐT (~3-5 PHÚT)' },
  hub_ql13_tthc_tan_khai: { status: 'MEDIUM', badgeLabel: 'MẬT ĐỘ XE TỐT (~3-5 PHÚT)' },
  hub_ql13_minh_hung: { status: 'MEDIUM', badgeLabel: 'MẬT ĐỘ XE TỐT' },
  hub_ql13_tthc_chon_thanh: { status: 'DENSE', badgeLabel: 'NÚT GIAO ĐẬM ĐẶC' },
  hub_ql13_vincom_chon_thanh: { status: 'DENSE', badgeLabel: 'NÚT GIAO ĐẬM ĐẶC' },
  hub_ql13_nga4_chon_thanh: { status: 'DENSE', badgeLabel: 'NÚT GIAO ĐẬM ĐẶC (QL14 & N2)' },
  hub_ql13_becamex_chon_thanh: { status: 'DENSE', badgeLabel: 'MẬT ĐỘ CAO' },
  hub_ql13_tthc_bau_bang: { status: 'MEDIUM', badgeLabel: 'MẬT ĐỘ XE TỐT' },
  hub_ql13_bau_bang: { status: 'MEDIUM', badgeLabel: 'MẬT ĐỘ XE TỐT' },
  hub_ql13_nga4_so_sao: { status: 'MEDIUM', badgeLabel: 'MẬT ĐỘ XE TỐT' },
  hub_ql13_vsip1: { status: 'DENSE', badgeLabel: 'KHU ĐÔ THỊ ĐẬM ĐẶC' },
  hub_ql13_van_phuc_city: { status: 'DENSE', badgeLabel: 'KHU ĐÔ THỊ ĐẬM ĐẶC' },
  hub_ql13_nga4_binh_phuoc: { status: 'DENSE', badgeLabel: 'CỬA NGÕ ĐẬM ĐẶC' },
  hub_ql13_binh_trieu: { status: 'DENSE', badgeLabel: 'CỬA NGÕ ĐẬM ĐẶC' },
  hub_ql13_hang_xanh: { status: 'DENSE', badgeLabel: 'GA CUỐI HUYẾT MẠCH' },
  hub_ql13_san_bay_tsn: { status: 'DENSE', badgeLabel: 'GA SÂN BAY HUYẾT MẠCH' }
};

/**
 * Look up a station's liquidity status and suggest a hop connection if the station has few vehicles
 * @param {string} hubId - Station identifier (e.g. 'hub_ql13_budop', 'hub_ql13_binh_long')
 * @returns {object} Liquidity classification and feeder suggestion
 */
export function getHubLiquidityStatus(hubId) {
  const cleanId = String(hubId || '').trim();
  const info = HUB_LIQUIDITY_MAP[cleanId] || { status: 'MEDIUM', badgeLabel: 'MẬT ĐỘ BÌNH THƯỜNG' };

  const isThin = info.status === 'THIN';

  let feederRecommendation = null;
  if (isThin && info.recommendedFeederHubId) {
    feederRecommendation = {
      targetHubId: info.recommendedFeederHubId,
      targetHubName: info.recommendedFeederHubName,
      distanceKm: info.distanceToFeederKm,
      transitAdvice: info.transitAdvice,
      densityRatio: info.densityRatio,
      estimatedWaitReductionMinutes: 20
    };
  }

  return {
    hubId: cleanId,
    status: info.status,
    badgeLabel: info.badgeLabel,
    isThin,
    feederRecommendation
  };
}

import { useState, useMemo, useEffect } from 'react';
import { isTripExpired, groupTripsByTemporalWindow } from '@carmate/shared';
import { trackSearchRoute } from '../utils/analytics.js';

// Đối chiếu địa danh thông minh chuẩn Đi Chung Xe Liên Tỉnh (Hai chiều & Hành lang Tỉnh / Bến xe)
export function matchLocationFuzzy(fieldValue, query) {
  if (!query || !query.trim()) return true;
  if (!fieldValue) return false;

  const normField = String(fieldValue).toLowerCase().trim();
  const normQuery = String(query).toLowerCase().trim();

  // 1. So khớp 2 chiều
  if (normField.includes(normQuery) || normQuery.includes(normField)) {
    return true;
  }

  // 2. Nhóm hành lang & đô thị liên tỉnh trọng điểm
  const corridorGroups = [
    ['sài gòn', 'sai gon', 'tp. hcm', 'tp hcm', 'tphcm', 'hồ chí minh', 'ho chi minh', 'miền đông', 'miền tây', 'an sương', 'tân sơn nhất', 'quận 1', 'quận 2', 'quận 3', 'quận 4', 'quận 5', 'quận 7', 'quận 9', 'quận 10', 'bình thạnh', 'thủ đức', 'gò vấp', 'cống quỳnh', 'nguyễn cư trinh', 'bến thành', 'hàng xanh', 'suối tiên'],
    ['bình phước', 'binh phuoc', 'bù đốp', 'bu dop', 'thanh hoà', 'thanh hoa', 'đồng xoài', 'dong xoai', 'chơn thành', 'chon thanh', 'phước long', 'phuoc long', 'lộc ninh', 'loc ninh', 'bù gia mập', 'bù đăng', 'hớn quản'],
    ['vũng tàu', 'vung tau', 'bà rịa', 'ba ria', 'phú mỹ', 'phu my', 'long hải', 'châu đức', 'xuyên mộc', 'bãi sau', 'bãi trước'],
    ['đà lạt', 'da lat', 'lâm đồng', 'lam dong', 'bảo lộc', 'bao loc', 'đức trọng', 'di linh', 'đơn dương', 'prenn'],
    ['hà nội', 'ha noi', 'nội bài', 'mỹ đình', 'giáp bát', 'nước ngầm', 'gia lâm', 'yên nghĩa', 'hoàn kiếm', 'cầu giấy'],
    ['hải phòng', 'hai phong', 'cầu rào', 'niệm nghĩa', 'đồ sơn', 'thuỷ nguyên'],
    ['cần thơ', 'can tho', 'bến tre', 'tiền giang', 'mỹ tho', 'đồng tháp', 'cao lãnh', 'vĩnh long', 'long an', 'tân an']
  ];

  for (const group of corridorGroups) {
    const fieldMatch = group.some(alias => normField.includes(alias));
    const queryMatch = group.some(alias => normQuery.includes(alias));
    if (fieldMatch && queryMatch) {
      return true;
    }
  }

  // 3. Khớp cụm từ khóa (Token matching: nếu có từ định danh >= 3 ký tự trùng nhau)
  const queryTokens = normQuery.split(/[\s,–—\-\/]+/).filter(t => t.length >= 3);
  const fieldTokens = normField.split(/[\s,–—\-\/]+/).filter(t => t.length >= 3);
  const common = queryTokens.filter(t => fieldTokens.includes(t));
  if (common.length >= 1) {
    return true;
  }

  return false;
}

/**
 * Custom Hook quản lý bộ lọc tìm kiếm & phân nhóm dữ liệu thị trường
 */
export default function useMarketFilters({ driverOffers = [], passengerRequests = [] }) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('all');
  const [selectedDirection, setSelectedDirection] = useState('all');
  const [marketViewMode, setMarketViewMode] = useState('all');
  const [selectedCarCategory, setSelectedCarCategory] = useState('all');
  const [temporalFilter, setTemporalFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(9);

  // Theo dõi sự kiện tìm kiếm tuyến đường vào Funnel Analytics
  useEffect(() => {
    if (searchFrom || searchTo || searchKeyword) {
      const timer = setTimeout(() => {
        trackSearchRoute(searchKeyword || `${searchFrom} - ${searchTo}`, {
          from: searchFrom,
          to: searchTo,
          timeSlot: selectedTimeSlot,
          direction: selectedDirection,
          carCategory: selectedCarCategory
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [searchFrom, searchTo, searchKeyword, selectedTimeSlot, selectedDirection, selectedCarCategory]);

  const resetFilters = () => {
    setSearchKeyword('');
    setSearchFrom('');
    setSearchTo('');
    setSelectedTimeSlot('all');
    setSelectedDirection('all');
    setMarketViewMode('all');
    setSelectedCarCategory('all');
  };

  const filteredItems = useMemo(() => {
    let list = [];
    if (marketViewMode === 'all' || marketViewMode === 'drivers') list = list.concat(driverOffers);
    if (marketViewMode === 'all' || marketViewMode === 'passengers') list = list.concat(passengerRequests);

    return list.filter((item) => {
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        const perksStr = Array.isArray(item.perks) ? item.perks.join(' ') : '';
        const parcelStr = item.acceptsParcel ? 'gửi hàng gửi đồ bưu phẩm' : '';
        const matchText = `${item.from} ${item.to} ${item.routeCategory} ${item.hometown || ''} ${item.notes || ''} ${perksStr} ${parcelStr}`.toLowerCase();
        if (!matchText.includes(kw)) return false;
      }
      if (searchFrom.trim()) {
        const fromField = `${item.from} ${item.hometown || ''}`;
        if (!matchLocationFuzzy(fromField, searchFrom)) return false;
      }
      if (searchTo.trim()) {
        const toField = `${item.to}`;
        if (!matchLocationFuzzy(toField, searchTo)) return false;
      }
      if (selectedTimeSlot !== 'all' && item.timeSlot !== selectedTimeSlot) return false;
      if (selectedDirection !== 'all' && item.direction !== selectedDirection) return false;
      if (selectedCarCategory !== 'all' && item.type === 'driver_offer') {
        const isConvenient = item.carCategory === 'convenient_trip' || item.notes?.toLowerCase().includes('tiện chuyến');
        if (selectedCarCategory === 'convenient_trip' && !isConvenient) return false;
        if (selectedCarCategory === 'family_car' && isConvenient) return false;
      }

      // Tự động loại bỏ các chuyến đã quá giờ (>30 phút sau khi khung giờ kết thúc) khỏi sàn công khai
      if (isTripExpired(item)) return false;

      return true;
    });
  }, [
    driverOffers,
    passengerRequests,
    marketViewMode,
    searchKeyword,
    searchFrom,
    searchTo,
    selectedTimeSlot,
    selectedDirection,
    selectedCarCategory
  ]);

  // Phân nhóm thời gian (Hôm nay / Ngày mai / Sắp tới) chuẩn Apple
  const temporalGroups = useMemo(() => {
    return groupTripsByTemporalWindow(filteredItems);
  }, [filteredItems]);

  const displayedMarketItems = useMemo(() => {
    let list = filteredItems;
    if (temporalFilter === 'today') list = temporalGroups.today;
    else if (temporalFilter === 'tomorrow') list = temporalGroups.tomorrow;
    else if (temporalFilter === 'upcoming') list = temporalGroups.upcoming;
    return list;
  }, [filteredItems, temporalFilter, temporalGroups]);

  const paginatedMarketItems = useMemo(() => {
    return displayedMarketItems.slice(0, visibleCount);
  }, [displayedMarketItems, visibleCount]);

  // Tự động reset số lượng chuyến hiển thị về 9 khi thay đổi bất kỳ bộ lọc nào
  useEffect(() => {
    setVisibleCount(9);
  }, [marketViewMode, selectedCarCategory, selectedTimeSlot, selectedDirection, searchKeyword, searchFrom, searchTo, temporalFilter]);

  return {
    searchKeyword,
    setSearchKeyword,
    searchFrom,
    setSearchFrom,
    searchTo,
    setSearchTo,
    selectedTimeSlot,
    setSelectedTimeSlot,
    selectedDirection,
    setSelectedDirection,
    marketViewMode,
    setMarketViewMode,
    selectedCarCategory,
    setSelectedCarCategory,
    temporalFilter,
    setTemporalFilter,
    visibleCount,
    setVisibleCount,
    resetFilters,
    filteredItems,
    temporalGroups,
    displayedMarketItems,
    paginatedMarketItems
  };
}

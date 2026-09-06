import React, { useState, useMemo, useEffect } from 'react';
import { SearchX, LayoutGrid, Car, Users, Sparkles, ChevronDown, MapPin, Navigation, Search, X, ArrowRight } from 'lucide-react';
import { 
  INITIAL_DRIVER_OFFERS, 
  INITIAL_PASSENGER_REQUESTS, 
  INITIAL_BOOKED_ESCROWS, 
  TIME_SLOTS,
  isTripExpired,
  groupTripsByTemporalWindow,
  getTomorrowISO,
  formatTripDateDisplay
} from '@carmate/shared';
import { Segmented } from './components/ui/Chip.jsx';
import { useI18n } from './i18n/index.jsx';
import api from './api/client.js';

// Layout
import Header from './components/common/Header.jsx';
import Footer from './components/common/Footer.jsx';
import BottomNavBar from './components/common/BottomNavBar.jsx';
import Toast from './components/common/Toast.jsx';
import PwaInstallPrompt from './components/common/PwaInstallPrompt.jsx';

// Market
import Hero from './components/market/Hero.jsx';
import FilterBar, { FilterPanel } from './components/market/FilterBar.jsx';
import RouteBenchmarkBar from './components/market/RouteBenchmarkBar.jsx';
import TripCard from './components/market/TripCard.jsx';

// Views
import PostTripForm from './components/post/PostTripForm.jsx';
import PostTripAuthGuard from './components/post/PostTripAuthGuard.jsx';
import MatchRadarView from './components/radar/MatchRadarView.jsx';
import BookedTripList from './components/booked/BookedTripList.jsx';
import TrustProfileView from './components/profile/TrustProfileView.jsx';
import MyTripsView from './components/post/MyTripsView.jsx';
const AdminDashboardView = React.lazy(() => import('./components/admin/AdminDashboardView.jsx'));

// Modals
import EscrowBookingModal from './components/modals/EscrowBookingModal.jsx';
import TrustProfileModal from './components/modals/TrustProfileModal.jsx';
import PolicyModal from './components/modals/PolicyModal.jsx';
import CancelModal from './components/modals/CancelModal.jsx';
import DelayModal from './components/modals/DelayModal.jsx';
import TicketShareModal from './components/modals/TicketShareModal.jsx';
import MutualReviewModal from './components/modals/MutualReviewModal.jsx';
import RouteDetailModal from './components/modals/RouteDetailModal.jsx';
import EditTripModal from './components/modals/EditTripModal.jsx';
import AuthModal from './components/modals/AuthModal.jsx';
import TermsModal from './components/modals/TermsModal.jsx';
import AiConciergeModal from './components/agent/AiConciergeModal.jsx';
import CarPhotosModal from './components/modals/CarPhotosModal.jsx';

import Button from './components/ui/Button.jsx';
import EmptyState from './components/ui/EmptyState.jsx';

export default function App() {
  const { t } = useI18n();

  // Đảm bảo giao diện Clean Light Theme sáng sủa, sạch sẽ mặc định
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  // Nhận diện Subdomain chuyên dụng: ops.carmate.vn / admin.carmate.vn / ?portal=ops
  const isOpsPortal = typeof window !== 'undefined' && (
    window.location.hostname.startsWith('ops.') ||
    window.location.hostname.startsWith('admin.') ||
    window.location.search.includes('portal=ops')
  );

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      if (
        window.location.hostname.startsWith('ops.') ||
        window.location.hostname.startsWith('admin.') ||
        window.location.search.includes('portal=ops') ||
        window.location.hash === '#admin'
      ) {
        return 'admin';
      }
    }
    return 'market';
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab]);

  // Hỗ trợ truy cập nhanh /#admin và tự động kích hoạt nếu ở subdomain ops
  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#admin' || isOpsPortal) {
        setActiveTab('admin');
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [isOpsPortal]);

  // Hỗ trợ phím tắt toàn cục ⌘K / Ctrl+K mở Trợ lý AI (Cursor Command Palette)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // ⌘K / Ctrl+K: Mở Trợ lý CarMate AI
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key?.toLowerCase() === 'k') {
        e.preventDefault();
        setShowAiModal(prev => !prev);
      }
      // ⌘+Shift+A / Ctrl+Shift+A: Kích hoạt Cổng Quản Trị bí mật (Không cần bấm trên UI)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key?.toLowerCase() === 'a') {
        e.preventDefault();
        setActiveTab(prev => (prev === 'admin' ? 'market' : 'admin'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Data
  const [driverOffers, setDriverOffers] = useState(INITIAL_DRIVER_OFFERS);
  const [passengerRequests, setPassengerRequests] = useState(INITIAL_PASSENGER_REQUESTS);
  const [bookedEscrows, setBookedEscrows] = useState(INITIAL_BOOKED_ESCROWS);
  const [platformStats, setPlatformStats] = useState(null);

  // Đồng bộ dữ liệu từ CarMate Backend API
  useEffect(() => {
    let active = true;
    async function fetchBackendData() {
      try {
        const [tripsRes, bookingsRes, statsRes] = await Promise.allSettled([
          api.getTrips(),
          api.getBookings(),
          api.getStats()
        ]);

        if (!active) return;

        if (tripsRes.status === 'fulfilled' && tripsRes.value?.success) {
          const { driverOffers: drivers, passengerRequests: passengers } = tripsRes.value.data || {};
          if (Array.isArray(drivers) && drivers.length > 0) setDriverOffers(drivers);
          if (Array.isArray(passengers) && passengers.length > 0) setPassengerRequests(passengers);
        }

        if (bookingsRes.status === 'fulfilled' && bookingsRes.value?.success) {
          const bookings = bookingsRes.value.data;
          if (Array.isArray(bookings)) {
            setBookedEscrows(bookings);
          }
        }

        if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
          setPlatformStats(statsRes.value.data);
        }
      } catch (err) {
        console.warn('[CarMate App] API sync warning:', err);
      }
    }

    fetchBackendData();
    return () => { active = false; };
  }, []);

  // Filters
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('all');
  const [selectedDirection, setSelectedDirection] = useState('all');
  const [marketViewMode, setMarketViewMode] = useState('all');
  const [selectedCarCategory, setSelectedCarCategory] = useState('all'); // 'all' | 'family_car' | 'convenient_trip'

  // Modals
  const [selectedItemForEscrow, setSelectedItemForEscrow] = useState(null);
  const [selectedDriverForTrust, setSelectedDriverForTrust] = useState(null);
  const [selectedTripForPhotos, setSelectedTripForPhotos] = useState(null);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [showBenchmarkModal, setShowBenchmarkModal] = useState(false);
  const [cancelRecord, setCancelRecord] = useState(null);
  const [delayRecord, setDelayRecord] = useState(null);
  const [ticketToShare, setTicketToShare] = useState(null);
  const [reviewRecord, setReviewRecord] = useState(null);
  const [selectedTripForRoute, setSelectedTripForRoute] = useState(null);
  const [editingTrip, setEditingTrip] = useState(null);
  const [myTripsCount, setMyTripsCount] = useState(0);
  const [toastMessage, setToastMessage] = useState(null);

  // Phân nhóm thời gian (Temporal Windowing) & Tải thêm (Progressive Loading)
  const [temporalFilter, setTemporalFilter] = useState('all'); // 'all' | 'today' | 'tomorrow' | 'upcoming'
  const [visibleCount, setVisibleCount] = useState(9);

  // Người dùng / Tài xế hiện tại
  const USER_KEY = 'carmate_user';
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalConfig, setAuthModalConfig] = useState({
    title: 'Đăng Nhập CarMate',
    subtitle: 'Đồng bộ bài đăng · Tiết kiệm chi phí · 100% an toàn',
    contextNotice: null,
    pendingTab: null
  });
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [pendingBookingTrip, setPendingBookingTrip] = useState(null);
  const [pendingPostTrip, setPendingPostTrip] = useState(null);

  // Mở AuthModal với ngữ cảnh & lời dẫn rõ ràng chuẩn Apple
  const openAuthWithContext = ({
    title = 'Đăng Nhập CarMate',
    subtitle = 'Đồng bộ bài đăng · Tiết kiệm chi phí · 100% an toàn',
    contextNotice = null,
    pendingTab = null
  } = {}) => {
    setAuthModalConfig({ title, subtitle, contextNotice, pendingTab });
    setShowAuthModal(true);
  };

  // Guarded Action Interceptor: Chặn khách chưa đăng nhập vào form tạo xe
  const handleRequestPostTrip = () => {
    if (!currentUser) {
      openAuthWithContext({
        title: 'Đăng Nhập Để Tạo Chuyến Xe',
        subtitle: 'Xác thực tài khoản chính chủ để đăng bài & kết nối khách an toàn',
        contextNotice: 'Đăng nhập chính chủ để tạo chuyến xe và quản lý khách ghép',
        pendingTab: 'post'
      });
      return;
    }
    setActiveTab('post');
  };

  // Kích hoạt ghép chuyến có bảo vệ danh tính: Chưa đăng nhập sẽ yêu cầu xác thực OTP trước
  const handleInitiateBook = (trip) => {
    if (!currentUser) {
      setPendingBookingTrip(trip);
      openAuthWithContext({
        title: 'Xác Thực Để Ghép Chuyến',
        subtitle: 'Bảo vệ số điện thoại · Kết nối an toàn với chủ xe',
        contextNotice: `Ghép chuyến tuyến ${trip.from} ⇄ ${trip.to}`
      });
      showToast('Vui lòng xác thực số điện thoại để kết nối trực tiếp với chủ xe');
      return;
    }
    setSelectedItemForEscrow(trip);
  };

  const handleAuthSuccess = (user, tripIds = []) => {
    setCurrentUser(user);
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {}

    // Tự động gộp tất cả chuyến xe của tài khoản này vào mục "Bài của tôi" theo user key
    try {
      const userKey = `carmate_my_trip_ids_${user.id || user.phone}`;
      const stored = JSON.parse(localStorage.getItem(userKey) || '[]');
      const guestStored = JSON.parse(localStorage.getItem('carmate_guest_trip_ids') || '[]');
      const incoming = Array.isArray(tripIds) ? tripIds : [];
      const merged = Array.from(new Set([...incoming, ...stored, ...guestStored]));
      localStorage.setItem(userKey, JSON.stringify(merged));
      // Dọn sạch guest key và legacy key sau khi đã liên kết chính chủ
      localStorage.removeItem('carmate_guest_trip_ids');
      localStorage.removeItem('carmate_my_trip_ids');
    } catch {}

    updateMyTripsCount(user);
    showToast(`Chào mừng ${user.name}! Đã đăng nhập thành công.`);

    // Nếu có tab đang chờ mở (ví dụ: bấm Tạo chuyến trước khi login), tự động chuyển hướng
    if (authModalConfig.pendingTab) {
      setActiveTab(authModalConfig.pendingTab);
    }
    setAuthModalConfig({
      title: 'Đăng Nhập CarMate',
      subtitle: 'Đồng bộ bài đăng · Tiết kiệm chi phí · 100% an toàn',
      contextNotice: null,
      pendingTab: null
    });

    // Nếu người dùng có chuyến đang chờ đăng, tự động hoàn tất đăng chuyến
    if (pendingPostTrip) {
      const tripToPost = { ...pendingPostTrip };
      setPendingPostTrip(null);
      handlePostTrip(tripToPost, user);
    }

    // Nếu người dùng đã chọn chuyến trước khi đăng nhập, tự động mở modal ghép chuyến
    if (pendingBookingTrip) {
      setSelectedItemForEscrow(pendingBookingTrip);
      setPendingBookingTrip(null);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem('carmate_my_trip_ids');
      api.logout();
    } catch {}
    setMyTripsCount(0);
    showToast('Đã đăng xuất tài khoản.');
  };

  const updateMyTripsCount = (user = currentUser, offers = driverOffers, requests = passengerRequests) => {
    try {
      let storedIds = [];
      if (!user) {
        // Khi chưa đăng nhập (khách vãng lai), chỉ đếm chuyến do chính máy này tạo ở chế độ khách
        // Tự động dọn sạch cache legacy cũ nếu còn sót từ phiên test trước
        if (localStorage.getItem('carmate_my_trip_ids')) {
          localStorage.removeItem('carmate_my_trip_ids');
        }
        storedIds = JSON.parse(localStorage.getItem('carmate_guest_trip_ids') || '[]');
      } else {
        const userKey = `carmate_my_trip_ids_${user.id || user.phone}`;
        storedIds = JSON.parse(localStorage.getItem(userKey) || localStorage.getItem('carmate_my_trip_ids') || '[]');
      }
      if (!Array.isArray(storedIds)) storedIds = [];

      const all = [...(offers || []), ...(requests || [])];
      const userPhoneClean = user?.phone ? String(user.phone).replace(/\D/g, '') : '';

      // Đồng bộ chuẩn xác 100% với bộ lọc của MyTripsView
      const validTrips = all.filter((t) => {
        if (user) {
          if (t.userId && t.userId === user.id) return true;
          if (userPhoneClean && t.phoneReal && String(t.phoneReal).replace(/\D/g, '') === userPhoneClean) return true;
          return storedIds.includes(t.id);
        }
        return storedIds.includes(t.id);
      });

      // Tự động dọn dẹp các ID cũ/đã xoá khỏi localStorage để không tích lũy rác lệch badge
      if (all.length > 0 && storedIds.length > 0) {
        const cleanIds = storedIds.filter(id => all.some(t => t.id === id));
        if (cleanIds.length !== storedIds.length) {
          const storageKey = user ? `carmate_my_trip_ids_${user.id || user.phone}` : 'carmate_guest_trip_ids';
          localStorage.setItem(storageKey, JSON.stringify(cleanIds));
        }
      }

      setMyTripsCount(validTrips.length);
    } catch {
      setMyTripsCount(0);
    }
  };

  useEffect(() => {
    updateMyTripsCount(currentUser, driverOffers, passengerRequests);
    const handleStorageChange = () => updateMyTripsCount(currentUser, driverOffers, passengerRequests);
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [currentUser, driverOffers, passengerRequests]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

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

    // Hàm đối chiếu địa danh thông minh chuẩn Đi Chung Xe Liên Tỉnh (Hai chiều & Hành lang Tỉnh / Bến xe)
    const matchLocationFuzzy = (fieldValue, query) => {
      if (!query || !query.trim()) return true;
      if (!fieldValue) return false;

      const normField = String(fieldValue).toLowerCase().trim();
      const normQuery = String(query).toLowerCase().trim();

      // 1. So khớp 2 chiều: query chứa fieldValue (VD: "chợ thanh hoà, bù đốp" chứa "bù đốp")
      // hoặc fieldValue chứa query (VD: "Bù Đốp, Bình Phước" chứa "bù đốp")
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
    };

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
  }, [driverOffers, passengerRequests, marketViewMode, searchKeyword, searchFrom, searchTo, selectedTimeSlot, selectedDirection, selectedCarCategory]);

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

  // Tái đăng 1 chạm (1-Tap Re-publish) chuyến cũ cho ngày mai
  const handleRePublishTrip = async (trip) => {
    try {
      const tomorrowStr = getTomorrowISO();
      let createdTrip = null;

      try {
        const res = await api.republishTrip(trip.id, { date: tomorrowStr });
        if (res?.success && res?.data) {
          createdTrip = res.data;
        }
      } catch (err) {
        console.warn('Backend republish API error, fallback to client clone:', err.message);
      }

      if (!createdTrip) {
        const prefix = trip.type === 'passenger_request' ? 'REQ' : 'DRV';
        const codePrefix = trip.type === 'passenger_request' ? 'HK' : 'CX';
        createdTrip = {
          ...trip,
          id: `${prefix}-${Date.now()}`,
          maskedCode: `${codePrefix}-${Math.floor(100 + Math.random() * 900)}`,
          date: tomorrowStr,
          status: 'active',
          isHidden: 0,
          isBanned: 0,
          createdAt: Date.now()
        };
      }

      if (createdTrip.type === 'driver_offer') {
        setDriverOffers(prev => [createdTrip, ...prev]);
      } else {
        setPassengerRequests(prev => [createdTrip, ...prev]);
      }

      // Tự động gộp ID mới vào danh sách bài đăng của tài khoản
      try {
        const storageKey = currentUser
          ? `carmate_my_trip_ids_${currentUser.id || currentUser.phone}`
          : 'carmate_guest_trip_ids';
        const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const updated = [createdTrip.id, ...stored.filter(id => id !== createdTrip.id)];
        localStorage.setItem(storageKey, JSON.stringify(updated));
        updateMyTripsCount(currentUser);
      } catch {}

      showToast('⚡ Đã tái đăng chuyến thành công cho ngày mai!');
    } catch {
      showToast('Không thể tái đăng chuyến xe. Vui lòng thử lại!');
    }
  };

  // Handlers với kết nối Backend Engine
  const handlePostTrip = async (newTrip, authUser = currentUser) => {
    // Bắt buộc xác thực danh tính để bảo vệ liên hệ và quyền quản lý bài đăng
    if (!authUser) {
      setPendingPostTrip(newTrip);
      setShowAuthModal(true);
      showToast('Vui lòng xác thực SĐT hoặc Zalo để hoàn tất đăng chuyến');
      return;
    }

    newTrip.userId = authUser.id;
    if (authUser.phone && !newTrip.phoneReal) newTrip.phoneReal = authUser.phone;
    if (authUser.name && (!newTrip.publicName || newTrip.publicName.startsWith('Chủ xe #') || newTrip.publicName.startsWith('Khách #'))) {
      newTrip.publicName = authUser.name;
    }

    if (newTrip.type === 'driver_offer') setDriverOffers(prev => [newTrip, ...prev]);
    else setPassengerRequests(prev => [newTrip, ...prev]);
    showToast(t('toast.postSuccess'));
    setTicketToShare(newTrip);
    setActiveTab('market');

    // Lưu bài vào localStorage theo tài khoản đăng nhập chính chủ
    try {
      const storageKey = `carmate_my_trip_ids_${authUser.id || authUser.phone}`;
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const updated = [newTrip.id, ...stored.filter(id => id !== newTrip.id)];
      localStorage.setItem(storageKey, JSON.stringify(updated));
      updateMyTripsCount(authUser);
    } catch {}

    try {
      const res = await api.createTrip(newTrip);
      if (res?.success && res?.data) {
        if (newTrip.type === 'driver_offer') {
          setDriverOffers(prev => [res.data, ...prev.filter(i => i.id !== newTrip.id)]);
        } else {
          setPassengerRequests(prev => [res.data, ...prev.filter(i => i.id !== newTrip.id)]);
        }
        setTicketToShare(res.data);
        if (res.data.id !== newTrip.id) {
          try {
            const storageKey = `carmate_my_trip_ids_${authUser.id || authUser.phone}`;
            const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
            const updated = [res.data.id, ...stored.filter(id => id !== newTrip.id)];
            localStorage.setItem(storageKey, JSON.stringify(updated));
            updateMyTripsCount(authUser);
          } catch {}
        }
      }
    } catch (err) {
      console.warn('Backend sync failed, saved locally:', err);
    }
  };

  const handleEditTrip = async (tripId, updates) => {
    setDriverOffers(prev => prev.map(t => t.id === tripId ? { ...t, ...updates } : t));
    setPassengerRequests(prev => prev.map(t => t.id === tripId ? { ...t, ...updates } : t));
    showToast('Đã lưu thay đổi thông tin chuyến xe!');

    try {
      await api.updateTrip(tripId, updates);
    } catch (err) {
      console.warn('Lỗi cập nhật chuyến đi lên backend:', err);
    }
  };

  const handleToggleTripStatus = async (tripId, newStatus) => {
    const updates = { status: newStatus };
    setDriverOffers(prev => prev.map(t => t.id === tripId ? { ...t, ...updates } : t));
    setPassengerRequests(prev => prev.map(t => t.id === tripId ? { ...t, ...updates } : t));
    showToast(newStatus === 'full' ? 'Đã đổi sang: Đã đủ người' : 'Đã mở lại nhận khách');

    try {
      await api.updateTrip(tripId, updates);
    } catch (err) {
      console.warn('Lỗi cập nhật trạng thái chuyến đi:', err);
    }
  };

  const handleDeleteTrip = async (tripId) => {
    setDriverOffers(prev => prev.filter(t => t.id !== tripId));
    setPassengerRequests(prev => prev.filter(t => t.id !== tripId));
    try {
      const storageKey = currentUser ? `carmate_my_trip_ids_${currentUser.id || currentUser.phone}` : 'carmate_guest_trip_ids';
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const updated = stored.filter(id => id !== tripId);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      localStorage.removeItem('carmate_my_trip_ids');
      updateMyTripsCount(currentUser);
    } catch {}
    showToast('Đã xóa bài đăng chuyến đi thành công.');

    try {
      await api.deleteTrip(tripId);
    } catch (err) {
      console.warn('Lỗi xóa chuyến đi:', err);
    }
  };

  const handleViewTripInMarket = (trip) => {
    if (!trip) return;
    setActiveTab('market');
    if (trip.type === 'passenger' || trip.type === 'passenger_request') {
      setMarketViewMode('passengers');
    } else {
      setMarketViewMode('drivers');
    }
    setSelectedDirection('all');
    setSelectedTimeSlot('all');
    setSearchKeyword('');

    setTimeout(() => {
      const el = document.getElementById(`trip-${trip.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-primary-500', 'shadow-2xl');
        setTimeout(() => {
          el.classList.remove('ring-4', 'ring-primary-500', 'shadow-2xl');
        }, 3500);
      } else {
        const marketList = document.getElementById('market-trips-section');
        if (marketList) marketList.scrollIntoView({ behavior: 'smooth' });
      }
    }, 250);
  };

  const handleConfirmBooking = async (newEscrow) => {
    setBookedEscrows(prev => [newEscrow, ...prev]);
    setSelectedItemForEscrow(null);
    showToast(t('toast.bookSuccess', { id: newEscrow.escrowId }));
    setActiveTab('booked');

    try {
      await api.createBooking(newEscrow);
    } catch (err) {
      console.warn('Booking sync to backend failed:', err);
    }
  };

  const handleConfirmCancel = async (escrowId, { reason } = {}) => {
    setBookedEscrows(prev => prev.map(e => e.escrowId === escrowId ? { ...e, status: 'cancelled', cancelReason: reason } : e));
    setCancelRecord(null);
    showToast(t('toast.cancelEarly'));

    try {
      await api.cancelBooking(escrowId, reason);
    } catch (err) {
      console.warn('Cancel sync to backend failed:', err);
    }
  };

  const handleSendDelay = async (escrowId, minutes, note) => {
    setBookedEscrows(prev => prev.map(e => e.escrowId === escrowId ? { ...e, status: 'delayed', delayedMinutes: minutes, delayNote: note } : e));
    setDelayRecord(null);
    showToast(t('toast.delaySent', { n: minutes }));

    try {
      await api.reportDelay(escrowId, minutes, note);
    } catch (err) {
      console.warn('Delay sync to backend failed:', err);
    }
  };

  const handleCompleteTrip = async (escrowId, record) => {
    setBookedEscrows(prev => prev.map(e => e.escrowId === escrowId ? { ...e, status: 'completed' } : e));
    showToast(t('toast.completed'));

    // Mở ngay Modal đánh giá 2 chiều đối xứng cho chuyến đi
    const targetBooking = record || bookedEscrows.find(e => e.escrowId === escrowId);
    if (targetBooking) {
      setReviewRecord(targetBooking);
    }

    try {
      await api.completeBooking(escrowId);
      const stats = await api.getStats();
      if (stats?.success) setPlatformStats(stats.data);
    } catch (err) {
      console.warn('Complete sync to backend failed:', err);
    }
  };

  const handleSubmitReview = async ({ escrowId, reviewerRole, rating, tags, comment }) => {
    try {
      await api.submitReview(escrowId, { reviewerRole, rating, tags, comment });
      setBookedEscrows(prev => prev.map(e => {
        if (e.escrowId === escrowId) {
          const reviews = Array.isArray(e.reviews) ? e.reviews : [];
          return {
            ...e,
            reviews: [
              ...reviews.filter(r => r.reviewerRole !== reviewerRole),
              { reviewerRole, rating, tags, comment, createdAt: new Date().toISOString() }
            ]
          };
        }
        return e;
      }));
      showToast('Đã ghi nhận đánh giá cộng đồng thành công!');
    } catch (err) {
      console.warn('Review submission error:', err);
    }
  };

  const handleFooterNavigate = (key) => {
    const tabs = { market: 'market', match: 'match', post: 'post', admin: 'admin' };
    if (tabs[key]) return setActiveTab(tabs[key]);
    if (key === 'benchmark') { setActiveTab('market'); return setShowBenchmarkModal(true); }
    if (key === 'trust' || key === 'safety') {
      setSelectedDriverForTrust({
        publicName: 'Nguyễn Anh Tuấn',
        role: 'driver',
        hometown: 'Lộc Ninh, Bình Phước',
        trustScore: 98,
        safeTripsCount: 48,
        rating: 4.95,
        carModel: 'Mitsubishi Xpander (7 chỗ)',
        licensePlateMasked: '93A-289.xx'
      });
      return;
    }
    if (['policy', 'terms', 'privacy', 'dispute', 'community', 'help', 'faq', 'report'].includes(key)) return setShowPolicyModal(true);
    setActiveTab('market');
  };

  const filterProps = {
    searchKeyword, setSearchKeyword,
    selectedTimeSlot, setSelectedTimeSlot,
    selectedDirection, setSelectedDirection,
    marketViewMode, setMarketViewMode,
    onReset: resetFilters
  };

  const activeBookedCount = bookedEscrows.filter(b => b.status === 'zalo_active' || b.status === 'delayed').length;
  const container = 'max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8';

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f5f7] dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 antialiased transition-colors selection:bg-[#0071e3]/15 selection:text-[#0071e3]">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRequestPostTrip={handleRequestPostTrip}
        setShowPolicyModal={setShowPolicyModal}
        bookedCount={activeBookedCount}
        myTripsCount={myTripsCount}
        currentUser={currentUser}
        onOpenAuth={() => openAuthWithContext()}
        onLogout={handleLogout}
        onOpenAi={() => setShowAiModal(true)}
      />

      <main className="flex-1 pb-24 md:pb-0">
        {/* ── Tìm chuyến ── */}
        {activeTab === 'market' && (
          <>
            <Hero
              searchKeyword={searchKeyword}
              setSearchKeyword={setSearchKeyword}
              searchFrom={searchFrom}
              setSearchFrom={setSearchFrom}
              searchTo={searchTo}
              setSearchTo={setSearchTo}
              onPostClick={handleRequestPostTrip}
            />

            <div className={`${container} py-5 sm:py-6 space-y-5 relative z-10`}>

              {/* 2. Bảng giá tham chiếu thị trường (Sleek full-width indicator) */}
              <RouteBenchmarkBar
                searchKeyword={searchKeyword}
                setSearchKeyword={setSearchKeyword}
                forceOpen={showBenchmarkModal}
                onCloseForced={() => setShowBenchmarkModal(false)}
              />

              {/* 3. Thanh công cụ lọc trực quan (Role tabs + Lọc loại xe, chiều & Giờ) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5 pb-0.5">
                <div className="overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 py-0.5">
                  <Segmented
                    size="sm"
                    value={marketViewMode}
                    onChange={setMarketViewMode}
                    options={[
                      { value: 'all', label: `Tất cả (${driverOffers.length + passengerRequests.length})`, icon: LayoutGrid },
                      { value: 'drivers', label: `Chủ xe (${driverOffers.length})`, icon: Car },
                      { value: 'passengers', label: `Khách (${passengerRequests.length})`, icon: Users }
                    ]}
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Lọc loại xe (Xe gia đình / Xe tiện chuyến) - Apple Pill Select */}
                  <div className="relative inline-flex items-center">
                    <select
                      value={selectedCarCategory}
                      onChange={(e) => setSelectedCarCategory(e.target.value)}
                      aria-label="Lọc loại xe"
                      className="h-8.5 pl-3.5 pr-8 rounded-full text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer shadow-xs hover:border-slate-400 dark:hover:border-slate-600 outline-none appearance-none transition-colors"
                    >
                      <option value="all">Mọi loại xe</option>
                      <option value="family_car">Xe gia đình (Biển trắng)</option>
                      <option value="convenient_trip">Xe tiện chuyến (Biển vàng)</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                  </div>

                  {/* Lọc khung giờ - Apple Pill Select */}
                  <div className="relative inline-flex items-center">
                    <select
                      value={selectedTimeSlot}
                      onChange={(e) => setSelectedTimeSlot(e.target.value)}
                      aria-label="Chọn khung giờ"
                      className="h-8.5 pl-3.5 pr-8 rounded-full text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer shadow-xs hover:border-slate-400 dark:hover:border-slate-600 outline-none appearance-none transition-colors"
                    >
                      <option value="all">Tất cả khung giờ</option>
                      {TIME_SLOTS.map((slot) => (
                        <option key={slot.id} value={slot.id}>{slot.short}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                  </div>

                  {(selectedTimeSlot !== 'all' || marketViewMode !== 'all' || selectedCarCategory !== 'all' || searchKeyword || searchFrom || searchTo) && (
                    <Button variant="ghost" size="xs" onClick={resetFilters} className="text-xs font-bold text-[#0071e3] hover:text-[#0077ed]">
                      {t('market.resetFilters')}
                    </Button>
                  )}
                </div>
              </div>

              {/* Tag lọc đang áp dụng & Nút xem toàn quốc nhanh */}
              {(searchFrom || searchTo || searchKeyword) && (
                <div className="flex items-center gap-2 flex-wrap p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs text-xs">
                  <span className="text-slate-600 dark:text-slate-400 font-bold">Đang lọc:</span>
                  {searchFrom && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700 shadow-2xs">
                      <MapPin className="w-3 h-3 text-[#107c41]" />
                      <span>{searchFrom}</span>
                      <button
                        type="button"
                        onClick={() => setSearchFrom('')}
                        className="ml-1 p-0.5 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer rounded-full"
                        title="Bỏ lọc điểm đi này"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {searchTo && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700 shadow-2xs">
                      <Navigation className="w-3 h-3 text-[#ff3b30]" />
                      <span>{searchTo}</span>
                      <button
                        type="button"
                        onClick={() => setSearchTo('')}
                        className="ml-1 p-0.5 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer rounded-full"
                        title="Bỏ lọc điểm đến này"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {searchKeyword && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700 shadow-2xs">
                      <Search className="w-3 h-3 text-[#0071e3]" />
                      <span>{searchKeyword}</span>
                      <button
                        type="button"
                        onClick={() => setSearchKeyword('')}
                        className="ml-1 p-0.5 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer rounded-full"
                        title="Bỏ lọc từ khóa này"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="ml-auto text-[#0071e3] hover:text-[#0077ed] font-bold cursor-pointer inline-flex items-center gap-1 group transition-colors"
                  >
                    <span>Xem tất cả {driverOffers.length + passengerRequests.length}+ chuyến toàn quốc</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              )}

              {/* 4. Danh sách các chuyến xe với Phân Nhóm Thời Gian & Tải thêm mượt mà (Apple Temporal Windowing) */}
              <div id="market-results" className="space-y-4 scroll-mt-24">
                {/* Thanh chọn cửa sổ thời gian (Hôm nay / Ngày mai / Sắp tới) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 pb-1">
                  <div className="overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 py-0.5">
                    <div className="inline-flex items-center p-1 rounded-full bg-[#f2f2f5] dark:bg-slate-850 border border-black/[0.04] dark:border-white/[0.06] text-xs shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setTemporalFilter('all')}
                        className={`px-3.5 py-1.5 rounded-full font-semibold transition-all cursor-pointer ${
                          temporalFilter === 'all'
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Tất cả ({filteredItems.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTemporalFilter('today')}
                        className={`px-3.5 py-1.5 rounded-full font-semibold transition-all cursor-pointer ${
                          temporalFilter === 'today'
                            ? 'bg-white dark:bg-slate-900 text-[#0071e3] dark:text-[#2997ff] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Hôm nay ({temporalGroups.today.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTemporalFilter('tomorrow')}
                        className={`px-3.5 py-1.5 rounded-full font-semibold transition-all cursor-pointer ${
                          temporalFilter === 'tomorrow'
                            ? 'bg-white dark:bg-slate-900 text-[#107c41] dark:text-emerald-400 shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Ngày mai ({temporalGroups.tomorrow.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTemporalFilter('upcoming')}
                        className={`px-3.5 py-1.5 rounded-full font-semibold transition-all cursor-pointer ${
                          temporalFilter === 'upcoming'
                            ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Sắp tới ({temporalGroups.upcoming.length})
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono font-medium">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#107c41]"></span>
                    </span>
                    <span>Hiển thị {paginatedMarketItems.length} / {displayedMarketItems.length} chuyến</span>
                  </div>
                </div>

                {displayedMarketItems.length === 0 ? (
                  <EmptyState
                    icon={SearchX}
                    title={t('market.emptyTitle')}
                    description={
                      temporalFilter !== 'all'
                        ? `Không có chuyến đi nào phù hợp trong mục "${temporalFilter === 'today' ? 'Hôm nay' : temporalFilter === 'tomorrow' ? 'Ngày mai' : 'Sắp tới'}".`
                        : t('market.emptyDesc')
                    }
                    action={
                      <Button
                        variant="outline"
                        onClick={() => {
                          setTemporalFilter('all');
                          setSearchKeyword('');
                          resetFilters();
                        }}
                      >
                        {t('market.resetFilters')}
                      </Button>
                    }
                  />
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-6 lg:gap-7">
                      {paginatedMarketItems.map((item) => (
                        <TripCard
                          key={item.id}
                          item={item}
                          onBook={handleInitiateBook}
                          onShare={setTicketToShare}
                          onViewTrustProfile={setSelectedDriverForTrust}
                          onViewRoute={setSelectedTripForRoute}
                          onViewCarPhotos={setSelectedTripForPhotos}
                        />
                      ))}
                    </div>

                    {/* Progressive Loading: Tải thêm mượt mà khi danh sách nhiều hơn 9 chuyến */}
                    {displayedMarketItems.length > visibleCount && (
                      <div className="pt-6 pb-2 text-center">
                        <button
                          type="button"
                          onClick={() => setVisibleCount((prev) => prev + 9)}
                          className="px-6 py-3 rounded-full bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-800 dark:text-slate-200 border border-slate-200/90 dark:border-slate-800 font-semibold text-xs transition-all shadow-xs hover:shadow-sm active:scale-95 cursor-pointer inline-flex items-center gap-2"
                        >
                          <span>Xem thêm {Math.min(9, displayedMarketItems.length - visibleCount)} chuyến tiếp theo</span>
                          <span className="text-slate-400 font-normal">({displayedMarketItems.length - visibleCount} chuyến còn lại)</span>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'match' && (
          <div className={`${container} py-8`}>
            <MatchRadarView driverOffers={driverOffers} passengerRequests={passengerRequests} onBook={handleInitiateBook} onViewTrustProfile={setSelectedDriverForTrust} />
          </div>
        )}

        {activeTab === 'post' && (
          <div className={`${container} py-8`}>
            {!currentUser ? (
              <PostTripAuthGuard
                onOpenAuth={() => openAuthWithContext({
                  title: 'Đăng Nhập Để Tạo Chuyến Xe',
                  subtitle: 'Xác thực tài khoản chính chủ để đăng bài & kết nối khách an toàn',
                  contextNotice: 'Đăng nhập chính chủ để tạo chuyến xe và quản lý khách ghép',
                  pendingTab: 'post'
                })}
                onBackToMarket={() => setActiveTab('market')}
              />
            ) : (
              <PostTripForm onSubmit={handlePostTrip} currentUser={currentUser} onOpenAuth={() => openAuthWithContext()} />
            )}
          </div>
        )}

        {activeTab === 'my-trips' && (
          <div className={`${container} py-8`}>
            <MyTripsView
              driverOffers={driverOffers}
              passengerRequests={passengerRequests}
              currentUser={currentUser}
              onTripsCountChange={setMyTripsCount}
              onOpenAuth={() => openAuthWithContext()}
              onEditTrip={(trip) => setEditingTrip(trip)}
              onToggleStatus={handleToggleTripStatus}
              onDeleteTrip={handleDeleteTrip}
              onPostNew={handleRequestPostTrip}
              onRePublishTrip={handleRePublishTrip}
              onViewInMarket={handleViewTripInMarket}
              onViewTrip={(trip) => setTicketToShare(trip)}
              onViewCarPhotos={setSelectedTripForPhotos}
            />
          </div>
        )}

        {activeTab === 'booked' && (
          <div className={`${container} py-8`}>
            <BookedTripList
              bookedEscrows={bookedEscrows}
              onCancel={setCancelRecord}
              onDelay={setDelayRecord}
              onComplete={handleCompleteTrip}
              onReview={setReviewRecord}
              onFindTrip={() => setActiveTab('market')}
            />
          </div>
        )}

        {activeTab === 'admin' && (
          <React.Suspense
            fallback={
              <div className="min-h-[50vh] flex flex-col items-center justify-center gap-2 text-slate-400 text-xs font-medium">
                <span className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                <span>Đang tải cổng quản trị bảo mật...</span>
              </div>
            }
          >
            <AdminDashboardView
              onExitAdmin={() => {
                if (window.location.hash === '#admin') {
                  window.history.replaceState(null, '', window.location.pathname + window.location.search);
                }
                setActiveTab('market');
              }}
            />
          </React.Suspense>
        )}
      </main>

      <Footer onNavigate={handleFooterNavigate} onOpenTerms={() => setShowTermsModal(true)} />

      {/* Modals */}
      {selectedItemForEscrow && (
        <EscrowBookingModal
          item={selectedItemForEscrow}
          currentUser={currentUser}
          onClose={() => setSelectedItemForEscrow(null)}
          onConfirmBooking={handleConfirmBooking}
          onViewTrustProfile={setSelectedDriverForTrust}
        />
      )}
      {selectedDriverForTrust && (
        <TrustProfileModal
          item={selectedDriverForTrust}
          onClose={() => setSelectedDriverForTrust(null)}
          onBook={(item) => {
            setSelectedDriverForTrust(null);
            handleInitiateBook(item);
          }}
        />
      )}
      {ticketToShare && (
        <TicketShareModal trip={ticketToShare} onClose={() => setTicketToShare(null)} onShowToast={showToast} onViewInMarket={handleViewTripInMarket} />
      )}
      {editingTrip && (
        <EditTripModal
          trip={editingTrip}
          onClose={() => setEditingTrip(null)}
          onSave={handleEditTrip}
        />
      )}
      {showPolicyModal && <PolicyModal onClose={() => setShowPolicyModal(false)} />}
      {showTermsModal && <TermsModal onClose={() => setShowTermsModal(false)} />}
      {cancelRecord && (
        <CancelModal record={cancelRecord} onClose={() => setCancelRecord(null)} onConfirmCancel={handleConfirmCancel} />
      )}
      {delayRecord && (
        <DelayModal record={delayRecord} onClose={() => setDelayRecord(null)} onSendDelay={handleSendDelay} />
      )}
      {reviewRecord && (
        <MutualReviewModal
          booking={reviewRecord}
          onClose={() => setReviewRecord(null)}
          onSubmitReview={handleSubmitReview}
        />
      )}
      {selectedTripForRoute && (
        <RouteDetailModal
          trip={selectedTripForRoute}
          onClose={() => setSelectedTripForRoute(null)}
          onBook={(item) => {
            setSelectedTripForRoute(null);
            handleInitiateBook(item);
          }}
        />
      )}
      {selectedTripForPhotos && (
        <CarPhotosModal
          trip={selectedTripForPhotos}
          isOpen={!!selectedTripForPhotos}
          onClose={() => setSelectedTripForPhotos(null)}
        />
      )}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
          initialPhone={currentUser?.phone || ''}
          title={authModalConfig.title}
          subtitle={authModalConfig.subtitle}
          contextNotice={authModalConfig.contextNotice}
        />
      )}

      {/* Trợ Lý AI Chuyến Đi Modal */}
      <AiConciergeModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        onSelectTrip={(trip) => {
          setShowAiModal(false);
          handleViewTripInMarket(trip);
        }}
      />

      <BottomNavBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRequestPostTrip={handleRequestPostTrip}
        bookedCount={activeBookedCount}
        myTripsCount={myTripsCount}
      />
      <PwaInstallPrompt />
      <Toast message={toastMessage} />
    </div>
  );
}

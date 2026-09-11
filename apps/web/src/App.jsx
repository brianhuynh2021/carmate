import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SearchX, LayoutGrid, Car, Users, ChevronDown, MapPin, Navigation, Search, X, ArrowRight, ArrowLeft, Clock } from 'lucide-react';
import { TIME_SLOTS, normalizePhoneNumber, cleanPhoneNumber } from '@carmate/shared';
import { Segmented } from './components/ui/Chip.jsx';
import { useI18n } from './i18n/index.jsx';
import api from './api/client.js';

// Layout
import Header from './components/common/Header.jsx';
import Footer from './components/common/Footer.jsx';
import BottomNavBar from './components/common/BottomNavBar.jsx';
import Toast from './components/common/Toast.jsx';
import PwaInstallPrompt from './components/common/PwaInstallPrompt.jsx';
import AppleMacNotification from './components/common/AppleMacNotification.jsx';

// Market
import Hero from './components/market/Hero.jsx';
import TripCard from './components/market/TripCard.jsx';
import CorridorTimeline from './components/market/CorridorTimeline.jsx';
import CorridorMetroBoard from './components/market/CorridorMetroBoard.jsx';

// Views
import PostTripForm from './components/post/PostTripForm.jsx';
import PostTripAuthGuard from './components/post/PostTripAuthGuard.jsx';
import MatchRadarView from './components/radar/MatchRadarView.jsx';
import BookedTripList from './components/booked/BookedTripList.jsx';
import MyTripsView from './components/post/MyTripsView.jsx';
import CockpitMode from './components/cockpit/CockpitMode.jsx';
import StationRiderView from './components/station/StationRiderView.jsx';
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
import ZaloReentryModal from './components/modals/ZaloReentryModal.jsx';
import DriverQuickConfirmModal from './components/modals/DriverQuickConfirmModal.jsx';
import DeleteAccountModal from './components/modals/DeleteAccountModal.jsx';
import VehicleMismatchModal from './components/modals/VehicleMismatchModal.jsx';
import UnreachablePhoneModal from './components/modals/UnreachablePhoneModal.jsx';
import UserProfileModal from './components/profile/UserProfileModal.jsx';
import InboxModal from './components/modals/InboxModal.jsx';

// Custom Hooks
import useZaloReentry from './hooks/useZaloReentry.js';
import useMarketFilters from './hooks/useMarketFilters.js';
import useAppModals from './hooks/useAppModals.js';
import useTripsData from './hooks/useTripsData.js';

// Analytics & Sentry
import { initAnalytics, trackPageView, trackViewTrip } from './utils/analytics.js';
import { initSentry } from './utils/sentry.js';

import Button from './components/ui/Button.jsx';
import EmptyState from './components/ui/EmptyState.jsx';

const USER_KEY = 'carmate_user';

export default function App() {
  const { t } = useI18n();

  // Đảm bảo giao diện Clean Light Theme sáng sủa mặc định
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  // Khởi tạo Analytics và Giám sát ngoại lệ Sentry an toàn
  useEffect(() => {
    initAnalytics();
    initSentry();
  }, []);

  // Nhận diện Subdomain chuyên dụng: ops.carmate.vn / admin.carmate.vn / ?portal=ops
  const isOpsPortal =
    typeof window !== 'undefined' &&
    (window.location.hostname.startsWith('ops.') ||
      window.location.hostname.startsWith('admin.') ||
      window.location.search.includes('portal=ops'));

  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const canAccessAdmin = isOpsPortal || isLocalhost;

  // Danh mục Tab hợp lệ trên toàn hệ sinh thái CarMate
  const VALID_TABS = ['market', 'match', 'post', 'my-trips', 'booked', 'admin', 'cockpit', 'station'];

  // Ánh xạ Clean URL Pathname chuẩn Apple & Vercel (Zero #)
  const getPathForTab = (tab) => {
    if (tab === 'market') return '/';
    if (tab === 'match') return '/radar';
    if (tab === 'admin') return '/admin';
    if (tab === 'cockpit') return '/cockpit';
    if (tab === 'station') return '/tram';
    return `/${tab}`; // '/my-trips', '/post', '/booked'
  };

  const getTabFromUrl = useCallback(() => {
    if (typeof window === 'undefined') return 'market';

    // 1. Nhận diện Admin Portal chuyên dụng (Chuẩn MIT Invariant: cô lập trên admin.* / ops.*)
    if (
      isOpsPortal ||
      (isLocalhost &&
        (window.location.hash === '#admin' ||
          window.location.pathname === '/admin' ||
          window.location.pathname.startsWith('/admin')))
    ) {
      return 'admin';
    }

    // 2. Nhận diện Clean URL Pathname (/my-trips, /booked, /post, /radar, /match, /market, /admin, /cockpit, /tram)
    const rawPath = window.location.pathname.replace(/^\/+/, '').split('/')[0].trim().toLowerCase();
    if (rawPath === 'admin' && !canAccessAdmin) {
      // Chặn truy cập /admin trên domain chính (MIT Zero Attack Surface)
    } else if (rawPath === 'cockpit') {
      return 'cockpit';
    } else if (rawPath === 'tram' || rawPath === 'station') {
      return 'station';
    } else if (rawPath === 'radar' || rawPath === 'match') {
      return 'match';
    } else if (rawPath === 'my-trips' || rawPath === 'my_trips' || rawPath === 'mytrips') {
      return 'my-trips';
    } else if (rawPath === 'booked') {
      return 'booked';
    } else if (rawPath === 'post') {
      return 'post';
    } else if (rawPath === 'market') {
      return 'market';
    }

    // 3. Tương thích ngược với URL Hash cũ (#my-trips, #booked, #post, #match, #radar, #cockpit, #tram)
    const rawHash = window.location.hash.replace('#', '').trim().toLowerCase();
    if (rawHash === 'admin' && !canAccessAdmin) {
      // Chặn truy cập #admin trên domain chính
    } else if (rawHash === 'cockpit') {
      return 'cockpit';
    } else if (rawHash === 'tram' || rawHash === 'station') {
      return 'station';
    } else if (rawHash === 'radar' || rawHash === 'match') {
      return 'match';
    } else if (rawHash === 'my-trips' || rawHash === 'my_trips' || rawHash === 'mytrips') {
      return 'my-trips';
    } else if (VALID_TABS.includes(rawHash)) {
      return rawHash;
    }

    // 4. Nhận diện Search Query parameter (?tab=...)
    try {
      const params = new URLSearchParams(window.location.search);
      const queryTab = params.get('tab');
      if (queryTab === 'radar' || queryTab === 'match') return 'match';
      if (queryTab === 'my_trips' || queryTab === 'my-trips') return 'my-trips';
      if (queryTab && VALID_TABS.includes(queryTab)) {
        return queryTab;
      }
    } catch {}

    // 5. Khôi phục tab trước đó từ sessionStorage (Kháng văng trang chủ khi F5 / Reload)
    try {
      const savedTab = sessionStorage.getItem('carmate_active_tab');
      if (savedTab && VALID_TABS.includes(savedTab) && savedTab !== 'admin') {
        return savedTab;
      }
    } catch {}

    return 'market';
  }, [canAccessAdmin, isOpsPortal, VALID_TABS]);

  const [activeTab, _setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return getTabFromUrl();
    }
    return 'market';
  });

  // Bất biến MIT: Chuẩn hóa vĩnh viễn tab 'my_trips' -> 'my-trips' để không bao giờ rơi vào trạng thái rỗng
  const setActiveTab = useCallback((tabOrUpdater) => {
    if (typeof tabOrUpdater === 'function') {
      _setActiveTab((prev) => {
        const next = tabOrUpdater(prev);
        return next === 'my_trips' || next === 'mytrips' ? 'my-trips' : next;
      });
    } else {
      const next = tabOrUpdater === 'my_trips' || tabOrUpdater === 'mytrips' ? 'my-trips' : tabOrUpdater;
      _setActiveTab(next);
    }
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    trackPageView(activeTab);

    // Đồng bộ Clean URL Pathname & SessionStorage 2 chiều (Zero #, Chuẩn Apple & Vercel)
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('carmate_active_tab', activeTab);
        const targetPath = getPathForTab(activeTab);
        const currentPath = window.location.pathname;
        const currentHash = window.location.hash;
        const search = window.location.search;

        if (activeTab === 'admin') {
          if (isOpsPortal) {
            if (currentHash) {
              window.history.replaceState(null, '', currentPath + search);
            }
          } else if (currentPath !== '/admin') {
            window.history.pushState(null, '', '/admin' + search);
          }
        } else {
          // Nếu URL còn vướng hash cũ (ví dụ #my-trips), làm sạch vĩnh viễn không để lại dấu #
          if (currentHash && !currentHash.startsWith('#confirm-')) {
            window.history.replaceState(null, '', targetPath + search);
          } else if (currentPath !== targetPath && !isOpsPortal) {
            window.history.pushState(null, '', targetPath + search);
          }
        }
      } catch (err) {
        console.warn('URL state sync error:', err);
      }
    }
  }, [activeTab, isOpsPortal]);

  // Lắng nghe sự kiện Back/Forward trình duyệt hoặc thay đổi URL
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleHashOrPopState = () => {
      const nextTab = getTabFromUrl();
      if (nextTab && nextTab !== activeTab) {
        setActiveTab(nextTab);
      }
    };

    window.addEventListener('popstate', handleHashOrPopState);
    window.addEventListener('hashchange', handleHashOrPopState);
    return () => {
      window.removeEventListener('popstate', handleHashOrPopState);
      window.removeEventListener('hashchange', handleHashOrPopState);
    };
  }, [activeTab, getTabFromUrl, setActiveTab]);

  // Magic Link 1-Chạm Chủ xe & Apple Re-entry Card Khách quay lại web
  const { driverConfirmCode, setDriverConfirmCode, pendingZaloBooking, setPendingZaloBooking } = useZaloReentry({
    isOpsPortal,
    onNavigateTab: setActiveTab
  });

  // State Người dùng đăng nhập (Đồng bộ đa tầng LocalStorage + First-Party Cookie)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(USER_KEY);
        if (saved) return JSON.parse(saved);
      }
      if (typeof document !== 'undefined') {
        const match = document.cookie.match(/(?:^|; )carmate_user_cached=([^;]*)/);
        if (match && match[1]) {
          const parsed = JSON.parse(decodeURIComponent(match[1]));
          if (parsed && typeof localStorage !== 'undefined') {
            try {
              localStorage.setItem(USER_KEY, JSON.stringify(parsed));
            } catch {}
          }
          return parsed;
        }
      }
      return null;
    } catch {
      return null;
    }
  });

  const [myTripsCount, setMyTripsCount] = useState(0);

  // State Trạm đón ảo được quét QR hoặc chọn từ bản đồ
  const [stationHubId, setStationHubId] = useState(() => {
    if (typeof window !== 'undefined') {
      const parts = window.location.pathname.split('/');
      if ((parts[1] === 'tram' || parts[1] === 'station') && parts[2]) {
        return parts[2];
      }
      const params = new URLSearchParams(window.location.search);
      if (params.get('hub')) return params.get('hub');
    }
    return 'hub_ql13_tan_khai';
  });

  // Hook quản lý Modals
  const {
    selectedItemForEscrow,
    setSelectedItemForEscrow,
    selectedDriverForTrust,
    setSelectedDriverForTrust,
    selectedTripForPhotos,
    setSelectedTripForPhotos,
    showPolicyModal,
    setShowPolicyModal,
    showBenchmarkModal,
    setShowBenchmarkModal,
    cancelRecord,
    setCancelRecord,
    delayRecord,
    setDelayRecord,
    ticketToShare,
    setTicketToShare,
    reviewRecord,
    setReviewRecord,
    mismatchRecord,
    setMismatchRecord,
    unreachablePhoneRecord,
    setUnreachablePhoneRecord,
    selectedTripForRoute,
    setSelectedTripForRoute,
    editingTrip,
    setEditingTrip,
    showAuthModal,
    setShowAuthModal,
    authModalConfig,
    setAuthModalConfig,
    showTermsModal,
    setShowTermsModal,
    showAiModal,
    setShowAiModal,
    showDeleteAccountModal,
    setShowDeleteAccountModal,
    pendingBookingTrip,
    setPendingBookingTrip,
    pendingPostTrip,
    setPendingPostTrip,
    openAuthWithContext
  } = useAppModals();

  // State Hồ sơ & Garage của tôi (Apple Portal Modal)
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Xử lý lưu thông tin cá nhân & Garage xe của Chủ xe
  const handleSaveProfile = async (profileData) => {
    try {
      const res = await api.updateProfile(profileData);
      const updated = res.user || { ...currentUser, ...profileData };
      setCurrentUser(updated);
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      if (typeof document !== 'undefined') {
        try {
          document.cookie = `carmate_user_cached=${encodeURIComponent(JSON.stringify(updated))}; path=/; max-age=7776000; SameSite=Lax; secure`;
        } catch {}
      }

      // Đồng bộ hai tầng sang Persona Memory để Trợ lý và Form nạp tức thì 0ms
      if (updated.vehicle) {
        try {
          const raw = localStorage.getItem('carmate_persona_memory_v1');
          const mem = raw ? JSON.parse(raw) : { driver: { routes: [] }, passenger: { routes: [] } };
          mem.driver = mem.driver || { routes: [] };
          mem.driver.carProfile = {
            vehicleCapacity: updated.vehicle.capacity || 5,
            carType: `${updated.vehicle.brand || ''} ${updated.vehicle.model || ''}`.trim() || 'Toyota Vios (Xe 5 chỗ)',
            carCategory: updated.vehicle.carCategory || 'family_car',
            carPlate: updated.vehicle.plate || '',
            carPhotos: updated.vehicle.photos || [],
            lastUpdated: Date.now()
          };
          localStorage.setItem('carmate_persona_memory_v1', JSON.stringify(mem));
        } catch (e) {
          console.warn('[ProfileSync] Lỗi lưu personaMemory:', e);
        }
      }
      return updated;
    } catch (err) {
      console.error('[Profile] Lỗi lưu hồ sơ:', err);
      throw err;
    }
  };

  // Helper tính số lượng bài đăng của tôi
  const updateMyTripsCount = useCallback(
    (user = currentUser, offers = null, requests = null) => {
      try {
        const allStoredIds = new Set();
        try {
          const guestIds = JSON.parse(localStorage.getItem('carmate_guest_trip_ids') || '[]');
          if (Array.isArray(guestIds)) guestIds.forEach((id) => allStoredIds.add(id));
        } catch {}
        try {
          const legacyIds = JSON.parse(localStorage.getItem('carmate_my_trip_ids') || '[]');
          if (Array.isArray(legacyIds)) legacyIds.forEach((id) => allStoredIds.add(id));
        } catch {}
        if (user) {
          try {
            const userKey = `carmate_my_trip_ids_${user.id || user.userId || user.phone}`;
            const userIds = JSON.parse(localStorage.getItem(userKey) || '[]');
            if (Array.isArray(userIds)) userIds.forEach((id) => allStoredIds.add(id));
          } catch {}
          if (user.phone) {
            try {
              const phoneKey = `carmate_my_trip_ids_${user.phone}`;
              const phoneIds = JSON.parse(localStorage.getItem(phoneKey) || '[]');
              if (Array.isArray(phoneIds)) phoneIds.forEach((id) => allStoredIds.add(id));
            } catch {}
          }
        }

        const all = [...(offers || []), ...(requests || [])];
        const userPhoneNorm = user?.phone ? normalizePhoneNumber(user.phone) : '';
        const userId = user?.id || user?.userId;

        const validTrips = all.filter((t) => {
          if (allStoredIds.has(t.id)) return true;
          if (user) {
            if (userId && (t.userId === userId || t.creatorId === userId || t.driverId === userId)) return true;
            const tripPhoneNorm = (t.phoneReal || t.phone) ? normalizePhoneNumber(t.phoneReal || t.phone) : '';
            if (userPhoneNorm && tripPhoneNorm && userPhoneNorm === tripPhoneNorm) return true;
            if (user.telegramId && t.telegramId && String(user.telegramId) === String(t.telegramId)) return true;
          }
          return false;
        });

        setMyTripsCount(validTrips.length);
      } catch {
        setMyTripsCount(0);
      }
    },
    [currentUser]
  );

  // Helper kiểm tra một chuyến đi có phải của chính người dùng hiện tại (MIT Invariant)
  const checkIsMyTrip = useCallback(
    (trip) => {
      if (!trip) return false;
      try {
        // 1. Quét tất cả ID bài đăng đã lưu trong localStorage (Bảo tồn cả phiên khách + phiên đăng nhập)
        const allStoredIds = new Set();
        try {
          const guestIds = JSON.parse(localStorage.getItem('carmate_guest_trip_ids') || '[]');
          if (Array.isArray(guestIds)) guestIds.forEach((id) => allStoredIds.add(id));
        } catch {}
        try {
          const legacyIds = JSON.parse(localStorage.getItem('carmate_my_trip_ids') || '[]');
          if (Array.isArray(legacyIds)) legacyIds.forEach((id) => allStoredIds.add(id));
        } catch {}
        if (currentUser) {
          try {
            const userKey = `carmate_my_trip_ids_${currentUser.id || currentUser.userId || currentUser.phone}`;
            const userIds = JSON.parse(localStorage.getItem(userKey) || '[]');
            if (Array.isArray(userIds)) userIds.forEach((id) => allStoredIds.add(id));
          } catch {}
          if (currentUser.phone) {
            try {
              const phoneKey = `carmate_my_trip_ids_${currentUser.phone}`;
              const phoneIds = JSON.parse(localStorage.getItem(phoneKey) || '[]');
              if (Array.isArray(phoneIds)) phoneIds.forEach((id) => allStoredIds.add(id));
            } catch {}
          }
        }
        if (allStoredIds.has(trip.id)) return true;

        // 2. So khớp định danh người dùng đăng nhập (User ID / SĐT chuẩn hóa / Telegram ID)
        if (currentUser) {
          const cId = currentUser.id || currentUser.userId;
          if (cId && (trip.userId === cId || trip.creatorId === cId || trip.driverId === cId)) return true;

          const userPhoneNorm = currentUser.phone ? normalizePhoneNumber(currentUser.phone) : '';
          const tripPhoneNorm = (trip.phoneReal || trip.phone) ? normalizePhoneNumber(trip.phoneReal || trip.phone) : '';
          if (userPhoneNorm && tripPhoneNorm && userPhoneNorm === tripPhoneNorm) return true;

          if (currentUser.telegramId && trip.telegramId && String(currentUser.telegramId) === String(trip.telegramId)) return true;
        }
      } catch {}
      return false;
    },
    [currentUser]
  );

  // Hook quản lý Dữ liệu chuyến đi & Escrow Bookings
  const {
    driverOffers,
    setDriverOffers,
    passengerRequests,
    setPassengerRequests,
    bookedEscrows,
    setBookedEscrows,
    refreshBookings,
    toastMessage,
    showToast,
    handleRePublishTrip,
    handlePostTrip,
    handleEditTrip,
    handleToggleTripStatus,
    handleDeleteTrip,
    handleConfirmBooking,
    handleConfirmCancel,
    handleConfirmedFromZaloReentry,
    handleSendDelay,
    handleCompleteTrip,
    handleSubmitReview,
    handleVehicleMismatchReport,
    handleUnreachablePhoneReport
  } = useTripsData({
    currentUser,
    updateMyTripsCount,
    setActiveTab,
    setTicketToShare,
    setSelectedItemForEscrow,
    setCancelRecord,
    setDelayRecord,
    setReviewRecord,
    setPendingPostTrip,
    setShowAuthModal,
    onSaveProfile: handleSaveProfile,
    t
  });

  // Quét mã QR & Liên kết sâu trực tiếp chuyến xe (?trip=... hoặc /t/...)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const params = new URLSearchParams(window.location.search);
      let targetTripId = params.get('trip') || params.get('tripId') || params.get('t');

      if (!targetTripId && window.location.pathname.startsWith('/t/')) {
        targetTripId = window.location.pathname.replace(/^\/t\//, '').split('/')[0].trim();
      }

      if (!targetTripId) return;

      const allTrips = [...(driverOffers || []), ...(passengerRequests || [])];
      const match = allTrips.find(
        (t) => String(t.id) === String(targetTripId) || String(t.maskedCode) === String(targetTripId)
      );

      if (match) {
        setSelectedTripForRoute(match);
      } else {
        api
          .getTrip(targetTripId)
          .then((res) => {
            if (res?.data) {
              setSelectedTripForRoute(res.data);
            }
          })
          .catch((err) => {
            console.warn('[DeepLink] Không tìm thấy chuyến xe:', targetTripId, err.message);
          });
      }
    } catch (err) {
      console.warn('[DeepLink] Lỗi xử lý liên kết sâu:', err);
    }
  }, [driverOffers, passengerRequests, setSelectedTripForRoute]);

  // Quản lý trạng thái Đã đọc / Chưa đọc (Read & Unread Tracking) của Hộp thư đến
  const [readBookingTimestamps, setReadBookingTimestamps] = useState(() => {
    try {
      const saved = localStorage.getItem('carmate_inbox_read_timestamps');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [unreadBookingIds, setUnreadBookingIds] = useState(() => {
    try {
      const saved = localStorage.getItem('carmate_inbox_unread_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const markBookingAsRead = useCallback((bookingId) => {
    if (!bookingId) return;
    setUnreadBookingIds((prev) => {
      if (!prev.includes(bookingId)) return prev;
      const updated = prev.filter((id) => id !== bookingId);
      try {
        localStorage.setItem('carmate_inbox_unread_ids', JSON.stringify(updated));
      } catch (err) {
        console.error('Lỗi lưu carmate_inbox_unread_ids:', err);
      }
      return updated;
    });

    setReadBookingTimestamps((prev) => {
      if (prev[bookingId] && Date.now() - prev[bookingId] < 2000) return prev;
      const updated = { ...prev, [bookingId]: Date.now() };
      try {
        localStorage.setItem('carmate_inbox_read_timestamps', JSON.stringify(updated));
      } catch (err) {
        console.error('Lỗi lưu carmate_inbox_read_timestamps:', err);
      }
      return updated;
    });
  }, []);

  const markBookingAsUnread = useCallback((bookingId) => {
    if (!bookingId) return;
    setUnreadBookingIds((prev) => {
      if (prev.includes(bookingId)) return prev;
      const updated = [...prev, bookingId];
      try {
        localStorage.setItem('carmate_inbox_unread_ids', JSON.stringify(updated));
      } catch (err) {
        console.error('Lỗi lưu carmate_inbox_unread_ids:', err);
      }
      return updated;
    });

    setReadBookingTimestamps((prev) => {
      const updated = { ...prev, [bookingId]: 0 };
      try {
        localStorage.setItem('carmate_inbox_read_timestamps', JSON.stringify(updated));
      } catch (err) {
        console.error('Lỗi lưu carmate_inbox_read_timestamps:', err);
      }
      return updated;
    });
  }, []);

  // Đánh dấu toàn bộ thông báo / yêu cầu trong Hộp thư là đã đọc
  const handleMarkAllRead = useCallback(() => {
    const now = Date.now();
    const updated = { ...readBookingTimestamps };
    (bookedEscrows || []).forEach((b) => {
      const bId = b.escrowId || b.id;
      if (bId) updated[bId] = now;
    });
    setReadBookingTimestamps(updated);
    setUnreadBookingIds([]);
    try {
      localStorage.setItem('carmate_inbox_read_timestamps', JSON.stringify(updated));
      localStorage.removeItem('carmate_inbox_unread_ids');
    } catch (err) {
      console.error('Lỗi lưu carmate_inbox_read_timestamps:', err);
    }
  }, [bookedEscrows, readBookingTimestamps]);

  // Đếm số lượng yêu cầu CHƯA ĐỌC thực sự trong Hộp thư (inquiring hoặc pre_confirmed hoặc được chủ động đánh dấu Đọc sau)
  const inboxCount = useMemo(() => {
    const userPhone = currentUser?.phone ? cleanPhoneNumber(currentUser.phone) : '';
    return (bookedEscrows || []).filter((b) => {
      const bId = b.escrowId || b.id;
      // 1. Nếu người dùng chủ động đánh dấu "Chưa đọc (Đọc sau)"
      if (unreadBookingIds.includes(bId)) return true;

      // 2. Chỉ tính các chuyến đang thương lượng hoặc giữ chỗ
      if (b.status !== 'inquiring' && b.status !== 'pre_confirmed') return false;
      const lastRead = readBookingTimestamps[bId] || 0;
      if (!lastRead) return true; // Chưa mở bao giờ -> Chưa đọc

      // 3. Nếu có tin nhắn mới từ đối phương sau lần đọc cuối cùng
      const hasNewMessage = (b.messages || []).some((m) => {
        const isMe = userPhone && cleanPhoneNumber(m.senderPhone || '') === userPhone;
        const msgTime = m.timestamp ? new Date(m.timestamp).getTime() : 0;
        return !isMe && msgTime > lastRead;
      });
      return hasNewMessage;
    }).length;
  }, [bookedEscrows, readBookingTimestamps, unreadBookingIds, currentUser]);

  const [showInboxModal, setShowInboxModal] = useState(false);
  const [inboxInitialBookingId, setInboxInitialBookingId] = useState(null);
  const [inboxAutoCall, setInboxAutoCall] = useState(false);

  const handleOpenInbox = useCallback((bookingId = null, options = {}) => {
    setInboxInitialBookingId(bookingId);
    setInboxAutoCall(Boolean(options?.autoCall));
    setShowInboxModal(true);
  }, []);

  // Hook quản lý Bộ lọc thị trường & Phân nhóm thời gian
  const {
    searchKeyword,
    setSearchKeyword,
    searchFrom,
    setSearchFrom,
    searchTo,
    setSearchTo,
    selectedTimeSlot,
    setSelectedTimeSlot,
    marketViewMode,
    setMarketViewMode,
    selectedCarCategory,
    setSelectedCarCategory,
    temporalFilter,
    setTemporalFilter,
    visibleCount,
    setVisibleCount,
    resetFilters,
    displayedMarketItems,
    paginatedMarketItems
  } = useMarketFilters({ driverOffers, passengerRequests });

  // Đồng bộ số lượng chuyến của tôi khi danh sách chuyến đi thay đổi
  useEffect(() => {
    updateMyTripsCount(currentUser, driverOffers, passengerRequests);
    const handleStorageChange = () => updateMyTripsCount(currentUser, driverOffers, passengerRequests);
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [currentUser, driverOffers, passengerRequests, updateMyTripsCount]);

  // Quản lý Hành lang Tuyến Level 3 & Trạng thái xem sàn
  const [activeCorridor, setActiveCorridor] = useState('Tuyến QL13');
  const [activeCorridorContext, setActiveCorridorContext] = useState(null);
  const [marketLayoutView, setMarketLayoutView] = useState('cards'); // 'cards' (mặc định trực quan) | 'timeline' (dòng thời gian)

  // Quản lý Social Smart Match Suggestions (Ambient Intelligence)
  const [socialMatches, setSocialMatches] = useState([]);

  const loadSocialMatches = useCallback(async () => {
    try {
      const params = {};
      if (searchKeyword) params.routeCategory = searchKeyword;
      const res = await api.getSocialMatches(params);
      if (res?.success && Array.isArray(res?.data)) {
        setSocialMatches(res.data);
      }
    } catch (err) {
      console.warn('[SocialMatch] Lỗi tải gợi ý khớp:', err);
    }
  }, [searchKeyword]);

  useEffect(() => {
    loadSocialMatches();
  }, [loadSocialMatches, driverOffers.length, passengerRequests.length]);

  // Phím tắt toàn cục ⌘K / Ctrl+K mở Trợ lý, ⌘+Shift+A mở Cổng Quản trị
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key?.toLowerCase() === 'k') {
        e.preventDefault();
        setShowAiModal((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key?.toLowerCase() === 'a') {
        e.preventDefault();
        setActiveTab((prev) => (prev === 'admin' ? 'market' : 'admin'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab, setShowAiModal]);

  // Tự động khôi phục và đồng bộ phiên đăng nhập từ Token (Silent Session Restore - Stanford Ergonomics)
  useEffect(() => {
    const token =
      (typeof localStorage !== 'undefined' && localStorage.getItem('carmate_auth_token')) ||
      (typeof document !== 'undefined' && document.cookie.match(/(?:^|; )carmate_auth_token=([^;]*)/)?.[1]);

    if (!token) return;

    let isMounted = true;
    api
      .getMe()
      .then((res) => {
        if (!isMounted) return;
        if (res?.success && res?.user) {
          setCurrentUser(res.user);
          try {
            localStorage.setItem(USER_KEY, JSON.stringify(res.user));
            if (typeof document !== 'undefined') {
              document.cookie = `carmate_user_cached=${encodeURIComponent(JSON.stringify(res.user))}; path=/; max-age=7776000; SameSite=Lax; secure`;
            }
            if (Array.isArray(res.tripIds) && res.tripIds.length > 0) {
              const userKey = `carmate_my_trip_ids_${res.user.id || res.user.phone}`;
              const stored = JSON.parse(localStorage.getItem(userKey) || '[]');
              const merged = Array.from(new Set([...res.tripIds, ...stored]));
              localStorage.setItem(userKey, JSON.stringify(merged));
            }
          } catch {}
          updateMyTripsCount(res.user, driverOffers, passengerRequests);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        // Chỉ dọn dẹp nếu token thực sự hết hạn hoặc bị từ chối 401
        if (err?.status === 401) {
          handleLogout();
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const [postTripInitialRole, setPostTripInitialRole] = useState('driver');

  // Guarded Action: Hỗ trợ linh hoạt 1-chạm cho cả Người tìm xe & Chủ xe
  const handleRequestPostTrip = (targetRole = 'driver') => {
    const validRole = targetRole === 'passenger' ? 'passenger' : 'driver';
    setPostTripInitialRole(validRole);
    if (!currentUser) {
      openAuthWithContext({
        title: validRole === 'passenger' ? 'Đăng Nhập Để Tìm Xe Đi Ghép' : 'Đăng Nhập Để Đăng Chuyến Xe',
        subtitle: 'Xác thực tài khoản chính chủ · 0 phí sàn · An toàn & minh bạch',
        contextNotice:
          validRole === 'passenger'
            ? 'Đăng tin tìm xe để các Chủ xe chạy cùng tuyến liên hệ đón bạn tận nơi'
            : 'Đăng chuyến xe nhà còn ghế để chia sẻ bớt chi phí xăng xe và cầu đường',
        pendingTab: 'post'
      });
      return;
    }
    setActiveTab('post');
  };

  // Quản lý chuyến của chính mình: Mở trực tiếp Modal Quản lý / Chỉnh sửa tại chỗ (Stanford Ergonomics - Zero tab jump)
  const handleManageMyTrip = useCallback(
    (trip) => {
      setEditingTrip(trip);
    },
    [setEditingTrip]
  );

  // Ghép chuyến: Nếu là bài đăng của chính mình thì mở Modal Quản lý tại chỗ thay vì chuyển tab
  const handleInitiateBook = (trip) => {
    if (checkIsMyTrip(trip)) {
      showToast('Đây là bài đăng của bạn. Bạn đang ở chế độ Quản lý chuyến xe.');
      setEditingTrip(trip);
      return;
    }
    trackViewTrip(trip.id, `${trip.from} - ${trip.to}`);
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
      if (typeof document !== 'undefined') {
        try {
          document.cookie = `carmate_user_cached=${encodeURIComponent(JSON.stringify(user))}; path=/; max-age=7776000; SameSite=Lax; secure`;
        } catch {}
      }
      const userKey = `carmate_my_trip_ids_${user.id || user.phone}`;
      const stored = JSON.parse(localStorage.getItem(userKey) || '[]');
      const guestStored = JSON.parse(localStorage.getItem('carmate_guest_trip_ids') || '[]');
      const incoming = Array.isArray(tripIds) ? tripIds : [];
      const merged = Array.from(new Set([...incoming, ...stored, ...guestStored]));
      localStorage.setItem(userKey, JSON.stringify(merged));
      localStorage.removeItem('carmate_guest_trip_ids');
      localStorage.removeItem('carmate_my_trip_ids');
    } catch {}

    updateMyTripsCount(user, driverOffers, passengerRequests);
    showToast(`Chào mừng ${user.name}! Đã đăng nhập thành công.`);

    if (authModalConfig.pendingTab) {
      setActiveTab(authModalConfig.pendingTab);
    }
    setAuthModalConfig({
      title: 'Đăng Nhập CarMate',
      subtitle: 'Đồng bộ bài đăng · Tiết kiệm chi phí · An toàn & bảo mật',
      contextNotice: null,
      pendingTab: null
    });

    if (pendingPostTrip) {
      const tripToPost = { ...pendingPostTrip };
      setPendingPostTrip(null);
      handlePostTrip(tripToPost, user);
    }

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
      if (typeof document !== 'undefined') {
        try {
          document.cookie = 'carmate_user_cached=; path=/; max-age=0; SameSite=Lax; secure';
        } catch {}
      }
      api.logout();
    } catch {}
    setMyTripsCount(0);
    setActiveTab('market');
    showToast('Đã đăng xuất tài khoản.');
  };

  const handleAccountDeleted = () => {
    if (currentUser) {
      const uId = currentUser.id;
      const uPhone = currentUser.phone ? String(currentUser.phone).replace(/\D/g, '') : '';
      setDriverOffers((prev) =>
        prev.filter((t) => t.userId !== uId && (!uPhone || String(t.phoneReal).replace(/\D/g, '') !== uPhone))
      );
      setPassengerRequests((prev) =>
        prev.filter((t) => t.userId !== uId && (!uPhone || String(t.phoneReal).replace(/\D/g, '') !== uPhone))
      );
    }
    handleLogout();
  };

  const handleViewTripInMarket = (trip) => {
    if (!trip) return;
    setActiveTab('market');
    if (trip.type === 'passenger' || trip.type === 'passenger_request') {
      setMarketViewMode('passengers');
    } else {
      setMarketViewMode('drivers');
    }
    resetFilters();

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

  const handleFooterNavigate = (key) => {
    const tabs = { market: 'market', match: 'match', post: 'post', admin: 'admin' };
    if (tabs[key]) return setActiveTab(tabs[key]);
    if (key === 'benchmark') {
      setActiveTab('market');
      return setShowBenchmarkModal(true);
    }
    if (key === 'trust' || key === 'safety') {
      setSelectedDriverForTrust({
        publicName: 'Nguyễn Anh Tuấn',
        role: 'driver',
        hometown: 'Lộc Ninh, Bình Phước',
        trustScore: 98,
        safeTripsCount: 48,
        rating: 5.0,
        carModel: 'Mitsubishi Xpander (7 chỗ)',
        licensePlateMasked: '93A-289.xx'
      });
      return;
    }
    if (['policy', 'terms', 'privacy', 'dispute', 'community', 'help', 'faq', 'report'].includes(key))
      return setShowPolicyModal(true);
    setActiveTab('market');
  };

  const activeBookedCount = bookedEscrows.filter((b) => b.status !== 'completed' && b.status !== 'cancelled').length;
  const container = 'max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8';

  // CHẾ ĐỘ TAPLO Ô TÔ (COCKPIT HUD TOÀN MÀN HÌNH CHO CHỦ XE)
  if (activeTab === 'cockpit') {
    return (
      <CockpitMode
        tripId={`TRIP-${currentUser?.id || currentUser?.phone || 'TAPLO'}`}
        initialCorridor={activeCorridor || 'Tuyến QL13'}
        onBack={() => setActiveTab('market')}
        onShowToast={showToast}
      />
    );
  }

  // CHẾ ĐỘ QUÉT QR TRẠM ẢO (RIDER STATION LIVE PASS CHO KHÁCH)
  if (activeTab === 'station') {
    return (
      <StationRiderView
        hubId={stationHubId}
        currentUser={currentUser}
        onBack={() => setActiveTab('market')}
        onShowToast={showToast}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f5f7] dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 antialiased transition-colors selection:bg-[#0071e3]/15 selection:text-[#0071e3]">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCockpit={() => setActiveTab('cockpit')}
        onRequestPostTrip={handleRequestPostTrip}
        setShowPolicyModal={setShowPolicyModal}
        bookedCount={activeBookedCount}
        myTripsCount={myTripsCount}
        inboxCount={inboxCount}
        onOpenInbox={() => handleOpenInbox()}
        currentUser={currentUser}
        onOpenAuth={() => openAuthWithContext()}
        onLogout={handleLogout}
        onOpenAi={() => setShowAiModal(true)}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenDeleteAccount={() => setShowDeleteAccountModal(true)}
        bookedEscrows={bookedEscrows}
        onSelectBooking={(id) => handleOpenInbox(id)}
        onSelectTrip={setSelectedTripForRoute}
        onMarkAllRead={handleMarkAllRead}
        onMarkAsRead={markBookingAsRead}
        onMarkAsUnread={markBookingAsUnread}
        readBookingTimestamps={readBookingTimestamps}
        unreadBookingIds={unreadBookingIds}
        socialMatches={socialMatches}
      />

      <main className="flex-1 pb-24 md:pb-0">
        {/* ── Đường Ống Tiện Tuyến Đoàn Tàu Ảo (Zero Posting Paradigm) ── */}
        {activeTab === 'market' && (
          <div className={`${container} py-5 sm:py-8`}>
            <CorridorMetroBoard
              onOpenCockpit={() => setActiveTab('cockpit')}
              onOpenStationView={(hub) => {
                setStationHubId(hub || 'hub_ql13_tan_khai');
                setActiveTab('station');
              }}
              onOpenInbox={() => handleOpenInbox()}
              activeBookedCount={activeBookedCount}
            />
          </div>
        )}

        {/* ── Lưu trữ chuyến xe cũ (Nếu mở) ── */}
        {activeTab === 'legacy-archive' && (
          <>
            <Hero
              trips={driverOffers}
              searchKeyword={searchKeyword}
              setSearchKeyword={setSearchKeyword}
              searchFrom={searchFrom}
              setSearchFrom={setSearchFrom}
              searchTo={searchTo}
              setSearchTo={setSearchTo}
              onPostClick={handleRequestPostTrip}
              currentUser={currentUser}
              onShowToast={showToast}
              onOpenBooking={(trip) => handleInitiateBook(trip)}
              activeCorridor={activeCorridor}
              onCorridorChange={(ctx) => {
                setActiveCorridor(ctx.corridor);
                setActiveCorridorContext(ctx);
              }}
            />

            <div className={`${container} py-3.5 sm:py-6 space-y-3.5 sm:space-y-5 relative z-10`}>
              {/* CHẾ ĐỘ HIỂN THỊ SÀN: DANH SÁCH THẺ (MẶC ĐỊNH) HOẶC DÒNG THỜI GIAN TUYẾN */}
              {marketLayoutView === 'timeline' ? (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setMarketLayoutView('cards')}
                      className="px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-xs font-bold text-slate-700 dark:text-zinc-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Quay lại dạng thẻ ({driverOffers.length + passengerRequests.length} chuyến)</span>
                    </button>
                  </div>
                  <CorridorTimeline
                    trips={driverOffers}
                    corridor={activeCorridor}
                    originHub={activeCorridorContext?.originHub}
                    destHub={activeCorridorContext?.destHub}
                    timeSlot={activeCorridorContext?.timeSlot}
                    onOpenBooking={(trip) => handleInitiateBook(trip)}
                    onOpenStationView={(hub) => {
                      setStationHubId(hub || 'hub_ql13_tan_khai');
                      setActiveTab('station');
                    }}
                    onShowAllNationwide={() => setMarketLayoutView('cards')}
                  />
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5 pb-0.5">
                <div className="overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 py-0.5">
                  <Segmented
                    size="sm"
                    value={marketViewMode}
                    onChange={setMarketViewMode}
                    options={[
                      {
                        value: 'all',
                        label: 'Tất cả',
                        icon: LayoutGrid
                      },
                      { value: 'drivers', label: 'Chủ xe', icon: Car },
                      { value: 'passengers', label: 'Người tìm xe', icon: Users }
                    ]}
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setMarketLayoutView('timeline')}
                    className="h-8.5 px-3.5 rounded-full text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-[#0071e3] dark:hover:text-[#2997ff] inline-flex items-center gap-1.5 cursor-pointer shadow-xs hover:border-slate-400 dark:hover:border-slate-600 transition-colors"
                    title="Xem theo dòng thời gian dọc tuyến"
                  >
                    <Clock className="w-3.5 h-3.5 text-[#0071e3]" />
                    <span>Lịch trình tuyến</span>
                  </button>
                  <select
                    value={selectedCarCategory}
                    onChange={(e) => setSelectedCarCategory(e.target.value)}
                    aria-label="Lọc loại xe"
                    className="h-8.5 pl-3.5 pr-8 rounded-full text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer shadow-xs hover:border-slate-400 dark:hover:border-slate-600 outline-none transition-colors"
                  >
                    <option value="all">🚗 Mọi phương tiện</option>
                    <option value="family_car">🚗 Xe 4–5 chỗ gia đình</option>
                    <option value="suv_7">🚙 Xe 7 chỗ rộng rãi</option>
                    <option value="pickup">🛻 Bán tải (Chở người & Thùng hàng)</option>
                    <option value="truck_light">🚚 Xe tải nhẹ (Chở xe máy, dọn trọ)</option>
                    <option value="convenient_trip">🚕 Xe tiện chuyến quay đầu</option>
                  </select>

                  <select
                    value={selectedTimeSlot}
                    onChange={(e) => setSelectedTimeSlot(e.target.value)}
                    aria-label="Chọn khung giờ"
                    className="h-8.5 pl-3.5 pr-8 rounded-full text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer shadow-xs hover:border-slate-400 dark:hover:border-slate-600 outline-none transition-colors"
                  >
                    <option value="all">Tất cả khung giờ</option>
                    {TIME_SLOTS.map((slot) => (
                      <option key={slot.id} value={slot.id}>
                        {slot.short}
                      </option>
                    ))}
                  </select>

                  {(selectedTimeSlot !== 'all' ||
                    marketViewMode !== 'all' ||
                    selectedCarCategory !== 'all' ||
                    searchKeyword ||
                    searchFrom ||
                    searchTo) && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={resetFilters}
                      className="text-xs font-bold text-[#0071e3] hover:text-[#0077ed]"
                    >
                      {t('market.resetFilters')}
                    </Button>
                  )}
                </div>
              </div>

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

              <div id="market-results" className="space-y-4 scroll-mt-24">
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
                        Tất cả
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
                        Hôm nay
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
                        Ngày mai
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
                        Sắp tới
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#107c41]"></span>
                    </span>
                    <span>
                      {displayedMarketItems.length} chuyến trực tiếp
                    </span>
                  </div>
                </div>

                {displayedMarketItems.length === 0 ? (
                  // Phân biệt hai trạng thái rỗng khác nhau: sàn chưa có chuyến nào
                  // (mời đăng chuyến đầu tiên) và bộ lọc quá hẹp (mời nới bộ lọc).
                  // Gợi ý "xoá bộ lọc" khi sàn vốn đã trống chỉ làm người dùng bối rối.
                  driverOffers.length === 0 && passengerRequests.length === 0 ? (
                    <EmptyState
                      icon={Car}
                      title="Sàn đang chờ chuyến đầu tiên"
                      description="CarMate vừa mở tuyến. Hãy đăng chuyến của bạn để những người cùng đường ghép chung — 0 phí sàn."
                      action={
                        <Button variant="primary" onClick={() => setActiveTab('post')}>
                          Đăng chuyến đầu tiên
                        </Button>
                      }
                    />
                  ) : (
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
                            resetFilters();
                          }}
                        >
                          {t('market.resetFilters')}
                        </Button>
                      }
                    />
                  )
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-6 lg:gap-7">
                      {paginatedMarketItems.map((item) => (
                        <TripCard
                          key={item.id}
                          item={item}
                          isOwner={checkIsMyTrip(item)}
                          onBook={handleInitiateBook}
                          onManage={handleManageMyTrip}
                          onViewTrustProfile={setSelectedDriverForTrust}
                          onViewRoute={setSelectedTripForRoute}
                          onViewCarPhotos={setSelectedTripForPhotos}
                          onShare={(trip) => setTicketToShare(trip)}
                        />
                      ))}
                    </div>

                    {displayedMarketItems.length > visibleCount && (
                      <div className="pt-6 pb-2 text-center">
                        <button
                          type="button"
                          onClick={() => setVisibleCount((prev) => prev + 9)}
                          className="px-6 py-3 rounded-full bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-800 dark:text-slate-200 border border-slate-200/90 dark:border-slate-800 font-semibold text-xs transition-all shadow-xs hover:shadow-sm active:scale-95 cursor-pointer inline-flex items-center gap-2"
                        >
                          <span>
                            Xem thêm {Math.min(9, displayedMarketItems.length - visibleCount)} chuyến tiếp theo
                          </span>
                          <span className="text-slate-400 font-normal">
                            ({displayedMarketItems.length - visibleCount} chuyến còn lại)
                          </span>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
                </>
              )}
            </div>
          </>
        )}

        {activeTab === 'match' && (
          <div className={`${container} py-8`}>
            <MatchRadarView
              driverOffers={driverOffers}
              passengerRequests={passengerRequests}
              onBook={handleInitiateBook}
              onViewTrustProfile={setSelectedDriverForTrust}
              onViewRoute={setSelectedTripForRoute}
              onShowToast={showToast}
            />
          </div>
        )}

        {activeTab === 'post' && (
          <div className={`${container} py-8`}>
            {!currentUser ? (
              <PostTripAuthGuard
                onOpenAuth={() =>
                  openAuthWithContext({
                    title: 'Đăng Nhập Để Tạo Chuyến Xe',
                    subtitle: 'Xác thực tài khoản chính chủ để đăng bài & kết nối khách an toàn',
                    contextNotice: 'Đăng nhập chính chủ để tạo chuyến xe và quản lý khách ghép',
                    pendingTab: 'post'
                  })
                }
                onBackToMarket={() => setActiveTab('market')}
              />
            ) : (
              <PostTripForm
                onSubmit={handlePostTrip}
                currentUser={currentUser}
                onOpenAuth={() => openAuthWithContext()}
                initialRole={postTripInitialRole}
                onShowToast={showToast}
              />
            )}
          </div>
        )}

        {activeTab === 'my-trips' && (
          <div className={`${container} pt-8 pb-28 sm:pb-8`}>
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
              bookedEscrows={bookedEscrows}
              onViewBookings={() => setActiveTab('booked')}
            />
          </div>
        )}

        {activeTab === 'booked' && (
          <div className={`${container} pt-8 pb-28 sm:pb-8`}>
            <BookedTripList
              bookedEscrows={bookedEscrows}
              currentUser={currentUser}
              onCancel={setCancelRecord}
              onDelay={setDelayRecord}
              onComplete={handleCompleteTrip}
              onReview={setReviewRecord}
              onReportMismatch={setMismatchRecord}
              onReportUnreachablePhone={setUnreachablePhoneRecord}
              onFindTrip={() => setActiveTab('market')}
              onOpenChat={(id, opts) => handleOpenInbox(id, opts)}
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
                if (isOpsPortal && !isLocalhost) {
                  window.location.href = 'https://carmate.vn';
                  return;
                }
                if (window.location.hash === '#admin') {
                  window.history.replaceState(null, '', window.location.pathname + window.location.search);
                } else if (window.location.pathname.startsWith('/admin')) {
                  window.history.replaceState(null, '', '/' + window.location.search);
                }
                setActiveTab('market');
              }}
            />
          </React.Suspense>
        )}
      </main>

      <Footer
        onNavigate={handleFooterNavigate}
        onOpenTerms={() => setShowTermsModal(true)}
        onOpenPolicy={() => setShowPolicyModal(true)}
      />

      {/* Modals */}
      {showInboxModal && (
        <InboxModal
          isOpen={showInboxModal}
          onClose={() => {
            setShowInboxModal(false);
            setInboxAutoCall(false);
          }}
          bookings={bookedEscrows}
          currentUser={currentUser}
          initialBookingId={inboxInitialBookingId}
          autoCall={inboxAutoCall}
          onRefreshBookings={refreshBookings}
          onReportUnreachablePhone={setUnreachablePhoneRecord}
          onShowToast={showToast}
          onMarkAsRead={markBookingAsRead}
          onMarkAsUnread={markBookingAsUnread}
          readBookingTimestamps={readBookingTimestamps}
          unreadBookingIds={unreadBookingIds}
          onNavigateTab={setActiveTab}
        />
      )}
      {selectedItemForEscrow && (
        <EscrowBookingModal
          item={selectedItemForEscrow}
          isOwner={checkIsMyTrip(selectedItemForEscrow)}
          currentUser={currentUser}
          onClose={() => setSelectedItemForEscrow(null)}
          onConfirmBooking={handleConfirmBooking}
          onViewTrustProfile={setSelectedDriverForTrust}
          onOpenInbox={(bookingId, opts) => {
            setSelectedItemForEscrow(null);
            handleOpenInbox(bookingId, opts);
          }}
          onViewBookedTab={(targetTab = 'booked') => {
            setSelectedItemForEscrow(null);
            setActiveTab(targetTab === 'my-trips' || targetTab === 'my_trips' ? 'my-trips' : 'booked');
          }}
          onAutoPostDemand={handlePostTrip}
          onShowToast={showToast}
        />
      )}
      {selectedDriverForTrust && (
        <TrustProfileModal
          item={selectedDriverForTrust}
          isOwner={checkIsMyTrip(selectedDriverForTrust)}
          onClose={() => setSelectedDriverForTrust(null)}
          onBook={(item) => {
            setSelectedDriverForTrust(null);
            handleInitiateBook(item);
          }}
        />
      )}
      {ticketToShare && (
        <TicketShareModal
          trip={ticketToShare}
          onClose={() => setTicketToShare(null)}
          onShowToast={showToast}
          onViewInMarket={handleViewTripInMarket}
          onSelectTrip={setSelectedTripForRoute}
          onConnectMatch={handleInitiateBook}
        />
      )}
      {editingTrip && (
        <EditTripModal
          trip={editingTrip}
          onClose={() => setEditingTrip(null)}
          onSave={handleEditTrip}
          onToggleStatus={handleToggleTripStatus}
          onDelete={handleDeleteTrip}
        />
      )}
      {showPolicyModal && <PolicyModal onClose={() => setShowPolicyModal(false)} />}
      {showTermsModal && <TermsModal onClose={() => setShowTermsModal(false)} />}
      {cancelRecord && (
        <CancelModal
          record={cancelRecord}
          onClose={() => setCancelRecord(null)}
          onConfirmCancel={handleConfirmCancel}
        />
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
      {mismatchRecord && (
        <VehicleMismatchModal
          record={mismatchRecord}
          onClose={() => setMismatchRecord(null)}
          onSubmitReport={handleVehicleMismatchReport}
        />
      )}
      {unreachablePhoneRecord && (
        <UnreachablePhoneModal
          record={unreachablePhoneRecord}
          onClose={() => setUnreachablePhoneRecord(null)}
          onSubmitReport={handleUnreachablePhoneReport}
        />
      )}
      {selectedTripForRoute && (
        <RouteDetailModal
          trip={selectedTripForRoute}
          isOwner={checkIsMyTrip(selectedTripForRoute)}
          onClose={() => setSelectedTripForRoute(null)}
          onShare={setTicketToShare}
          onViewCarPhotos={setSelectedTripForPhotos}
          onManage={(item) => {
            setSelectedTripForRoute(null);
            handleManageMyTrip(item);
          }}
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

      {showProfileModal && (
        <UserProfileModal
          currentUser={currentUser}
          onClose={() => setShowProfileModal(false)}
          onSave={handleSaveProfile}
          onShowToast={showToast}
          onOpenDeleteAccount={() => setShowDeleteAccountModal(true)}
        />
      )}

      <AiConciergeModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        onSelectTrip={(trip) => {
          setShowAiModal(false);
          handleViewTripInMarket(trip);
        }}
      />

      {pendingZaloBooking && (
        <ZaloReentryModal
          booking={pendingZaloBooking}
          onClose={() => setPendingZaloBooking(null)}
          onConfirmedSchedule={handleConfirmedFromZaloReentry}
          onCancelBooking={(escrowId) => handleConfirmCancel(escrowId, { reason: 'Khách đổi xe khác' })}
          onShowToast={showToast}
        />
      )}

      {driverConfirmCode && (
        <DriverQuickConfirmModal
          bookingCode={driverConfirmCode}
          onClose={() => {
            setDriverConfirmCode(null);
            if (window.location.hash.startsWith('#confirm-')) {
              window.location.hash = '';
            }
          }}
          onShowToast={showToast}
        />
      )}

      {showDeleteAccountModal && (
        <DeleteAccountModal
          currentUser={currentUser}
          onClose={() => setShowDeleteAccountModal(false)}
          onDeleted={handleAccountDeleted}
          onShowToast={showToast}
        />
      )}

      <BottomNavBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRequestPostTrip={handleRequestPostTrip}
        bookedCount={activeBookedCount}
        myTripsCount={myTripsCount}
      />
      <PwaInstallPrompt />
      <AppleMacNotification onOpenInbox={handleOpenInbox} onSelectBooking={handleOpenInbox} />
      <Toast message={toastMessage} />
    </div>
  );
}

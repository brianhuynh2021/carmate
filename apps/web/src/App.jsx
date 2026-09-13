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

// Market & Level 3 Autonomous Views
import CorridorSearchBoard from './components/market/CorridorSearchBoard.jsx';
import MovementIntentModal from './components/intent/MovementIntentModal.jsx';
import BookedTripList from './components/booked/BookedTripList.jsx';
const AdminDashboardView = React.lazy(() => import('./components/admin/AdminDashboardView.jsx'));
const CockpitMode = React.lazy(() => import('./components/cockpit/CockpitMode.jsx'));
const StationRiderView = React.lazy(() => import('./components/station/StationRiderView.jsx'));
const InboxModal = React.lazy(() => import('./components/modals/InboxModal.jsx'));
const UserProfileModal = React.lazy(() => import('./components/profile/UserProfileModal.jsx'));
const EscrowBookingModal = React.lazy(() => import('./components/modals/EscrowBookingModal.jsx'));
const QuickPostTripModal = React.lazy(() => import('./components/modals/QuickPostTripModal.jsx'));

// Modals
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

  // Danh mục Tab hợp lệ trên toàn hệ sinh thái CarMate (Level 3 Architecture)
  const VALID_TABS = useMemo(() => ['market', 'intent', 'station', 'cockpit', 'booked', 'admin'], []);

  // Ánh xạ Clean URL Pathname chuẩn Apple & Vercel (Zero #)
  const getPathForTab = (tab) => {
    if (tab === 'market') return '/';
    if (tab === 'admin') return '/admin';
    if (tab === 'cockpit') return '/cockpit';
    if (tab === 'station') return '/tram';
    if (tab === 'intent') return '/intent';
    return `/${tab}`; // '/booked'
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

    // 2. Nhận diện Clean URL Pathname (/booked, /radar, /match, /market, /admin, /cockpit, /tram, /intent, /post)
    const rawPath = window.location.pathname.replace(/^\/+/, '').split('/')[0].trim().toLowerCase();
    if (rawPath === 'admin' && !canAccessAdmin) {
      // Chặn truy cập /admin trên domain chính (MIT Zero Attack Surface)
    } else if (rawPath === 'cockpit') {
      return 'cockpit';
    } else if (rawPath === 'tram' || rawPath === 'station') {
      return 'station';
    } else if (rawPath === 'booked' || rawPath === 'my-trips' || rawPath === 'my_trips' || rawPath === 'mytrips') {
      return 'booked';
    } else if (rawPath === 'intent' || rawPath === 'post') {
      return 'intent';
    } else if (rawPath === 'market' || rawPath === 'radar' || rawPath === 'match') {
      return 'market';
    }

    // 3. Tương thích ngược với URL Hash cũ
    const rawHash = window.location.hash.replace('#', '').trim().toLowerCase();
    if (rawHash === 'admin' && !canAccessAdmin) {
      // Chặn truy cập #admin trên domain chính
    } else if (rawHash === 'cockpit') {
      return 'cockpit';
    } else if (rawHash === 'tram' || rawHash === 'station') {
      return 'station';
    } else if (rawHash === 'booked' || rawHash === 'my-trips' || rawHash === 'my_trips' || rawHash === 'mytrips') {
      return 'booked';
    } else if (rawHash === 'intent' || rawHash === 'post') {
      return 'intent';
    } else if (VALID_TABS.includes(rawHash)) {
      return rawHash;
    }

    // 4. Nhận diện Search Query parameter (?tab=...)
    try {
      const params = new URLSearchParams(window.location.search);
      const queryTab = params.get('tab');
      if (queryTab === 'my_trips' || queryTab === 'my-trips') return 'booked';
      if (queryTab === 'post' || queryTab === 'intent') return 'intent';
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
  }, [canAccessAdmin, isLocalhost, isOpsPortal, VALID_TABS]);

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
        return next === 'my_trips' || next === 'mytrips' || next === 'my-trips' ? 'booked' : next;
      });
    } else {
      const next = tabOrUpdater === 'my_trips' || tabOrUpdater === 'mytrips' || tabOrUpdater === 'my-trips' ? 'booked' : tabOrUpdater;
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

  const [stationDestinationHubId, setStationDestinationHubId] = useState(null);

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
    setShowBenchmarkModal,
    cancelRecord,
    setCancelRecord,
    delayRecord,
    setDelayRecord,
    ticketToShare,
    setTicketToShare,
    reviewRecord,
    setReviewRecord,
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
  // State Modal Đăng Chuyến Nhanh 15s
  const [isQuickPostTripOpen, setIsQuickPostTripOpen] = useState(false);

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
    passengerRequests,
    bookedEscrows,
    setBookedEscrows,
    handleBookingCreated,
    refreshBookings,
    toastMessage,
    showToast,
    handlePostTrip,
    handleEditTrip,
    handleToggleTripStatus,
    handleDeleteTrip,
    handleConfirmBooking,
    handleConfirmCancel,
    handleConfirmedFromZaloReentry,
    handleSendDelay,
    handleCompleteTrip,
    handleSubmitReview
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

  // Tự động làm mới danh sách chuyến khi người dùng mở tab Chuyến của tôi
  useEffect(() => {
    if (activeTab === 'booked') {
      refreshBookings();
    }
  }, [activeTab, refreshBookings]);

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
  // Chỉ lấy những giá trị còn dùng: phần lớn bộ lọc sàn cũ đã bị gỡ cùng
  // FilterBar/Hero, để lại 18 biến chết trong lần rà lint.
  const { searchKeyword, setMarketViewMode, resetFilters } = useMarketFilters({
    driverOffers,
    passengerRequests
  });

  // Đồng bộ số lượng chuyến của tôi khi danh sách chuyến đi thay đổi
  useEffect(() => {
    updateMyTripsCount(currentUser, driverOffers, passengerRequests);
    const handleStorageChange = () => updateMyTripsCount(currentUser, driverOffers, passengerRequests);
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [currentUser, driverOffers, passengerRequests, updateMyTripsCount]);

  // Quản lý Hành lang Tuyến Level 3 & Trạng thái xem sàn
  const [activeCorridor] = useState('Tuyến QL13');

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
    // CHỦ Ý chạy một lần lúc mount: đây là bước khôi phục phiên đăng nhập.
    // Thêm deps sẽ khiến app thẩm định lại token mỗi khi danh sách chuyến đổi.
    // Số chuyến của tôi không bị cũ: effect ở trên (deps đủ) tính lại ngay khi
    // driverOffers/passengerRequests tải xong.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [movementIntentModalOpen, setMovementIntentModalOpen] = useState(false);
  const [movementIntentRole, setMovementIntentRole] = useState('passenger');
  const [movementIntentOriginHub, setMovementIntentOriginHub] = useState(null);
  const [movementIntentDestHub, setMovementIntentDestHub] = useState(null);
  const [movementIntentDate, setMovementIntentDate] = useState(null);
  const [movementIntentTimeSlot, setMovementIntentTimeSlot] = useState(null);

  const handleOpenMovementIntent = useCallback((targetRole = 'passenger', hubId = null, destHubId = null, initialDate = null, initialTimeSlot = null) => {
    const validRole = targetRole === 'driver' ? 'driver' : 'passenger';
    setMovementIntentRole(validRole);
    setMovementIntentOriginHub(hubId || null);
    setMovementIntentDestHub(destHubId || null);
    setMovementIntentDate(initialDate || null);
    setMovementIntentTimeSlot(initialTimeSlot || null);
    setMovementIntentModalOpen(true);
  }, []);

  // Level 3 Autonomous Gateway: Chủ xe mở QuickPostTripModal 15s; Người đi cùng mở Khai báo Ý định
  const handleRequestPostTrip = useCallback((targetRole = 'driver') => {
    if (targetRole === 'driver') {
      setIsQuickPostTripOpen(true);
    } else {
      handleOpenMovementIntent('passenger');
    }
  }, [handleOpenMovementIntent]);

  // Nếu người dùng truy cập /intent hoặc /post, tự động mở modal Khai báo Ý định
  useEffect(() => {
    if (activeTab === 'intent') {
      handleOpenMovementIntent('passenger');
      setActiveTab('market');
    }
  }, [activeTab, handleOpenMovementIntent, setActiveTab]);

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
    // BẤT BIẾN STANFORD: Triệt tiêu rào cản đăng nhập. Khách đặt chỗ trước trực tiếp bằng SĐT (0đ cọc)
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

  const activeBookedCount = (bookedEscrows || []).filter((b) => {
    const target = b?.targetItem || b?.targetTrip || {};
    const from = b?.from || b?.fromLocation || target?.from || target?.fromLocation;
    const to = b?.to || b?.toLocation || target?.to || target?.toLocation;
    return Boolean(from && to) && b?.status !== 'completed' && b?.status !== 'cancelled';
  }).length;
  const container = 'max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8';

  // CHẾ ĐỘ TAPLO Ô TÔ (COCKPIT HUD TOÀN MÀN HÌNH CHO CHỦ XE)
  if (activeTab === 'cockpit') {
    return (
      <>
        <CockpitMode
          tripId={`TRIP-${currentUser?.id || currentUser?.phone || 'TAPLO'}`}
          initialCorridor={activeCorridor || 'Tuyến QL13'}
          currentUser={currentUser}
          onBack={() => setActiveTab('market')}
          onShowToast={showToast}
          onOpenQuickPostTrip={() => setIsQuickPostTripOpen(true)}
        />
        {isQuickPostTripOpen && (
          <React.Suspense fallback={null}>
            <QuickPostTripModal
              isOpen={isQuickPostTripOpen}
              onClose={() => setIsQuickPostTripOpen(false)}
              currentUser={currentUser}
              onSuccess={(newTrip) => {
                handlePostTrip(newTrip, currentUser);
                setActiveTab('cockpit');
              }}
              onShowToast={showToast}
            />
          </React.Suspense>
        )}
        <Toast message={toastMessage} />
      </>
    );
  }

  // CHẾ ĐỘ QUÉT QR ĐIỂM ĐÓN CÂY XĂNG (RIDER STATION LIVE PASS CHO KHÁCH)
  if (activeTab === 'station') {
    return (
      <>
        <StationRiderView
          hubId={stationHubId}
          initialDestinationHubId={stationDestinationHubId}
          currentUser={currentUser}
          onBack={() => setActiveTab('market')}
          onShowToast={showToast}
          onViewBookedTab={(tab, booking) => {
            if (booking) handleBookingCreated(booking);
            setActiveTab('booked');
          }}
          onBookingCreated={handleBookingCreated}
          onAuthSuccess={handleAuthSuccess}
        />
        <Toast message={toastMessage} />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#DFE5EC] dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 antialiased transition-colors selection:bg-[#0071e3]/15 selection:text-[#0071e3]">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
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
        {/* ── Tuyến Xe Tiện Chuyến Quốc Lộ 13 (Zero Posting Paradigm) ── */}
        {activeTab === 'market' && (
          <div className={`${container} py-5 sm:py-8`}>
            <CorridorSearchBoard
              currentUser={currentUser}
              onOpenCockpit={() => setActiveTab('cockpit')}
              onOpenStationView={(hub, destHub) => {
                setStationHubId(hub || 'hub_ql13_tan_khai');
                setStationDestinationHubId(destHub || null);
                setActiveTab('station');
              }}
              onOpenIntentModal={(targetRole, hubId, destHubId, targetDate, targetTimeSlot) => {
                handleOpenMovementIntent(targetRole, hubId, destHubId, targetDate, targetTimeSlot);
              }}
              onViewBookedTab={(tab, booking) => {
                if (booking) {
                  handleBookingCreated(booking);
                }
                setActiveTab('booked');
                refreshBookings();
              }}
              onBookingCreated={handleBookingCreated}
              onAuthSuccess={handleAuthSuccess}
              onShowToast={showToast}
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
              onFindTrip={(record) => {
                if (record && (record.from || record.to)) {
                  showToast(`Đang tìm xe trên tuyến ${record.from || ''} ➔ ${record.to || ''}`);
                }
                setActiveTab('market');
              }}
              onOpenChat={(id, opts) => handleOpenInbox(id, opts)}
            />
          </div>
        )}

        {activeTab === 'admin' && (
          <React.Suspense
            fallback={
              <div className="min-h-[50vh] flex flex-col items-center justify-center gap-2 text-slate-400 text-xs font-medium">
                <span className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                <span>{t('appRoot.s001')}</span>
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
          onAuthSuccess={handleAuthSuccess}
          onViewTrustProfile={setSelectedDriverForTrust}
          onOpenInbox={(bookingId, opts) => {
            setSelectedItemForEscrow(null);
            handleOpenInbox(bookingId, opts);
          }}
          onViewBookedTab={() => {
            setSelectedItemForEscrow(null);
            setActiveTab('booked');
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
          onShowToast={showToast}
        />
      )}

      {movementIntentModalOpen && (
        <MovementIntentModal
          isOpen={movementIntentModalOpen}
          onClose={() => setMovementIntentModalOpen(false)}
          initialRole={movementIntentRole}
          initialOriginHubId={movementIntentOriginHub}
          initialDestHubId={movementIntentDestHub}
          initialDate={movementIntentDate}
          initialTimeSlot={movementIntentTimeSlot}
          currentUser={currentUser}
          onSuccess={() => {
            setActiveTab('booked');
          }}
          onShowToast={showToast}
        />
      )}

      {isQuickPostTripOpen && (
        <React.Suspense fallback={null}>
          <QuickPostTripModal
            isOpen={isQuickPostTripOpen}
            onClose={() => setIsQuickPostTripOpen(false)}
            currentUser={currentUser}
            onSuccess={(newTrip) => {
              handlePostTrip(newTrip, currentUser);
              setActiveTab('cockpit');
            }}
            onShowToast={showToast}
          />
        </React.Suspense>
      )}

      <BottomNavBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenInbox={handleOpenInbox}
        onOpenQuickPostTrip={() => setIsQuickPostTripOpen(true)}
        bookedCount={activeBookedCount}
      />
      <PwaInstallPrompt />
      <AppleMacNotification onOpenInbox={handleOpenInbox} onSelectBooking={handleOpenInbox} />
      <Toast message={toastMessage} />
    </div>
  );
}

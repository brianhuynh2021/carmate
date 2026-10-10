import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import InstantBookingModal from './components/modals/InstantBookingModal.jsx';
const QuickPostTripModal = React.lazy(() => import('./components/modals/QuickPostTripModal.jsx'));

// Modals
import TrustProfileModal from './components/modals/TrustProfileModal.jsx';
import PolicyModal from './components/modals/PolicyModal.jsx';
import CancelModal from './components/modals/CancelModal.jsx';
import DelayModal from './components/modals/DelayModal.jsx';
import MutualReviewModal from './components/modals/MutualReviewModal.jsx';
import RouteDetailModal from './components/modals/RouteDetailModal.jsx';
import EditTripModal from './components/modals/EditTripModal.jsx';
import AuthModal from './components/modals/AuthModal.jsx';
import TermsModal from './components/modals/TermsModal.jsx';
import AiConciergeModal from './components/agent/AiConciergeModal.jsx';
import CarPhotosModal from './components/modals/CarPhotosModal.jsx';
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

  // Ensure the UI defaults to a bright Clean Light Theme
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  // Safely initialize Analytics and Sentry exception monitoring
  useEffect(() => {
    initAnalytics();
    initSentry();
  }, []);

  // Detect the dedicated Subdomain: ops.carmate.vn / admin.carmate.vn / ?portal=ops
  const isOpsPortal =
    typeof window !== 'undefined' &&
    (window.location.hostname.startsWith('ops.') ||
      window.location.hostname.startsWith('admin.') ||
      window.location.search.includes('portal=ops'));

  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const canAccessAdmin = isOpsPortal || isLocalhost;

  // List of valid Tabs across the whole CarMate ecosystem (Level 3 Architecture)
  const VALID_TABS = useMemo(() => ['market', 'intent', 'station', 'cockpit', 'booked', 'admin'], []);

  // Clean URL Pathname mapping in the Apple & Vercel style (Zero #)
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

    // 1. Detect the dedicated Admin Portal (MIT Invariant standard: isolated on admin.* / ops.*)
    if (
      isOpsPortal ||
      (isLocalhost &&
        (window.location.hash === '#admin' ||
          window.location.pathname === '/admin' ||
          window.location.pathname.startsWith('/admin')))
    ) {
      return 'admin';
    }

    // 2. Detect Clean URL Pathname (/booked, /radar, /match, /market, /admin, /cockpit, /tram, /intent, /post)
    const rawPath = window.location.pathname.replace(/^\/+/, '').split('/')[0].trim().toLowerCase();
    if (!rawPath) {
      // When accessing the root path '/' (carmate.vn) -> always 100% the 'market' home page
      return 'market';
    }
    if (rawPath === 'admin' && !canAccessAdmin) {
      // Block access to /admin on the main domain (MIT Zero Attack Surface)
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

    // 3. Backward compatibility with the old URL Hash
    const rawHash = window.location.hash.replace('#', '').trim().toLowerCase();
    if (rawHash === 'admin' && !canAccessAdmin) {
      // Block access to #admin on the main domain
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

    // 4. Detect the Search Query parameter (?tab=...)
    try {
      const params = new URLSearchParams(window.location.search);
      const queryTab = params.get('tab');
      if (queryTab === 'my_trips' || queryTab === 'my-trips') return 'booked';
      if (queryTab === 'post' || queryTab === 'intent') return 'intent';
      if (queryTab && VALID_TABS.includes(queryTab)) {
        return queryTab;
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

  // MIT invariant: permanently normalize the tab 'my_trips' -> 'my-trips' so it never falls into an empty state
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

    // Two-way Clean URL Pathname sync (Zero #, Apple & Vercel style)
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('carmate_active_tab');
        const targetPath = getPathForTab(activeTab);
        const currentPath = window.location.pathname;
        const currentHash = window.location.hash;

        // Clean technical parameters out of the address bar before writing the URL back.
        // '_r' is attached by ErrorBoundary to bust the cache after a crash; it carries no meaning
        // for the user, but because the URL is always rebuilt with the old search string
        // it sticks around permanently and travels with every shared link.
        let search = window.location.search;
        try {
          const params = new URLSearchParams(search);
          let cleaned = false;
          for (const key of ['_r', '_rsc']) {
            if (params.has(key)) {
              params.delete(key);
              cleaned = true;
            }
          }
          if (cleaned) {
            const rest = params.toString();
            search = rest ? `?${rest}` : '';
          }
        } catch {}

        if (activeTab === 'admin') {
          if (isOpsPortal) {
            if (currentHash) {
              window.history.replaceState(null, '', currentPath + search);
            }
          } else if (currentPath !== '/admin') {
            window.history.pushState(null, '', '/admin' + search);
          }
        } else {
          // If the URL still carries an old hash (e.g. #my-trips), clean it permanently without leaving a # behind
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

  // Listen for browser Back/Forward events or URL changes
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

  // One-tap driver Magic Link & Apple Re-entry Card for passengers returning to the web
  const { driverConfirmCode, setDriverConfirmCode } = useZaloReentry({
    isOpsPortal,
    onNavigateTab: setActiveTab
  });

  // Logged-in user state (multi-layer sync of LocalStorage + First-Party Cookie)
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

  // State of the virtual pickup station scanned via QR or chosen from the map
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

  // Hook that manages Modals
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
    openAuthWithContext,
    takeAuthContinuation,
    cancelAuth
  } = useAppModals();

  // My Profile & Garage state (Apple Portal Modal)
  const [showProfileModal, setShowProfileModal] = useState(false);
  // State of the 15s Quick Post Trip Modal
  const [isQuickPostTripOpen, setIsQuickPostTripOpen] = useState(false);

  // Handle saving the driver's personal info & vehicle Garage
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
      return updated;
    } catch (err) {
      console.error('[Profile] Lỗi lưu hồ sơ:', err);
      throw err;
    }
  };

  // Helper that counts my posts
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

  // Helper that checks whether a trip belongs to the current user (MIT Invariant)
  const checkIsMyTrip = useCallback(
    (trip) => {
      if (!trip) return false;
      try {
        // 1. Scan all post IDs stored in localStorage (preserves both the guest session + the logged-in session)
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

        // 2. Match the logged-in user identity (User ID / normalized phone number / Telegram ID)
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

  // Hook that manages trip data & Escrow Bookings
  const {
    driverOffers,
    passengerRequests,
    bookedEscrows,
    handleBookingCreated,
    refreshBookings,
    toastMessage,
    showToast,
    recordPostedTrip,
    handleEditTrip,
    handleToggleTripStatus,
    handleDeleteTrip,
    handleConfirmBooking,
    handleConfirmCancel,
    handleSendDelay,
    handleCompleteTrip,
    handleSubmitReview
  } = useTripsData({
    currentUser,
    updateMyTripsCount,
    setActiveTab,
    setSelectedItemForEscrow,
    setCancelRecord,
    setDelayRecord,
    setReviewRecord,
    onRequireAuth: openAuthWithContext,
    onSaveProfile: handleSaveProfile,
    t
  });

  // Automatically refresh the trip list when the user opens the My Trips tab
  useEffect(() => {
    if (activeTab === 'booked') {
      refreshBookings();
    }
  }, [activeTab, refreshBookings]);

  // QR scanning & direct deep links to a trip (?trip=... or /t/...)
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

  // Manage the Read / Unread state (Read & Unread Tracking) of the Inbox
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

  // Mark all notifications / requests in the Inbox as read
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

  // Count the requests that are truly UNREAD in the Inbox (inquiring or pre_confirmed or deliberately marked Read Later)
  const inboxCount = useMemo(() => {
    const userPhone = currentUser?.phone ? cleanPhoneNumber(currentUser.phone) : '';
    return (bookedEscrows || []).filter((b) => {
      const bId = b.escrowId || b.id;
      // 1. If the user deliberately marked "Chưa đọc (Đọc sau)" ("Unread (Read later)")
      if (unreadBookingIds.includes(bId)) return true;

      // 2. Only count trips that are being negotiated or reserved
      if (b.status !== 'inquiring' && b.status !== 'pre_confirmed') return false;
      const lastRead = readBookingTimestamps[bId] || 0;
      if (!lastRead) return true; // Never opened -> Unread

      // 3. If there is a new message from the other party after the last read
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

  // Hook that manages marketplace Filters & time Grouping
  // Only take the values still in use: most of the old marketplace filters were removed along with
  // FilterBar/Hero, leaving 18 dead variables in the lint pass.
  const { searchKeyword, setMarketViewMode, resetFilters } = useMarketFilters({
    driverOffers,
    passengerRequests
  });

  // Sync the count of my trips when the trip list changes
  useEffect(() => {
    updateMyTripsCount(currentUser, driverOffers, passengerRequests);
    const handleStorageChange = () => updateMyTripsCount(currentUser, driverOffers, passengerRequests);
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [currentUser, driverOffers, passengerRequests, updateMyTripsCount]);

  // Manage the Level 3 Route Corridor & the marketplace view state
  const [activeCorridor] = useState('Tuyến QL13');

  // Manage Social Smart Match Suggestions (Ambient Intelligence)
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

  // Global shortcuts: ⌘K / Ctrl+K opens the Assistant, ⌘+Shift+A opens the Admin Portal
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

  // Automatically restore and sync the login session from the Token (Silent Session Restore - Stanford Ergonomics)
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
        // Only clean up if the token has really expired or was rejected with a 401
        if (err?.status === 401) {
          handleLogout();
        }
      });

    return () => {
      isMounted = false;
    };
    // INTENTIONALLY runs once at mount: this is the login-session restore step.
    // Adding deps would make the app re-validate the token every time the trip list changes.
    // My trip count does not go stale: the effect above (with full deps) recomputes as soon as
    // driverOffers/passengerRequests finish loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [movementIntentModalOpen, setMovementIntentModalOpen] = useState(false);
  const [movementIntentRole, setMovementIntentRole] = useState('passenger');
  const [movementIntentOriginHub, setMovementIntentOriginHub] = useState(null);
  const [movementIntentDestHub, setMovementIntentDestHub] = useState(null);
  const [movementIntentDate, setMovementIntentDate] = useState(null);
  const [movementIntentTimeSlot, setMovementIntentTimeSlot] = useState(null);
  const [movementIntentSeats, setMovementIntentSeats] = useState(1);

  const handleOpenMovementIntent = useCallback((targetRole = 'passenger', hubId = null, destHubId = null, initialDate = null, initialTimeSlot = null, initialSeats = 1) => {
    const validRole = targetRole === 'driver' ? 'driver' : 'passenger';
    setMovementIntentRole(validRole);
    setMovementIntentOriginHub(hubId || null);
    setMovementIntentDestHub(destHubId || null);
    setMovementIntentDate(initialDate || null);
    setMovementIntentTimeSlot(initialTimeSlot || null);
    setMovementIntentSeats(initialSeats);
    setMovementIntentModalOpen(true);
  }, []);

  // Level 3 Autonomous Gateway: the driver opens the 15s QuickPostTripModal; the passenger ("Người đi cùng") opens the Movement Intent declaration
  const handleRequestPostTrip = useCallback((targetRole = 'driver') => {
    if (targetRole === 'driver') {
      setIsQuickPostTripOpen(true);
    } else {
      handleOpenMovementIntent('passenger');
    }
  }, [handleOpenMovementIntent]);

  // If the user visits /intent or /post, automatically open the Movement Intent declaration modal
  useEffect(() => {
    if (activeTab === 'intent') {
      handleOpenMovementIntent('passenger');
      setActiveTab('market');
    }
  }, [activeTab, handleOpenMovementIntent, setActiveTab]);

  // Generation token for post-loading requests: only the latest response is allowed to open the modal
  const manageTripRequestRef = useRef(0);

  // Manage my own trip: directly open the Manage / Edit Modal in place (Stanford Ergonomics - Zero tab jump)
  // Note: the marketplace (market) passes in a time-slot matrix "slot" — this is a public projection
  // (license plate / photos masked, fields renamed: fromLocation, seatsAvailable, vehicleModel...), NOT the original trip record.
  // If the slot is passed straight into EditTripModal, every field falls back to its default value and the post is displayed with the wrong type.
  // So always resolve to the real trip record before opening the modal.
  const handleManageMyTrip = useCallback(
    (trip) => {
      if (!trip) return;

      const targetId = trip.tripId || trip.id;
      if (!targetId) {
        showToast('Bài đăng này chưa sẵn sàng để chỉnh sửa');
        return;
      }

      // Match by id only. Do NOT use maskedCode as a matching condition:
      // this code is randomly generated in the range CX-100..999 and is not UNIQUE in the DB,
      // so it could open (and overwrite) someone else's post by mistake.
      const allTrips = [...(driverOffers || []), ...(passengerRequests || [])];
      const match = allTrips.find((t) => String(t.id) === String(targetId));

      if (match) {
        setEditingTrip(match);
        return;
      }

      // Not in memory yet (e.g. the marketplace returned a trip outside the currently loaded list) -> fetch the original record from the API.
      // Use the generation token to discard stale responses when the user quickly taps several trips.
      const requestId = ++manageTripRequestRef.current;
      api
        .getTrip(targetId)
        .then((res) => {
          if (requestId !== manageTripRequestRef.current) return;
          if (res?.data) {
            setEditingTrip(res.data);
          } else {
            showToast('Không tải được bài đăng, vui lòng thử lại');
          }
        })
        .catch((err) => {
          if (requestId !== manageTripRequestRef.current) return;
          console.warn('[ManageMyTrip] Không tìm thấy chuyến xe:', targetId, err.message);
          showToast('Không tải được bài đăng, vui lòng thử lại');
        });
    },
    [driverOffers, passengerRequests, setEditingTrip, showToast]
  );

  // Match a trip: if it is my own post, open the Manage Modal in place instead of switching tabs
  const handleInitiateBook = (trip) => {
    if (checkIsMyTrip(trip)) {
      showToast('Đây là bài đăng của bạn. Bạn đang ở chế độ Quản lý chuyến xe.');
      handleManageMyTrip(trip);
      return;
    }
    trackViewTrip(trip.id, `${trip.from} - ${trip.to}`);

    setSelectedItemForEscrow(trip);
  };

  const handleAuthSuccess = (user, tripIds = []) => {
    const continueAction = takeAuthContinuation();
    setShowAuthModal(false);
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
      subtitle: 'Quản lý chuyến và nhận phản hồi cho nhu cầu của bạn.',
      contextNotice: null,
      pendingTab: null
    });

    if (continueAction) {
      try {
        Promise.resolve(continueAction(user)).catch((err) => showToast(err.message || 'Không thể tiếp tục thao tác. Vui lòng thử lại.'));
      } catch (err) {
        showToast(err.message || 'Không thể tiếp tục thao tác. Vui lòng thử lại.');
      }
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

  const authDialog = showAuthModal ? (
    <AuthModal
      onClose={cancelAuth}
      onSuccess={handleAuthSuccess}
      initialPhone={currentUser?.phone || ''}
      title={authModalConfig.title}
      subtitle={authModalConfig.subtitle}
      contextNotice={authModalConfig.contextNotice}
    />
  ) : null;

  // CAR DASHBOARD MODE (FULL-SCREEN COCKPIT HUD FOR THE DRIVER)
  if (activeTab === 'cockpit') {
    return (
      <>
        <CockpitMode
          onRequireAuth={openAuthWithContext}
          onOpenBookings={() => { try { sessionStorage.setItem('carmate_booked_subtab', 'active'); } catch { /* optional preference */ } setActiveTab('booked'); }}
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
              onRequireAuth={openAuthWithContext}
              onSuccess={(newTrip, owner) => {
                recordPostedTrip(newTrip, owner);
                try {
                  sessionStorage.setItem('carmate_booked_subtab', 'driver');
                } catch {}
                setActiveTab('booked');
              }}
              onShowToast={showToast}
            />
          </React.Suspense>
        )}
        {authDialog}
        <Toast message={toastMessage} />
      </>
    );
  }

  // GAS-STATION PICKUP POINT QR SCAN MODE (RIDER STATION LIVE PASS FOR PASSENGERS)
  if (activeTab === 'station') {
    return (
      <>
        <StationRiderView
          hubId={stationHubId}
          initialDestinationHubId={stationDestinationHubId}
          currentUser={currentUser}
          onRequireAuth={openAuthWithContext}
          onBack={() => setActiveTab('market')}
          onShowToast={showToast}
          onViewBookedTab={(tab, booking) => {
            if (booking) handleBookingCreated(booking);
            setActiveTab('booked');
          }}
          onBookingCreated={handleBookingCreated}
          onAuthSuccess={handleAuthSuccess}
        />
        {authDialog}
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
        {/* ── National Highway 13 Passing-Vehicle Route (Zero Posting Paradigm) ── */}
        {activeTab === 'market' && (
          <div className={`${container} py-5 sm:py-8`}>
            <CorridorSearchBoard
              currentUser={currentUser}
              onRequireAuth={openAuthWithContext}
              checkIsMyTrip={checkIsMyTrip}
              onManageTrip={handleManageMyTrip}
              onOpenCockpit={() => setActiveTab('cockpit')}
              onOpenStationView={(hub, destHub) => {
                setStationHubId(hub || 'hub_ql13_tan_khai');
                setStationDestinationHubId(destHub || null);
                setActiveTab('station');
              }}
              onOpenIntentModal={(targetRole, hubId, destHubId, targetDate, targetTimeSlot, targetSeats) => {
                handleOpenMovementIntent(targetRole, hubId, destHubId, targetDate, targetTimeSlot, targetSeats);
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
              onOpenCockpit={() => setActiveTab('cockpit')}
              onOpenQuickPostTrip={() => setIsQuickPostTripOpen(true)}
              onShowToast={showToast}
            />
          </div>
        )}

        {activeTab === 'admin' && (
          <React.Suspense
            fallback={
              <div className="type-caption min-h-[50vh] flex flex-col items-center justify-center gap-2 text-slate-400">
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
        <InstantBookingModal
          isOpen
          trip={selectedItemForEscrow}
          currentUser={currentUser}
          onRequireAuth={openAuthWithContext}
          onClose={() => setSelectedItemForEscrow(null)}
          onBookingSuccess={(booking) => handleConfirmBooking(booking, { keepModalOpen: true })}
          onViewBookedTab={() => {
            setSelectedItemForEscrow(null);
            try { sessionStorage.setItem('carmate_booked_subtab', 'active'); } catch { /* optional preference */ }
            setActiveTab('booked');
          }}
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
      {editingTrip && (
        <EditTripModal
          // The form initializes state from props and does not re-sync -> it must remount when the post changes,
          // otherwise the input fields keep the old trip data while Save/Delete actions target the new trip.
          key={editingTrip.id}
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
          onRequireAuth={openAuthWithContext}
          initialRole={movementIntentRole}
          initialOriginHubId={movementIntentOriginHub}
          initialDestHubId={movementIntentDestHub}
          initialDate={movementIntentDate}
          initialTimeSlot={movementIntentTimeSlot}
          initialSeats={movementIntentSeats}
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
            onRequireAuth={openAuthWithContext}
            onSuccess={(newTrip, owner) => {
              recordPostedTrip(newTrip, owner);
              try {
                sessionStorage.setItem('carmate_booked_subtab', 'driver');
              } catch {}
              setActiveTab('booked');
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
      {authDialog}
      <Toast message={toastMessage} />
    </div>
  );
}

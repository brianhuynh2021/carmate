import React, { useState, useEffect, useCallback } from 'react';
import { SearchX, LayoutGrid, Car, Users, ChevronDown, MapPin, Navigation, Search, X, ArrowRight } from 'lucide-react';
import { TIME_SLOTS } from '@carmate/shared';
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
import RouteBenchmarkBar from './components/market/RouteBenchmarkBar.jsx';
import TripCard from './components/market/TripCard.jsx';

// Views
import PostTripForm from './components/post/PostTripForm.jsx';
import PostTripAuthGuard from './components/post/PostTripAuthGuard.jsx';
import MatchRadarView from './components/radar/MatchRadarView.jsx';
import BookedTripList from './components/booked/BookedTripList.jsx';
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
    trackPageView(activeTab);
  }, [activeTab]);

  // Magic Link 1-Chạm Bác tài & Apple Re-entry Card Khách quay lại web
  const {
    driverConfirmCode,
    setDriverConfirmCode,
    pendingZaloBooking,
    setPendingZaloBooking
  } = useZaloReentry({
    isOpsPortal,
    onNavigateTab: setActiveTab
  });

  // State Người dùng đăng nhập
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [myTripsCount, setMyTripsCount] = useState(0);

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

  // Helper tính số lượng bài đăng của tôi
  const updateMyTripsCount = useCallback((user = currentUser, offers = null, requests = null) => {
    try {
      let storedIds = [];
      if (!user) {
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

      const validTrips = all.filter((t) => {
        if (user) {
          if (t.userId && t.userId === user.id) return true;
          if (userPhoneClean && t.phoneReal && String(t.phoneReal).replace(/\D/g, '') === userPhoneClean) return true;
          return storedIds.includes(t.id);
        }
        return storedIds.includes(t.id);
      });

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
  }, [currentUser]);

  // Hook quản lý Dữ liệu chuyến đi & Escrow Bookings
  const {
    driverOffers,
    setDriverOffers,
    passengerRequests,
    setPassengerRequests,
    bookedEscrows,
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
    t
  });

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
    filteredItems,
    temporalGroups,
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

  // Phím tắt toàn cục ⌘K / Ctrl+K mở AI Trợ lý, ⌘+Shift+A mở Cổng Quản trị
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key?.toLowerCase() === 'k') {
        e.preventDefault();
        setShowAiModal(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key?.toLowerCase() === 'a') {
        e.preventDefault();
        setActiveTab(prev => (prev === 'admin' ? 'market' : 'admin'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab, setShowAiModal]);

  // Guarded Action: Chặn khách chưa đăng nhập vào form tạo xe
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

  // Ghép chuyến: Chưa đăng nhập sẽ yêu cầu xác thực OTP trước
  const handleInitiateBook = (trip) => {
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
      subtitle: 'Đồng bộ bài đăng · Tiết kiệm chi phí · 100% an toàn',
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
      api.logout();
    } catch {}
    setMyTripsCount(0);
    showToast('Đã đăng xuất tài khoản.');
  };

  const handleAccountDeleted = () => {
    if (currentUser) {
      const uId = currentUser.id;
      const uPhone = currentUser.phone ? String(currentUser.phone).replace(/\D/g, '') : '';
      setDriverOffers(prev => prev.filter(t => t.userId !== uId && (!uPhone || String(t.phoneReal).replace(/\D/g, '') !== uPhone)));
      setPassengerRequests(prev => prev.filter(t => t.userId !== uId && (!uPhone || String(t.phoneReal).replace(/\D/g, '') !== uPhone)));
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
        onOpenDeleteAccount={() => setShowDeleteAccountModal(true)}
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
              <RouteBenchmarkBar
                searchKeyword={searchKeyword}
                setSearchKeyword={setSearchKeyword}
                forceOpen={showBenchmarkModal}
                onCloseForced={() => setShowBenchmarkModal(false)}
              />

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
      <Toast message={toastMessage} />
    </div>
  );
}

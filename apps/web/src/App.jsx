import React, { useState, useMemo, useEffect } from 'react';
import { SearchX, LayoutGrid, Car, Users, Sparkles, ChevronDown, MapPin, Navigation, Search, X, ArrowRight } from 'lucide-react';
import { INITIAL_DRIVER_OFFERS, INITIAL_PASSENGER_REQUESTS, INITIAL_BOOKED_ESCROWS, TIME_SLOTS } from '@carmate/shared';
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
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [pendingBookingTrip, setPendingBookingTrip] = useState(null);

  // Kích hoạt ghép chuyến có bảo vệ danh tính: Chưa đăng nhập sẽ yêu cầu xác thực OTP trước
  const handleInitiateBook = (trip) => {
    if (!currentUser) {
      setPendingBookingTrip(trip);
      setShowAuthModal(true);
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

  const updateMyTripsCount = (user = currentUser) => {
    try {
      if (!user) {
        // Khi chưa đăng nhập (khách vãng lai), chỉ đếm chuyến do chính máy này tạo ở chế độ khách
        // Tự động dọn sạch cache legacy cũ nếu còn sót từ phiên test trước
        if (localStorage.getItem('carmate_my_trip_ids')) {
          localStorage.removeItem('carmate_my_trip_ids');
        }
        const guestStored = JSON.parse(localStorage.getItem('carmate_guest_trip_ids') || '[]');
        setMyTripsCount(Array.isArray(guestStored) ? guestStored.length : 0);
        return;
      }
      const userKey = `carmate_my_trip_ids_${user.id || user.phone}`;
      const stored = JSON.parse(localStorage.getItem(userKey) || '[]');
      setMyTripsCount(Array.isArray(stored) ? stored.length : 0);
    } catch {
      setMyTripsCount(0);
    }
  };

  useEffect(() => {
    updateMyTripsCount(currentUser);
    const handleStorageChange = () => updateMyTripsCount(currentUser);
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [currentUser]);

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

    return list.filter((item) => {
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        const perksStr = Array.isArray(item.perks) ? item.perks.join(' ') : '';
        const parcelStr = item.acceptsParcel ? 'gửi hàng gửi đồ bưu phẩm' : '';
        const matchText = `${item.from} ${item.to} ${item.routeCategory} ${item.hometown || ''} ${item.notes || ''} ${perksStr} ${parcelStr}`.toLowerCase();
        if (!matchText.includes(kw)) return false;
      }
      if (searchFrom.trim()) {
        const kw = searchFrom.toLowerCase();
        const matchText = `${item.from} ${item.hometown || ''}`.toLowerCase();
        if (!matchText.includes(kw)) return false;
      }
      if (searchTo.trim()) {
        const kw = searchTo.toLowerCase();
        const matchText = `${item.to}`.toLowerCase();
        if (!matchText.includes(kw)) return false;
      }
      if (selectedTimeSlot !== 'all' && item.timeSlot !== selectedTimeSlot) return false;
      if (selectedDirection !== 'all' && item.direction !== selectedDirection) return false;
      if (selectedCarCategory !== 'all' && item.type === 'driver_offer') {
        const isConvenient = item.carCategory === 'convenient_trip' || item.notes?.toLowerCase().includes('tiện chuyến');
        if (selectedCarCategory === 'convenient_trip' && !isConvenient) return false;
        if (selectedCarCategory === 'family_car' && isConvenient) return false;
      }
      return true;
    });
  }, [driverOffers, passengerRequests, marketViewMode, searchKeyword, searchFrom, searchTo, selectedTimeSlot, selectedDirection, selectedCarCategory]);

  // Handlers với kết nối Backend Engine
  const handlePostTrip = async (newTrip) => {
    if (currentUser) {
      newTrip.userId = currentUser.id;
      if (!newTrip.phoneReal && currentUser.phone) newTrip.phoneReal = currentUser.phone;
      if (!newTrip.publicName && currentUser.name) newTrip.publicName = currentUser.name;
    }

    if (newTrip.type === 'driver_offer') setDriverOffers(prev => [newTrip, ...prev]);
    else setPassengerRequests(prev => [newTrip, ...prev]);
    showToast(t('toast.postSuccess'));
    setTicketToShare(newTrip);
    setActiveTab('market');

    // Lưu bài vào localStorage theo tài khoản đăng nhập hoặc phiên khách
    try {
      const storageKey = currentUser ? `carmate_my_trip_ids_${currentUser.id || currentUser.phone}` : 'carmate_guest_trip_ids';
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const updated = [newTrip.id, ...stored.filter(id => id !== newTrip.id)];
      localStorage.setItem(storageKey, JSON.stringify(updated));
      updateMyTripsCount(currentUser);
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
            const storageKey = currentUser ? `carmate_my_trip_ids_${currentUser.id || currentUser.phone}` : 'carmate_guest_trip_ids';
            const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
            const updated = [res.data.id, ...stored.filter(id => id !== newTrip.id)];
            localStorage.setItem(storageKey, JSON.stringify(updated));
            updateMyTripsCount(currentUser);
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
    <div className="min-h-screen flex flex-col bg-[#f8fafc] dark:bg-[#090d16] text-slate-900 dark:text-slate-100 antialiased transition-colors selection:bg-[#0071e3]/15 selection:text-[#0071e3]">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        setShowPolicyModal={setShowPolicyModal}
        bookedCount={activeBookedCount}
        myTripsCount={myTripsCount}
        currentUser={currentUser}
        onOpenAuth={() => setShowAuthModal(true)}
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
              onPostClick={() => setActiveTab('post')}
            />

            <div className={`${container} py-5 sm:py-6 space-y-5`}>

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

              {/* 4. Danh sách các chuyến xe (Spacious grid) */}
              <div id="market-results" className="space-y-4 scroll-mt-24">
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-bold font-mono pt-0.5">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#107c41]"></span>
                    </span>
                    <span>{filteredItems.length === 1 ? t('market.resultsOne') : t('market.results', { n: filteredItems.length })}</span>
                  </div>
                </div>

                {filteredItems.length === 0 ? (
                  <EmptyState
                    icon={SearchX}
                    title={t('market.emptyTitle')}
                    description={t('market.emptyDesc')}
                    action={<Button variant="outline" onClick={() => { setSearchKeyword(''); resetFilters(); }}>{t('market.resetFilters')}</Button>}
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-6 lg:gap-7">
                    {filteredItems.map((item) => (
                      <TripCard
                        key={item.id}
                        item={item}
                        onBook={handleInitiateBook}
                        onShare={setTicketToShare}
                        onViewTrustProfile={setSelectedDriverForTrust}
                        onViewRoute={setSelectedTripForRoute}
                      />
                    ))}
                  </div>
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
            <PostTripForm onSubmit={handlePostTrip} currentUser={currentUser} />
          </div>
        )}

        {activeTab === 'my-trips' && (
          <div className={`${container} py-8`}>
            <MyTripsView
              driverOffers={driverOffers}
              passengerRequests={passengerRequests}
              currentUser={currentUser}
              onOpenAuth={() => setShowAuthModal(true)}
              onEditTrip={(trip) => setEditingTrip(trip)}
              onToggleStatus={handleToggleTripStatus}
              onDeleteTrip={handleDeleteTrip}
              onPostNew={() => setActiveTab('post')}
              onViewInMarket={handleViewTripInMarket}
              onViewTrip={(trip) => setTicketToShare(trip)}
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
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
          initialPhone={currentUser?.phone || ''}
        />
      )}

      {/* Trợ Lý AI Concierge Modal (Mô hình Stanford + MIT) */}
      <AiConciergeModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        onSelectTrip={(trip) => {
          setShowAiModal(false);
          handleViewTripInMarket(trip);
        }}
      />

      <BottomNavBar activeTab={activeTab} setActiveTab={setActiveTab} bookedCount={activeBookedCount} myTripsCount={myTripsCount} />
      <PwaInstallPrompt />
      <Toast message={toastMessage} />
    </div>
  );
}

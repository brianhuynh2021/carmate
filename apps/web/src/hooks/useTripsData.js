import { useState, useEffect, useCallback } from 'react';
import { 
  INITIAL_DRIVER_OFFERS, 
  INITIAL_PASSENGER_REQUESTS, 
  INITIAL_BOOKED_ESCROWS, 
  getTomorrowISO 
} from '@carmate/shared';
import api from '../api/client.js';
import { trackInitiateBooking, trackOpenZalo, trackDriverConfirm } from '../utils/analytics.js';

/**
 * Custom Hook quản lý dữ liệu chuyến đi, kết nối Zalo / Escrow và đồng bộ Backend
 */
export default function useTripsData({
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
}) {
  const [driverOffers, setDriverOffers] = useState(INITIAL_DRIVER_OFFERS);
  const [passengerRequests, setPassengerRequests] = useState(INITIAL_PASSENGER_REQUESTS);
  const [bookedEscrows, setBookedEscrows] = useState(INITIAL_BOOKED_ESCROWS);
  const [platformStats, setPlatformStats] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

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

  // Tái đăng 1 chạm (1-Tap Re-publish) chuyến cũ cho ngày mai
  const handleRePublishTrip = useCallback(async (trip) => {
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

      try {
        const storageKey = currentUser
          ? `carmate_my_trip_ids_${currentUser.id || currentUser.phone}`
          : 'carmate_guest_trip_ids';
        const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const updated = [createdTrip.id, ...stored.filter(id => id !== createdTrip.id)];
        localStorage.setItem(storageKey, JSON.stringify(updated));
        updateMyTripsCount?.(currentUser);
      } catch {}

      showToast('⚡ Đã tái đăng chuyến thành công cho ngày mai!');
    } catch {
      showToast('Không thể tái đăng chuyến xe. Vui lòng thử lại!');
    }
  }, [currentUser, showToast, updateMyTripsCount]);

  // Đăng chuyến mới
  const handlePostTrip = useCallback(async (newTrip, authUser = currentUser) => {
    if (!authUser) {
      setPendingPostTrip?.(newTrip);
      setShowAuthModal?.(true);
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
    showToast(t?.('toast.postSuccess') || 'Đăng chuyến thành công!');
    setTicketToShare?.(newTrip);
    setActiveTab?.('market');

    try {
      const storageKey = `carmate_my_trip_ids_${authUser.id || authUser.phone}`;
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const updated = [newTrip.id, ...stored.filter(id => id !== newTrip.id)];
      localStorage.setItem(storageKey, JSON.stringify(updated));
      updateMyTripsCount?.(authUser);
    } catch {}

    try {
      const res = await api.createTrip(newTrip);
      if (res?.success && res?.data) {
        if (newTrip.type === 'driver_offer') {
          setDriverOffers(prev => [res.data, ...prev.filter(i => i.id !== newTrip.id)]);
        } else {
          setPassengerRequests(prev => [res.data, ...prev.filter(i => i.id !== newTrip.id)]);
        }
        setTicketToShare?.(res.data);
        if (res.data.id !== newTrip.id) {
          try {
            const storageKey = `carmate_my_trip_ids_${authUser.id || authUser.phone}`;
            const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
            const updated = [res.data.id, ...stored.filter(id => id !== newTrip.id)];
            localStorage.setItem(storageKey, JSON.stringify(updated));
            updateMyTripsCount?.(authUser);
          } catch {}
        }
      }
    } catch (err) {
      console.warn('Backend sync failed, saved locally:', err);
    }
  }, [currentUser, setActiveTab, setPendingPostTrip, setShowAuthModal, setTicketToShare, showToast, t, updateMyTripsCount]);

  const handleEditTrip = useCallback(async (tripId, updates) => {
    setDriverOffers(prev => prev.map(t => t.id === tripId ? { ...t, ...updates } : t));
    setPassengerRequests(prev => prev.map(t => t.id === tripId ? { ...t, ...updates } : t));
    showToast('Đã lưu thay đổi thông tin chuyến xe!');

    try {
      await api.updateTrip(tripId, updates);
    } catch (err) {
      console.warn('Lỗi cập nhật chuyến đi lên backend:', err);
    }
  }, [showToast]);

  const handleToggleTripStatus = useCallback(async (tripId, newStatus) => {
    const updates = { status: newStatus };
    setDriverOffers(prev => prev.map(t => t.id === tripId ? { ...t, ...updates } : t));
    setPassengerRequests(prev => prev.map(t => t.id === tripId ? { ...t, ...updates } : t));
    showToast(newStatus === 'full' ? 'Đã đổi sang: Đã đủ người' : 'Đã mở lại nhận khách');

    try {
      await api.updateTrip(tripId, updates);
    } catch (err) {
      console.warn('Lỗi cập nhật trạng thái chuyến đi:', err);
    }
  }, [showToast]);

  const handleDeleteTrip = useCallback(async (tripId) => {
    setDriverOffers(prev => prev.filter(t => t.id !== tripId));
    setPassengerRequests(prev => prev.filter(t => t.id !== tripId));
    try {
      const storageKey = currentUser ? `carmate_my_trip_ids_${currentUser.id || currentUser.phone}` : 'carmate_guest_trip_ids';
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const updated = stored.filter(id => id !== tripId);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      localStorage.removeItem('carmate_my_trip_ids');
      updateMyTripsCount?.(currentUser);
    } catch {}
    showToast('Đã xóa bài đăng chuyến đi thành công.');

    try {
      await api.deleteTrip(tripId);
    } catch (err) {
      console.warn('Lỗi xóa chuyến đi:', err);
    }
  }, [currentUser, showToast, updateMyTripsCount]);

  const handleConfirmBooking = useCallback(async (newEscrow) => {
    setBookedEscrows(prev => [newEscrow, ...prev]);
    setSelectedItemForEscrow?.(null);
    showToast(t?.('toast.bookSuccess', { id: newEscrow.escrowId }) || 'Đã kết nối chuyến thành công!');
    setActiveTab?.('booked');

    // Funnel Analytics
    trackInitiateBooking(newEscrow.tripId, newEscrow.seats || 1);
    trackOpenZalo(newEscrow.tripId, 'passenger', `${newEscrow.from || ''} - ${newEscrow.to || ''}`);

    try {
      await api.createBooking(newEscrow);
    } catch (err) {
      console.warn('Booking sync to backend failed:', err);
    }
  }, [setActiveTab, setSelectedItemForEscrow, showToast, t]);

  const handleConfirmCancel = useCallback(async (escrowId, { reason } = {}) => {
    setBookedEscrows(prev => prev.map(e => e.escrowId === escrowId ? { ...e, status: 'cancelled', cancelReason: reason } : e));
    setCancelRecord?.(null);
    showToast(t?.('toast.cancelEarly') || 'Đã hủy kết nối chuyến');

    try {
      await api.cancelBooking(escrowId, reason);
    } catch (err) {
      console.warn('Cancel sync to backend failed:', err);
    }
  }, [setCancelRecord, showToast, t]);

  const handleConfirmedFromZaloReentry = useCallback((booking) => {
    setBookedEscrows(prev => prev.map(e => (e.escrowId === booking.escrowId || e.id === booking.escrowId) ? { ...e, bothConfirmed: true, status: 'zalo_active' } : e));
    setActiveTab?.('booked');
    trackDriverConfirm(booking.escrowId || booking.id, booking.tripId);
  }, [setActiveTab]);

  const handleSendDelay = useCallback(async (escrowId, minutes, note) => {
    setBookedEscrows(prev => prev.map(e => e.escrowId === escrowId ? { ...e, status: 'delayed', delayedMinutes: minutes, delayNote: note } : e));
    setDelayRecord?.(null);
    showToast(t?.('toast.delaySent', { n: minutes }) || `Đã báo trễ ${minutes} phút`);

    try {
      await api.reportDelay(escrowId, minutes, note);
    } catch (err) {
      console.warn('Delay sync to backend failed:', err);
    }
  }, [setDelayRecord, showToast, t]);

  const handleCompleteTrip = useCallback(async (escrowId, record) => {
    setBookedEscrows(prev => prev.map(e => e.escrowId === escrowId ? { ...e, status: 'completed' } : e));
    showToast(t?.('toast.completed') || 'Chuyến đi đã hoàn tất!');

    const targetBooking = record || bookedEscrows.find(e => e.escrowId === escrowId);
    if (targetBooking) {
      setReviewRecord?.(targetBooking);
    }

    try {
      await api.completeBooking(escrowId);
      const stats = await api.getStats();
      if (stats?.success) setPlatformStats(stats.data);
    } catch (err) {
      console.warn('Complete sync to backend failed:', err);
    }
  }, [bookedEscrows, setReviewRecord, showToast, t]);

  const handleSubmitReview = useCallback(async ({ escrowId, reviewerRole, rating, tags, comment }) => {
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
  }, [showToast]);

  return {
    driverOffers,
    setDriverOffers,
    passengerRequests,
    setPassengerRequests,
    bookedEscrows,
    setBookedEscrows,
    platformStats,
    setPlatformStats,
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
  };
}

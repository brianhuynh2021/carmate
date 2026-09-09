import { useState, useEffect, useCallback } from 'react';
// Không import dữ liệu mẫu vào đây: sàn chỉ được hiển thị chuyến từ máy chủ.
// Bỏ hẳn đường import khiến dữ liệu mẫu không thể vô tình quay lại giao diện.
import { getTomorrowISO, normalizePhoneNumber } from '@carmate/shared';
import api from '../api/client.js';
import { trackInitiateBooking, trackDriverConfirm } from '../utils/analytics.js';

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
  onSaveProfile,
  t
}) {
  // BẤT BIẾN SÀN THẬT: sàn chỉ hiển thị chuyến do máy chủ trả về.
  // Trước đây state khởi tạo bằng dữ liệu mẫu nên người dùng thấy ngay 13 chuyến
  // ảo khi mở trang (kể cả khi máy chủ không có chuyến nào), và dữ liệu mẫu đó
  // không bao giờ bị xoá vì nhánh cập nhật chỉ chạy khi mảng trả về > 0.
  // Khởi tạo rỗng: sàn trống là sự thật, và empty state sẽ mời đăng chuyến.
  const [driverOffers, setDriverOffers] = useState([]);
  const [passengerRequests, setPassengerRequests] = useState([]);
  const [bookedEscrows, setBookedEscrows] = useState([]);
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
          // Nhận cả mảng rỗng: "máy chủ không có chuyến nào" là một câu trả lời
          // hợp lệ và phải được phản ánh đúng trên sàn.
          if (Array.isArray(drivers)) setDriverOffers(drivers);
          if (Array.isArray(passengers)) setPassengerRequests(passengers);
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
    return () => {
      active = false;
    };
  }, []);

  // Tái đăng 1 chạm (1-Tap Re-publish) chuyến cũ cho ngày mai
  const handleRePublishTrip = useCallback(
    async (trip) => {
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
          setDriverOffers((prev) => [createdTrip, ...prev]);
        } else {
          setPassengerRequests((prev) => [createdTrip, ...prev]);
        }

        try {
          const storageKey = currentUser
            ? `carmate_my_trip_ids_${currentUser.id || currentUser.phone}`
            : 'carmate_guest_trip_ids';
          const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
          const updated = [createdTrip.id, ...stored.filter((id) => id !== createdTrip.id)];
          localStorage.setItem(storageKey, JSON.stringify(updated));
          updateMyTripsCount?.(currentUser);
        } catch {}

        showToast('⚡ Đã tái đăng chuyến thành công cho ngày mai!');
      } catch {
        showToast('Không thể tái đăng chuyến xe. Vui lòng thử lại!');
      }
    },
    [currentUser, showToast, updateMyTripsCount]
  );

  // Đăng chuyến mới
  const handlePostTrip = useCallback(
    async (newTrip, authUser = currentUser) => {
      if (!authUser) {
        setPendingPostTrip?.(newTrip);
        setShowAuthModal?.(true);
        showToast('Vui lòng xác thực SĐT hoặc Zalo để hoàn tất đăng chuyến');
        return;
      }

      newTrip.userId = authUser.id;
      if (authUser.phone && !newTrip.phoneReal) newTrip.phoneReal = authUser.phone;
      if (
        authUser.name &&
        (!newTrip.publicName || newTrip.publicName.startsWith('Chủ xe #') || newTrip.publicName.startsWith('Khách #'))
      ) {
        newTrip.publicName = authUser.name;
      }

      if (newTrip.type === 'driver_offer') setDriverOffers((prev) => [newTrip, ...prev]);
      else setPassengerRequests((prev) => [newTrip, ...prev]);
      showToast(t?.('toast.postSuccess') || 'Đăng chuyến thành công!');
      setActiveTab?.('market');
      setTicketToShare?.(newTrip);

      try {
        const storageKey = `carmate_my_trip_ids_${authUser.id || authUser.phone}`;
        const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const updated = [newTrip.id, ...stored.filter((id) => id !== newTrip.id)];
        localStorage.setItem(storageKey, JSON.stringify(updated));
        updateMyTripsCount?.(authUser);
      } catch {}

      // Tự động đồng bộ thông tin xe vào Garage / Hồ sơ cá nhân của Chủ xe (Stanford Ergonomics - Zero extra step)
      if (newTrip.type === 'driver_offer' && onSaveProfile && authUser && (newTrip.carType || (newTrip.carPhotos && newTrip.carPhotos.length > 0))) {
        try {
          const rawCar = (newTrip.carType || '').trim();
          const cleanCar = rawCar.replace(/\s*\(.*?\)/, '').trim();
          const words = cleanCar ? cleanCar.split(/\s+/) : [];
          const brand = words[0] || authUser.vehicle?.brand || '';
          const model = words.slice(1).join(' ') || authUser.vehicle?.model || cleanCar;
          const photos = Array.isArray(newTrip.carPhotos) && newTrip.carPhotos.length > 0
            ? newTrip.carPhotos
            : (authUser.vehicle?.photos || []);

          const existingPlate = authUser.vehicle?.plate || '';
          const tripPlate = newTrip.plate || newTrip.licensePlate || newTrip.plateMask || '';
          const plate = (existingPlate && !existingPlate.includes('*')) ? existingPlate : (tripPlate || existingPlate);

          const vehicleUpdate = {
            ...(authUser.vehicle || {}),
            brand: brand || authUser.vehicle?.brand || '',
            model: model || authUser.vehicle?.model || '',
            capacity: Number(newTrip.capacity || authUser.vehicle?.capacity || 5),
            carCategory: newTrip.carCategory || authUser.vehicle?.carCategory || 'family_car',
            plate,
            photos,
            hasVerifiedPhotos: photos.length >= 1,
            perks: Array.isArray(newTrip.perks) && newTrip.perks.length > 0
              ? newTrip.perks
              : (authUser.vehicle?.perks || [])
          };
          onSaveProfile({ vehicle: vehicleUpdate }).catch((err) => {
            console.warn('[useTripsData] Auto-sync garage warning:', err);
          });
        } catch (err) {
          console.warn('[useTripsData] Auto vehicle profile sync error:', err);
        }
      }

      try {
        const res = await api.createTrip(newTrip);
        if (res?.success && res?.data) {
          if (newTrip.type === 'driver_offer') {
            setDriverOffers((prev) => [res.data, ...prev.filter((i) => i.id !== newTrip.id)]);
          } else {
            setPassengerRequests((prev) => [res.data, ...prev.filter((i) => i.id !== newTrip.id)]);
          }
          if (res.data.id !== newTrip.id) {
            try {
              const storageKey = `carmate_my_trip_ids_${authUser.id || authUser.phone}`;
              const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
              const updated = [res.data.id, ...stored.filter((id) => id !== newTrip.id)];
              localStorage.setItem(storageKey, JSON.stringify(updated));
              updateMyTripsCount?.(authUser);
            } catch {}
          }
        }
      } catch (err) {
        console.warn('Backend sync failed, saved locally:', err);
      }
    },
    [
      currentUser,
      setActiveTab,
      setPendingPostTrip,
      setShowAuthModal,
      setTicketToShare,
      showToast,
      t,
      updateMyTripsCount,
      onSaveProfile
    ]
  );

  const handleEditTrip = useCallback(
    async (tripId, updates) => {
      setDriverOffers((prev) => prev.map((t) => (t.id === tripId ? { ...t, ...updates } : t)));
      setPassengerRequests((prev) => prev.map((t) => (t.id === tripId ? { ...t, ...updates } : t)));
      showToast('Đã lưu thay đổi thông tin chuyến xe!');

      // Nếu Chủ xe sửa thông tin xe hoặc ảnh, tự động đồng bộ vào Garage cá nhân
      if (onSaveProfile && currentUser && (updates.carType || updates.carPhotos || updates.capacity || updates.plateMask)) {
        try {
          const rawCar = (updates.carType || '').trim();
          const cleanCar = rawCar.replace(/\s*\(.*?\)/, '').trim();
          const words = cleanCar ? cleanCar.split(/\s+/) : [];
          const brand = words[0] || currentUser.vehicle?.brand || '';
          const model = words.slice(1).join(' ') || currentUser.vehicle?.model || cleanCar;
          const photos = Array.isArray(updates.carPhotos) && updates.carPhotos.length > 0
            ? updates.carPhotos
            : (currentUser.vehicle?.photos || []);

          const existingPlate = currentUser.vehicle?.plate || '';
          const editPlate = updates.plate || updates.licensePlate || updates.plateMask || '';
          const plate = (existingPlate && !existingPlate.includes('*')) ? existingPlate : (editPlate || existingPlate);

          const vehicleUpdate = {
            ...(currentUser.vehicle || {}),
            brand: brand || currentUser.vehicle?.brand || '',
            model: model || currentUser.vehicle?.model || '',
            capacity: Number(updates.capacity || currentUser.vehicle?.capacity || 5),
            plate,
            photos,
            hasVerifiedPhotos: photos.length >= 1
          };
          onSaveProfile({ vehicle: vehicleUpdate }).catch(() => {});
        } catch (err) {
          console.warn('[useTripsData] Edit sync garage error:', err);
        }
      }

      try {
        await api.updateTrip(tripId, updates);
      } catch (err) {
        console.warn('Lỗi cập nhật chuyến đi lên backend:', err);
      }
    },
    [showToast, onSaveProfile, currentUser]
  );

  const handleToggleTripStatus = useCallback(
    async (tripId, newStatus) => {
      const updates = { status: newStatus };
      const isDriverOffer = driverOffers.some((t) => t.id === tripId);
      setDriverOffers((prev) => prev.map((t) => (t.id === tripId ? { ...t, ...updates } : t)));
      setPassengerRequests((prev) => prev.map((t) => (t.id === tripId ? { ...t, ...updates } : t)));

      const toastMsg = isDriverOffer
        ? (newStatus === 'full' ? 'Đã đổi sang: Đã đủ người' : 'Đã mở lại nhận khách')
        : (newStatus === 'full' ? 'Đã đổi sang: Đã có xe' : 'Đã mở lại tìm xe');
      showToast(toastMsg);

      try {
        await api.updateTrip(tripId, updates);
      } catch (err) {
        console.warn('Lỗi cập nhật trạng thái chuyến đi:', err);
      }
    },
    [driverOffers, showToast]
  );

  const handleDeleteTrip = useCallback(
    async (tripId) => {
      setDriverOffers((prev) => prev.filter((t) => t.id !== tripId));
      setPassengerRequests((prev) => prev.filter((t) => t.id !== tripId));
      try {
        const storageKey = currentUser
          ? `carmate_my_trip_ids_${currentUser.id || currentUser.phone}`
          : 'carmate_guest_trip_ids';
        const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const updated = stored.filter((id) => id !== tripId);
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
    },
    [currentUser, showToast, updateMyTripsCount]
  );

  const handleConfirmBooking = useCallback(
    async (newEscrow, { keepModalOpen = false } = {}) => {
      if (currentUser && newEscrow) {
        const uPhone = currentUser.phone ? normalizePhoneNumber(currentUser.phone) : '';
        const dPhone = newEscrow.driverPhone ? normalizePhoneNumber(newEscrow.driverPhone) : '';
        if (uPhone && dPhone && uPhone === dPhone) {
          showToast('Bạn không thể gửi yêu cầu ghép cho chính bài đăng của mình.');
          return;
        }
      }

      setBookedEscrows((prev) => [newEscrow, ...prev]);
      if (!keepModalOpen) {
        setSelectedItemForEscrow?.(null);
        setActiveTab?.('booked');
      }
      showToast(t?.('toast.bookSuccess', { id: newEscrow.escrowId }) || 'Đã gửi yêu cầu ghép chuyến thành công!');

      // Funnel Analytics
      trackInitiateBooking(newEscrow.tripId, newEscrow.seats || 1);
    },
    [currentUser, setActiveTab, setSelectedItemForEscrow, showToast, t]
  );

  const handleConfirmCancel = useCallback(
    async (escrowId, { reason } = {}) => {
      setBookedEscrows((prev) =>
        prev.map((e) => (e.escrowId === escrowId ? { ...e, status: 'cancelled', cancelReason: reason } : e))
      );
      setCancelRecord?.(null);
      showToast(t?.('toast.cancelEarly') || 'Đã hủy kết nối chuyến');

      try {
        await api.cancelBooking(escrowId, reason);
      } catch (err) {
        console.warn('Cancel sync to backend failed:', err);
      }
    },
    [setCancelRecord, showToast, t]
  );

  const handleConfirmedFromZaloReentry = useCallback(
    (booking) => {
      setBookedEscrows((prev) =>
        prev.map((e) =>
          e.escrowId === booking.escrowId || e.id === booking.escrowId
            ? { ...e, bothConfirmed: true, status: 'zalo_active' }
            : e
        )
      );
      setActiveTab?.('booked');
      trackDriverConfirm(booking.escrowId || booking.id, booking.tripId);
    },
    [setActiveTab]
  );

  const handleSendDelay = useCallback(
    async (escrowId, minutes, note) => {
      setBookedEscrows((prev) =>
        prev.map((e) =>
          e.escrowId === escrowId ? { ...e, status: 'delayed', delayedMinutes: minutes, delayNote: note } : e
        )
      );
      setDelayRecord?.(null);
      showToast(t?.('toast.delaySent', { n: minutes }) || `Đã báo trễ ${minutes} phút`);

      try {
        await api.reportDelay(escrowId, minutes, note);
      } catch (err) {
        console.warn('Delay sync to backend failed:', err);
      }
    },
    [setDelayRecord, showToast, t]
  );

  const handleCompleteTrip = useCallback(
    async (escrowId, record) => {
      setBookedEscrows((prev) => prev.map((e) => (e.escrowId === escrowId ? { ...e, status: 'completed' } : e)));
      showToast(t?.('toast.completed') || 'Chuyến đi đã hoàn tất!');

      const targetBooking = record || bookedEscrows.find((e) => e.escrowId === escrowId);
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
    },
    [bookedEscrows, setReviewRecord, showToast, t]
  );

  const handleSubmitReview = useCallback(
    async ({ escrowId, reviewerRole, rating, tags, comment }) => {
      try {
        await api.submitReview(escrowId, { reviewerRole, rating, tags, comment });
        setBookedEscrows((prev) =>
          prev.map((e) => {
            if (e.escrowId === escrowId) {
              const reviews = Array.isArray(e.reviews) ? e.reviews : [];
              return {
                ...e,
                reviews: [
                  ...reviews.filter((r) => r.reviewerRole !== reviewerRole),
                  { reviewerRole, rating, tags, comment, createdAt: new Date().toISOString() }
                ]
              };
            }
            return e;
          })
        );
        showToast('Đã ghi nhận đánh giá cộng đồng thành công!');
      } catch (err) {
        console.warn('Review submission error:', err);
      }
    },
    [showToast]
  );

  const handleVehicleMismatchReport = useCallback(
    async ({ bookingId, mismatchType, actualPlate, passengerNote }) => {
      try {
        const res = await api.reportVehicleMismatch(bookingId, { mismatchType, actualPlate, passengerNote });
        if (res?.success) {
          setBookedEscrows((prev) =>
            prev.map((e) => {
              if (e.escrowId === bookingId || e.id === bookingId) {
                return {
                  ...e,
                  vehicleMismatchReport: res.data
                };
              }
              return e;
            })
          );
          showToast('✓ Đã gửi báo cáo sai lệch xe! Ban Quản Trị sẽ can thiệp ngay.');
          return res.data;
        } else {
          showToast(res?.error || 'Có lỗi xảy ra khi gửi báo cáo');
        }
      } catch (err) {
        console.warn('Vehicle mismatch report error:', err);
        showToast('Lỗi mạng khi gửi báo cáo, vui lòng thử lại');
      }
    },
    [showToast]
  );

  const refreshBookings = useCallback(async () => {
    try {
      const res = await api.getBookings();
      if (res?.success && Array.isArray(res.data)) {
        setBookedEscrows(res.data);
      }
    } catch (err) {
      console.warn('[refreshBookings] Lỗi:', err);
    }
  }, []);

  const handleUnreachablePhoneReport = useCallback(
    async ({ bookingId, reason, note }) => {
      try {
        const res = await api.reportUnreachablePhone(bookingId, { reason, note });
        if (res?.success) {
          await refreshBookings();
          showToast('🚨 Đã tiếp nhận báo cáo. Hệ thống đã trừ 30 điểm tín nhiệm đối tác và huỷ chuyến an toàn cho bạn.');
          return res.data;
        } else {
          showToast(res?.error || 'Có lỗi xảy ra khi gửi báo cáo');
        }
      } catch (err) {
        console.warn('Unreachable phone report error:', err);
        showToast(err.message || 'Lỗi khi gửi báo cáo, vui lòng thử lại');
      }
    },
    [refreshBookings, showToast]
  );

  return {
    driverOffers,
    setDriverOffers,
    passengerRequests,
    setPassengerRequests,
    bookedEscrows,
    setBookedEscrows,
    refreshBookings,
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
    handleSubmitReview,
    handleVehicleMismatchReport,
    handleUnreachablePhoneReport
  };
}

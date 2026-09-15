import { useState, useEffect, useCallback } from 'react';
// Không import dữ liệu mẫu vào đây: sàn chỉ được hiển thị chuyến từ máy chủ.
// Bỏ hẳn đường import khiến dữ liệu mẫu không thể vô tình quay lại giao diện.
import { getTomorrowISO, normalizePhoneNumber, setDailyFuelPrice, setTariffParams } from '@carmate/shared';
import api from '../api/client.js';
import { trackInitiateBooking } from '../utils/analytics.js';
import { triggerMacNotification } from '../components/common/AppleMacNotification.jsx';

/**
 * Custom Hook quản lý dữ liệu chuyến đi, kết nối Zalo / Escrow và đồng bộ Backend
 */
export default function useTripsData({
  currentUser,
  updateMyTripsCount,
  setActiveTab,
  setSelectedItemForEscrow,
  setCancelRecord,
  setDelayRecord,
  setReviewRecord,
  onRequireAuth,
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
  const [bookedEscrows, setBookedEscrows] = useState(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const cached = localStorage.getItem('carmate_cached_bookings');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch {}
    return [];
  });
  const [platformStats, setPlatformStats] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // Helper đồng bộ cache bền vững vé điện tử (MIT Invariant & Zero-Blocking)
  const syncBookingsCache = useCallback((serverBookings) => {
    if (!Array.isArray(serverBookings)) return serverBookings;
    try {
      if (typeof localStorage !== 'undefined') {
        const local = JSON.parse(localStorage.getItem('carmate_cached_bookings') || '[]');
        const map = new Map();
        // Nạp dữ liệu từ server (Source of Truth)
        serverBookings.forEach((b) => {
          const id = b.escrowId || b.id;
          if (id) map.set(id, b);
        });
        // Chỉ giữ lại các booking vừa tạo cục bộ lạc quan dưới 60s chưa kịp lên server
        const now = Date.now();
        local.forEach((b) => {
          const id = b.escrowId || b.id;
          const createdAtMs = typeof b.createdAt === 'number' ? b.createdAt : new Date(b.createdAt || 0).getTime();
          const isVeryRecent = b._isLocalOptimistic || (now - createdAtMs < 60000 && !b.escrowId?.startsWith('ESC-SAMPLE'));
          if (id && !map.has(id) && isVeryRecent) {
            map.set(id, b);
          }
        });
        const merged = Array.from(map.values());
        localStorage.setItem('carmate_cached_bookings', JSON.stringify(merged.slice(0, 50)));
        return merged;
      }
    } catch {}
    return serverBookings;
  }, []);

  // Đồng bộ dữ liệu từ CarMate Backend API
  useEffect(() => {
    let active = true;
    async function fetchBackendData() {
      try {
        const phoneParam = currentUser?.phone ? { phone: currentUser.phone } : {};
        const [tripsRes, bookingsRes, statsRes, fuelRes, tariffRes] = await Promise.allSettled([
          api.getTrips(),
          api.getBookings(phoneParam),
          api.getStats(),
          api.getFuelPrice(),
          api.getTariffParams()
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
            const merged = syncBookingsCache(bookings);
            setBookedEscrows(merged || bookings);
          }
        }

        if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
          setPlatformStats(statsRes.value.data);
        }

        if (fuelRes.status === 'fulfilled' && fuelRes.value?.success && fuelRes.value.data) {
          const fuel = fuelRes.value.data;
          if (fuel.ron95Price) {
            setDailyFuelPrice(fuel.ron95Price, fuel.updatedAt, fuel.updatedBy, fuel.source);
          }
        }

        // Đồng bộ tham số công thức định giá: engine là biến cấp module nên mỗi
        // tiến trình giữ bản riêng. Không kéo về, giá hiện trên máy Chủ xe sẽ
        // lệch với giá máy chủ dùng để tạo chuyến.
        if (tariffRes.status === 'fulfilled' && tariffRes.value?.success && tariffRes.value.data) {
          try {
            const cfg = tariffRes.value.data;
            if (!cfg.isDefault) {
              setTariffParams(cfg, cfg.updatedAt, cfg.updatedBy || 'admin', 'server');
            }
          } catch (tariffErr) {
            console.warn('[CarMate App] Tariff sync warning:', tariffErr);
          }
        }
      } catch (err) {
        console.warn('[CarMate App] API sync warning:', err);
      }
    }

    fetchBackendData();
    return () => {
      active = false;
    };
    // Cố ý chỉ chạy MỘT LẦN khi mount: đây là cú nạp dữ liệu khởi động.
    // Thêm currentUser.phone / syncBookingsCache vào deps sẽ khiến effect chạy lại
    // mỗi lần các giá trị đó đổi tham chiếu -> gọi API lặp vô hạn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // Cache a server-confirmed trip; this function never creates a second copy.
  const recordPostedTrip = useCallback((trip, owner = currentUser) => {
    if (!trip?.id) return;
    const update = (prev) => [trip, ...prev.filter((item) => item.id !== trip.id)];
    if (trip.type === 'driver_offer') setDriverOffers(update);
    else setPassengerRequests(update);
    try {
      const key = `carmate_my_trip_ids_${owner?.id || owner?.phone}`;
      const previous = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify([...new Set([trip.id, ...previous])]));
    } catch {}
    updateMyTripsCount?.(owner);
  }, [currentUser, updateMyTripsCount]);

  const handlePostTrip = useCallback(async (newTrip, authUser = currentUser) => {
    const publish = async (user) => {
      const payload = { ...newTrip, userId: user.id, phoneReal: newTrip.phoneReal || user.phone };
      try {
        const res = await api.createTrip(payload);
        if (!res?.success || !res?.data?.id) throw new Error(res?.error || 'Chuyến chưa được đăng.');
        recordPostedTrip(res.data, user);
        showToast('Đã đăng chuyến thành công.');
        setActiveTab?.('market');
        return res.data;
      } catch (err) {
        showToast(err.message || 'Không thể đăng chuyến. Vui lòng thử lại.');
        return null;
      }
    };
    if (!authUser) {
      onRequireAuth?.({
        title: 'Đăng nhập để đăng chuyến',
        subtitle: 'Thông tin chuyến được giữ nguyên để bạn tiếp tục.',
        onSuccess: publish
      });
      return null;
    }
    return publish(authUser);
  }, [currentUser, onRequireAuth, recordPostedTrip, showToast, setActiveTab]);

  const handleEditTrip = useCallback(async (tripId, updates) => {
    const response = await api.updateTrip(tripId, updates);
    if (!response?.success || !response.data) throw new Error(response?.error || 'Chưa lưu được thay đổi.');
    const saved = response.data;
    setDriverOffers((prev) => prev.map((trip) => trip.id === tripId ? saved : trip));
    setPassengerRequests((prev) => prev.map((trip) => trip.id === tripId ? saved : trip));
    // A trip edit must succeed before optional garage details are synchronized.
    if (onSaveProfile && currentUser && (updates.carType || updates.carPhotos || updates.capacity || updates.licensePlate)) {
      const words = String(saved.carType || '').trim().split(/\s+/);
      try {
        await onSaveProfile({ vehicle: { ...(currentUser.vehicle || {}),
          brand: words[0] || currentUser.vehicle?.brand || '',
          model: words.slice(1).join(' ') || currentUser.vehicle?.model || '',
          capacity: saved.capacity,
          plate: saved.licensePlate || currentUser.vehicle?.plate || '',
          photos: saved.carPhotos || currentUser.vehicle?.photos || []
        } });
      } catch { showToast('Chuyến đã lưu; thông tin xe trong hồ sơ chưa đồng bộ.'); }
    }
    showToast('Đã lưu thay đổi thông tin chuyến xe.');
    return saved;
  }, [showToast, onSaveProfile, currentUser]);

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
      // Giữ bản sao để khôi phục nếu máy chủ không xóa được: một chuyến chỉ biến mất
      // khỏi máy người đăng nhưng vẫn hiển thị trên sàn là tình huống nguy hiểm nhất
      // (khách vẫn đặt chỗ vào chuyến mà chủ xe tin rằng đã hủy).
      const removedDriverTrip = (driverOffers || []).find((t) => t.id === tripId);
      const removedPassengerTrip = (passengerRequests || []).find((t) => t.id === tripId);

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
      try {
        await api.deleteTrip(tripId);
        showToast('Đã xóa bài đăng chuyến đi thành công.');
      } catch (err) {
        console.warn('Lỗi xóa chuyến đi:', err);
        // Khôi phục lại bài đăng và danh sách id cục bộ: chuyến vẫn còn trên máy chủ
        if (removedDriverTrip) {
          setDriverOffers((prev) => (prev.some((t) => t.id === tripId) ? prev : [removedDriverTrip, ...prev]));
        }
        if (removedPassengerTrip) {
          setPassengerRequests((prev) => (prev.some((t) => t.id === tripId) ? prev : [removedPassengerTrip, ...prev]));
        }
        try {
          const storageKey = currentUser
            ? `carmate_my_trip_ids_${currentUser.id || currentUser.phone}`
            : 'carmate_guest_trip_ids';
          const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
          if (!stored.includes(tripId)) {
            localStorage.setItem(storageKey, JSON.stringify([...stored, tripId]));
          }
          updateMyTripsCount?.(currentUser);
        } catch {}
        showToast('Chưa xóa được bài đăng trên máy chủ. Chuyến xe vẫn đang hiển thị, vui lòng thử lại.');
        throw err;
      }
    },
    [currentUser, showToast, updateMyTripsCount, driverOffers, passengerRequests]
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

  const refreshBookings = useCallback(async (params = {}) => {
    try {
      const phoneParam = params?.phone || currentUser?.phone || '';
      const res = await api.getBookings(phoneParam ? { phone: phoneParam } : {});
      if (res?.success && Array.isArray(res.data)) {
        const merged = syncBookingsCache(res.data);
        setBookedEscrows(merged || res.data);
      }
    } catch (err) {
      console.warn('[refreshBookings] Lỗi:', err);
    }
  }, [currentUser, syncBookingsCache]);

  // Tiếp nhận booking tạo mới tức thì từ giao diện (Zero-Blocking & MIT Invariant)
  const handleBookingCreated = useCallback((newBooking) => {
    if (!newBooking) return;
    setBookedEscrows((prev) => {
      const bId = newBooking.escrowId || newBooking.id;
      const filtered = (prev || []).filter((b) => (b.escrowId || b.id) !== bId);
      const updated = [newBooking, ...filtered];
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('carmate_cached_bookings', JSON.stringify(updated.slice(0, 50)));
        }
      } catch {}
      return updated;
    });
    // Kích hoạt đồng bộ ngầm
    refreshBookings();
  }, [refreshBookings]);

  // Polling đồng bộ ngầm & Bắn thông báo In-app (AppleMacNotification) cho Chủ xe khi có khách đặt
  useEffect(() => {
    const knownIds = new Set(bookedEscrows.map((b) => b.escrowId || b.id));

    const pollInterval = setInterval(async () => {
      try {
        const phoneParam = currentUser?.phone ? { phone: currentUser.phone } : {};
        const res = await api.getBookings(phoneParam);
        if (res?.success && Array.isArray(res.data)) {
          const newBookings = res.data;
          const userPhone = currentUser?.phone ? normalizePhoneNumber(currentUser.phone) : '';
          const userId = currentUser?.id || currentUser?.userId || '';

          newBookings.forEach((b) => {
            const bId = b.escrowId || b.id;
            if (!knownIds.has(bId)) {
              knownIds.add(bId);
              // Kiểm tra xem người đăng nhập hiện tại có phải Chủ xe nhận yêu cầu không:
              const bDriverPhone = b.driverPhone ? normalizePhoneNumber(b.driverPhone) : '';
              const isTargetDriver = (userPhone && bDriverPhone && userPhone === bDriverPhone) ||
                                     (userId && b.driverId && userId === b.driverId);

              if (isTargetDriver && b.status === 'inquiring') {
                triggerMacNotification({
                  title: '🚗 Yêu cầu ghép chuyến mới!',
                  message: `${b.contactName || 'Người đi cùng'} muốn ghép ${b.seats || 1} ghế tuyến ${b.from} ➔ ${b.to}`,
                  type: 'trip',
                  bookingId: bId,
                  partnerName: b.contactName || 'Người đi cùng',
                  actionLabel: 'Mở Chat Ngay'
                });
                showToast?.(`🔔 Bạn có yêu cầu ghép chuyến mới từ ${b.contactName || 'Người đi cùng'}`);
              }
            }
          });

          const merged = syncBookingsCache(newBookings);
          setBookedEscrows(merged || newBookings);
        }
      } catch {
        // Bỏ qua lỗi ngầm nếu mất mạng thoáng qua
      }
    }, 6000);

    return () => clearInterval(pollInterval);
  }, [currentUser, showToast, bookedEscrows, syncBookingsCache]);

  return {
    driverOffers,
    setDriverOffers,
    passengerRequests,
    setPassengerRequests,
    bookedEscrows,
    setBookedEscrows,
    handleBookingCreated,
    refreshBookings,
    platformStats,
    setPlatformStats,
    toastMessage,
    showToast,
    handleRePublishTrip,
    handlePostTrip,
    recordPostedTrip,
    handleEditTrip,
    handleToggleTripStatus,
    handleDeleteTrip,
    handleConfirmBooking,
    handleConfirmCancel,
    handleSendDelay,
    handleCompleteTrip,
    handleSubmitReview
  };
}

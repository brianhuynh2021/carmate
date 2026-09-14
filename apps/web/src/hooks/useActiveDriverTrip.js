import { useState, useCallback } from 'react';
import { cleanPhoneNumber } from '@carmate/shared';
import api from '../api/client.js';

/**
 * Custom Hook: useActiveDriverTrip
 * Tải chuyến xe đang mở nhận khách của Chủ xe.
 *
 * Logic này trước đây bị chép nguyên văn ở cả CockpitMode và DriverScheduleCardView
 * (giống nhau từng ký tự, chỉ khác nhãn log), nên sửa một nơi là quên nơi kia.
 *
 * @param {string} driverPhone - SĐT Chủ xe dùng để đối chiếu chuyến
 * @param {string} logTag - Nhãn hiển thị khi ghi cảnh báo
 */
export default function useActiveDriverTrip(driverPhone, logTag = 'ActiveDriverTrip') {
  const [activeDriverTrip, setActiveDriverTrip] = useState(null);
  const [isLoadingActiveTrip, setIsLoadingActiveTrip] = useState(false);

  const reloadActiveTrip = useCallback(async () => {
    setIsLoadingActiveTrip(true);
    try {
      const clean = driverPhone ? cleanPhoneNumber(driverPhone) : '';
      const res = await api.getTrips({ type: 'drivers' });
      const allDriverTrips = res?.data?.driverOffers || res?.data?.all || [];

      let storedTripId = null;
      try {
        const storedIds = JSON.parse(
          localStorage.getItem(`carmate_my_trip_ids_${clean}`) ||
          localStorage.getItem('carmate_my_trip_ids') ||
          '[]'
        );
        if (storedIds.length > 0) storedTripId = storedIds[0];
      } catch {}

      const myActiveTrip = allDriverTrips.find((t) => {
        if (t.status === 'cancelled' || t.status === 'completed') return false;
        if (storedTripId && t.id === storedTripId) return true;
        const pReal = cleanPhoneNumber(t.phoneReal || t.phone || '');
        if (clean && pReal === clean) return true;
        return false;
      });

      if (myActiveTrip) {
        try {
          const detailRes = await api.getTrip(myActiveTrip.id);
          setActiveDriverTrip(detailRes?.data || myActiveTrip);
        } catch {
          setActiveDriverTrip(myActiveTrip);
        }
      } else {
        setActiveDriverTrip(null);
      }
    } catch (err) {
      console.warn(`[${logTag}] Load active trip error:`, err);
    } finally {
      setIsLoadingActiveTrip(false);
    }
  }, [driverPhone, logTag]);

  return {
    activeDriverTrip,
    setActiveDriverTrip,
    isLoadingActiveTrip,
    reloadActiveTrip
  };
}

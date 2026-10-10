import { useState, useCallback } from 'react';
import { cleanPhoneNumber } from '@carmate/shared';
import api from '../api/client.js';

/**
 * Custom Hook: useActiveDriverTrip
 * Loads the driver's trip that is currently open for passengers.
 *
 * This logic used to be copied verbatim in both CockpitMode and DriverScheduleCardView
 * (identical character for character, differing only in the log label), so fixing one place meant forgetting the other.
 *
 * @param {string} driverPhone - Driver phone number used to match the trip
 * @param {string} logTag - Label shown when logging a warning
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

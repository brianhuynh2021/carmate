import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/client.js';
import { ownedDriverTrips } from '../utils/driverOperations.js';

export default function useOwnedDriverTrips(currentUser) {
  const userId = currentUser?.id;
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const requestId = ++generation.current;
    if (!userId) { setTrips([]); setLoading(false); setError(''); return; }
    setLoading(true);
    try {
      const response = await api.getTrips({ type: 'drivers', mine: 1, includeExpired: true, limit: 100 });
      if (!response?.success) throw new Error(response?.error || 'Không tải được chuyến của bạn.');
      const own = ownedDriverTrips(response.data?.driverOffers || response.data?.all, userId);
      const details = await Promise.allSettled(own.map((trip) => api.getTrip(trip.id)));
      if (requestId !== generation.current) return;
      const failed = details.some((result) => result.status === 'rejected' || !result.value?.success);
      setTrips(own.map((trip, index) => details[index].status === 'fulfilled' && details[index].value?.success
        ? details[index].value.data : trip));
      setError(failed ? 'Một số chi tiết chuyến chưa tải được. Hãy làm mới trước khi thao tác.' : '');
    } catch (err) {
      if (requestId === generation.current) setError(err.message || 'Không tải được chuyến của bạn.');
    } finally {
      if (requestId === generation.current) setLoading(false);
    }
  }, [userId]);
  useEffect(() => { setTrips([]); reload(); return () => { generation.current += 1; }; }, [reload]);
  return { trips, loading, error, reload };
}

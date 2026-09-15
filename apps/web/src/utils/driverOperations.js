export function ownedDriverTrips(rows, userId) {
  if (!userId) return [];
  return (Array.isArray(rows) ? rows : []).filter((trip) =>
    trip.type === 'driver_offer' &&
    [trip.userId, trip.creatorId].some((id) => id != null && String(id) === String(userId)) &&
    !trip.isHidden && !trip.isBanned && !['cancelled', 'completed', 'closed', 'expired'].includes(trip.status)
  );
}

export function currentManifest(rows) {
  return (Array.isArray(rows) ? rows : []).filter((rider) =>
    ['OFFERED', 'ARRIVING', 'BOARDED'].includes(rider.status)
  );
}

export function realPositionPayload(tripId, position, now = Date.now()) {
  const { latitude, longitude, speed, heading } = position?.coords || {};
  if (!tripId || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
      !Number.isFinite(position.timestamp) || now - position.timestamp > 15000 || position.timestamp > now + 5000) {
    throw new Error('Chưa nhận được vị trí GPS mới. Vui lòng thử lại.');
  }
  return { tripId, lat: latitude, lng: longitude,
    speed: Number.isFinite(speed) ? Math.max(0, speed * 3.6) : 0,
    heading: Number.isFinite(heading) ? heading : null };
}

export function confirmedTripManifest(trip) {
  return (Array.isArray(trip?.manifest) ? trip.manifest : []).filter((rider) =>
    rider.bothConfirmed === true && !['cancelled', 'completed', 'expired'].includes(rider.status)
  );
}

export function formatAppointmentTime(value) {
  if (!value) return 'Chưa xác định';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
    : 'Chưa xác định';
}

export function pointLabel(point) {
  return typeof point === 'string' ? point : point?.name || point?.address || 'Chưa xác định';
}

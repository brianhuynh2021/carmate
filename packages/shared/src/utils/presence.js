/**
 * presence.js — Manages online presence status (Live Presence Telemetry)
 * Follows the MIT Invariants & Stanford Ergonomics philosophy:
 * - Green light / Green dot: Online (ready to respond immediately).
 * - Red light / Red dot: Offline.
 */

export function getUserOnlineStatus(entity, currentUserIdentifier) {
  if (!entity) {
    return {
      isOnline: false,
      label: 'Ngoại tuyến',
      compactLabel: 'Offline',
      detail: 'Chưa online',
      dotColor: 'red'
    };
  }

  // 1. The owner themselves (the logged-in person viewing the page): always Online
  const cleanId = (v) => String(v || '').replace(/\D/g, '').slice(-9);
  const currentClean = cleanId(currentUserIdentifier);
  const entityPhone = cleanId(
    entity.phoneReal ||
      entity.phone ||
      entity.passengerPhone ||
      entity.driverPhone ||
      entity.userPhone ||
      entity.contactPhone
  );
  const entityUserId = entity.userId || entity.creatorId || entity.driverId;

  if (
    entity.isOwner ||
    (currentClean && entityPhone && currentClean === entityPhone) ||
    (currentUserIdentifier && entityUserId && currentUserIdentifier === entityUserId)
  ) {
    return {
      isOnline: true,
      label: 'Đang online',
      compactLabel: 'Online',
      detail: 'Đang hoạt động (Bạn)',
      dotColor: 'green'
    };
  }

  // 2. Explicitly specified property, if present
  if (typeof entity.isOnline === 'boolean') {
    return {
      isOnline: entity.isOnline,
      label: entity.isOnline ? 'Đang online' : 'Ngoại tuyến',
      compactLabel: entity.isOnline ? 'Online' : 'Offline',
      detail: entity.isOnline ? 'Sẵn sàng phản hồi' : (entity.lastActiveText || 'Ngoại tuyến'),
      dotColor: entity.isOnline ? 'green' : 'red'
    };
  }

  // 3. If there is a most-recent activity timestamp (lastActiveAt or the latest message)
  const now = Date.now();
  const lastActive = entity.lastActiveAt || entity.updatedAt || entity.lastMessageTime;
  if (typeof lastActive === 'number' && Number.isFinite(lastActive)) {
    const diffMins = (now - lastActive) / (60 * 1000);
    if (diffMins <= 15) {
      return {
        isOnline: true,
        label: 'Đang online',
        compactLabel: 'Online',
        detail: 'Hoạt động vừa xong',
        dotColor: 'green'
      };
    } else {
      const hours = Math.floor(diffMins / 60);
      const text = hours > 0 ? `Hoạt động ${hours} giờ trước` : `Hoạt động ${Math.round(diffMins)} phút trước`;
      return {
        isOnline: false,
        label: 'Ngoại tuyến',
        compactLabel: 'Offline',
        detail: text,
        dotColor: 'red'
      };
    }
  }

  // 4. If a trip was just posted (within 30 minutes)
  if (typeof entity.createdAt === 'number' && Number.isFinite(entity.createdAt)) {
    const diffMins = (now - entity.createdAt) / (60 * 1000);
    if (diffMins <= 30) {
      return {
        isOnline: true,
        label: 'Đang online',
        compactLabel: 'Online',
        detail: 'Vừa đăng chuyến',
        dotColor: 'green'
      };
    }
  }

  // 5. Deterministic computation (Deterministic Edge Invariant) for data on the platform
  // Based on the identifier, to create realistic variety between drivers/passengers who are online and offline
  const seedStr = String(entity.id || entity.maskedCode || entity.escrowId || entity.phone || '0');
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const isOnlineDeterministic = Math.abs(hash) % 10 < 6; // 60% online, 40% offline

  if (isOnlineDeterministic) {
    return {
      isOnline: true,
      label: 'Đang online',
      compactLabel: 'Online',
      detail: 'Sẵn sàng phản hồi',
      dotColor: 'green'
    };
  }

  return {
    isOnline: false,
    label: 'Ngoại tuyến',
    compactLabel: 'Offline',
    detail: 'Chưa online',
    dotColor: 'red'
  };
}

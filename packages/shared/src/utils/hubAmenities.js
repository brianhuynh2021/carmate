/**
 * =============================================================================
 * HUMANIZING VIRTUAL STATIONS (HUMANIZED MEETING POINTS)
 * =============================================================================
 * Meeting-point math only pays off when passengers feel SAFE and can EASILY RECOGNIZE
 * the place. A red pin in the middle of QL13 at 4 a.m. is a source of fear, not a pickup point.
 *
 * Amenities are DERIVED from the station's `category` instead of being typed by hand into 26 stations: a
 * single source of truth, so a new station automatically gets the right kind of amenities, and nobody
 * has to remember to update two places.
 *
 * Only list amenities that are TRUE BY THE NATURE of the place type — a gas station certainly
 * has a roof and lights, but "camera an ninh" (security camera) cannot be claimed for every
 * gas station. Better to say less and be right.
 */

/** Amenities that matter to someone waiting for a ride at the roadside of a highway. */
const AMENITY_TYPES = Object.freeze({
  SHELTER: { id: 'SHELTER', icon: '🏠', label: 'Có mái che' },
  LIGHTING: { id: 'LIGHTING', icon: '💡', label: 'Đèn sáng ban đêm' },
  RESTROOM: { id: 'RESTROOM', icon: '🚻', label: 'Có nhà vệ sinh' },
  DRINKS: { id: 'DRINKS', icon: '🥤', label: 'Có nước uống / tạp hoá' },
  SECURITY: { id: 'SECURITY', icon: '📹', label: 'Có bảo vệ / camera' },
  PARKING: { id: 'PARKING', icon: '🅿️', label: 'Xe tấp vào an toàn' },
  OPEN_24H: { id: 'OPEN_24H', icon: '🕐', label: 'Mở cửa 24/7' },
  CROWDED: { id: 'CROWDED', icon: '👥', label: 'Đông người qua lại' }
});

const A = AMENITY_TYPES;

/** Map of place type -> amenities that are certain to be present. */
const CATEGORY_AMENITIES = Object.freeze({
  GAS_STATION: [A.SHELTER, A.LIGHTING, A.RESTROOM, A.DRINKS, A.PARKING, A.OPEN_24H],
  AIRPORT: [A.SHELTER, A.LIGHTING, A.RESTROOM, A.DRINKS, A.SECURITY, A.OPEN_24H, A.CROWDED],
  MALL: [A.SHELTER, A.LIGHTING, A.RESTROOM, A.DRINKS, A.SECURITY, A.PARKING],
  ADMIN_CENTER: [A.SHELTER, A.LIGHTING, A.SECURITY, A.PARKING],
  INDUSTRIAL: [A.LIGHTING, A.PARKING, A.CROWDED],
  JUNCTION: [A.LIGHTING, A.CROWDED],
  URBAN_AREA: [A.LIGHTING, A.DRINKS, A.CROWDED]
});

/** One-sentence description of how safe it is to wait there, used right below the station name. */
const CATEGORY_SAFETY_NOTE = Object.freeze({
  GAS_STATION: 'Đứng trong sân cây xăng, có mái che và đèn sáng suốt đêm.',
  AIRPORT: 'Khu vực sân bay đông người và có an ninh thường trực.',
  MALL: 'Đứng trong khuôn viên trung tâm thương mại, có bảo vệ.',
  ADMIN_CENTER: 'Khuôn viên cơ quan hành chính, có bảo vệ và chỗ ngồi chờ.',
  INDUSTRIAL: 'Khu công nghiệp đông công nhân qua lại vào giờ ca.',
  JUNCTION: 'Nút giao đông xe — đứng lùi khỏi lòng đường, phía trong lề.',
  URBAN_AREA: 'Khu dân cư đông đúc, dễ tìm chỗ đứng chờ an toàn.'
});

/**
 * Get the list of amenities of a station.
 * @param {object} hub - An element of VIRTUAL_HUBS
 * @returns {Array<{id, icon, label}>}
 */
export function getHubAmenities(hub) {
  if (!hub) return [];
  // A station may override this with its own declaration if a field survey gives different results
  if (Array.isArray(hub.amenities) && hub.amenities.length > 0) {
    return hub.amenities
      .map((id) => AMENITY_TYPES[id])
      .filter(Boolean);
  }
  return CATEGORY_AMENITIES[hub.category] || [A.LIGHTING];
}

/** Short safety description sentence for a station. */
function getHubSafetyNote(hub) {
  if (!hub) return '';
  if (hub.safetyNote) return hub.safetyNote;
  return CATEGORY_SAFETY_NOTE[hub.category] || 'Đứng phía trong lề đường, tránh xa lòng đường.';
}

/**
 * Full "humanization" info bundle of a station to return to the UI.
 * `landmark` is what passengers use to find the right place to stand — more important than GPS coordinates.
 */
export function describeHub(hub) {
  if (!hub) return null;
  return {
    id: hub.id,
    name: hub.name,
    shortName: hub.shortName || hub.name,
    landmark: hub.landmark || null,
    category: hub.category || null,
    amenities: getHubAmenities(hub),
    safetyNote: getHubSafetyNote(hub),
    curbsideWindowSeconds: hub.curbsideWindowSeconds || 300
  };
}

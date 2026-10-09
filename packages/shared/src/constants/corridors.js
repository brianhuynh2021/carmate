/**
 * corridors.js — CORRIDOR REGISTRY
 *
 * SCALE INVARIANT: The UI must ABSOLUTELY NOT know what "QL13" is.
 *
 * Previously the homepage hard-branched on TO_SAIGON / TO_BINH_PHUOC in 19 places,
 * so adding a third route meant editing all 19 branches and every accompanying
 * display string. Now each corridor is just ONE object declared here; the UI reads
 * from the registry and builds itself. Adding a new route = adding one object, 0 lines of UI code.
 *
 * Each corridor has exactly two endpoints (endpoint A and B). "Heading" is just the question of
 * which endpoint you are travelling from and to — there is no longer a "to Sài Gòn" notion
 * hard-wired into the source code.
 */

import { VIRTUAL_HUBS } from './routes.js';

export const CORRIDORS = [
  {
    id: 'ql13',
    // Matches the `corridor` field in VIRTUAL_HUBS
    dataKey: 'Tuyến QL13',
    shortName: 'QL13',
    name: 'Hành lang Quốc lộ 13',
    isDefault: true,
    status: 'live',
    endpoints: {
      // Endpoint A: the urban cluster (destination of the "up to the city" heading)
      a: {
        id: 'saigon',
        label: 'Sài Gòn',
        fullLabel: 'TP. Hồ Chí Minh',
        hubIds: [
          'hub_ql13_cho_ray',
          'hub_ql13_hang_xanh',
          'hub_ql13_san_bay_tsn',
          'hub_ql13_binh_trieu',
          'hub_ql13_van_phuc_city',
          'hub_ql13_nga4_binh_phuoc'
        ]
      },
      // Endpoint B: the provincial cluster (origin of the "up to the city" heading)
      b: {
        id: 'binhphuoc',
        label: 'Bình Phước',
        fullLabel: 'Bình Phước & Bình Dương',
        hubIds: null // null = all remaining hubs of the corridor
      }
    }
  },
  {
    id: 'n2',
    dataKey: 'Tuyến N2 - Kiên Giang',
    shortName: 'N2',
    name: 'Hành lang N2 - Miền Tây',
    isDefault: false,
    status: 'draft',
    endpoints: {
      a: {
        id: 'saigon',
        label: 'Sài Gòn',
        fullLabel: 'TP. Hồ Chí Minh',
        hubIds: null // derived from latitude: the northern cluster of the corridor
      },
      b: {
        id: 'kiengiang',
        label: 'Kiên Giang',
        fullLabel: 'Kiên Giang & Miền Tây',
        hubIds: null
      }
    }
  }
];

/** Gets all corridors currently in service (only live routes that are actually running). */
export function getActiveCorridors() {
  return CORRIDORS.filter((c) => c.status === 'live');
}

function getCorridorById(id) {
  return CORRIDORS.find((c) => c.id === id) || null;
}

export function getDefaultCorridor() {
  return CORRIDORS.find((c) => c.isDefault) || CORRIDORS[0];
}

/** All virtual hubs belonging to a corridor. */
function getCorridorHubs(corridorId) {
  const c = getCorridorById(corridorId);
  if (!c) return [];
  return VIRTUAL_HUBS.filter((h) => h.corridor === c.dataKey);
}

/**
 * Assigns the corridor's stations to the two endpoints A / B.
 *
 * An explicitly declared hubIds list takes priority; otherwise infer from
 * latitude (endpoint A is always the cluster closer to the southern end for QL13, so the median
 * is used as the split point — this works for any corridor running along a North-South axis
 * without having to list each station by hand).
 */
export function getEndpointHubs(corridorId, endpointKey, heading = null) {
  const c = getCorridorById(corridorId);
  if (!c) return [];

  const hubs = getCorridorHubs(corridorId);
  const ep = c.endpoints[endpointKey];
  if (!ep) return [];

  let result = [];
  if (Array.isArray(ep.hubIds)) {
    result = hubs.filter((h) => ep.hubIds.includes(h.id));
  } else {
    // Infer from latitude: endpoint A = the half closer to the city (lower latitude for QL13).
    const other = endpointKey === 'a' ? 'b' : 'a';
    const otherIds = c.endpoints[other]?.hubIds;
    if (Array.isArray(otherIds)) {
      result = hubs.filter((h) => !otherIds.includes(h.id));
    } else {
      const lats = hubs.map((h) => h.lat).sort((x, y) => x - y);
      const median = lats[Math.floor(lats.length / 2)];
      result = endpointKey === 'a' ? hubs.filter((h) => h.lat < median) : hubs.filter((h) => h.lat >= median);
    }
  }

  // Order the stations sensibly along the route direction (Stanford Ergonomics & MIT Invariants):
  // The QL13 route runs along the North-South axis (Endpoint B = Bình Phước in the North, Endpoint A = Sài Gòn in the South).
  // - If it is endpoint B (Bình Phước):
  //   + When heading === 'a_to_b' (Sài Gòn to Bình Phước): the vehicle runs from South to North, dropping passengers from Lái Thiêu on toward Bù Đốp (lat ascending).
  //   + When heading === 'b_to_a' or by default (Bình Phước to Sài Gòn): the vehicle picks passengers up from the start of the route at Bù Đốp on toward Lái Thiêu (lat descending).
  if (endpointKey === 'b') {
    if (heading === 'a_to_b') {
      result = [...result].sort((h1, h2) => (h1.lat || 0) - (h2.lat || 0));
    } else {
      result = [...result].sort((h1, h2) => (h2.lat || 0) - (h1.lat || 0));
    }
  }

  return result;
}

/** The opposite heading. */
export function flipHeading(heading) {
  return heading === 'a_to_b' ? 'b_to_a' : 'a_to_b';
}

/** Finds the corridor that best matches a GPS coordinate (used to auto-select the route). */
export function detectCorridorByCoords(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return getDefaultCorridor();

  let best = null;
  let bestDist = Infinity;
  for (const c of getActiveCorridors()) {
    for (const h of getCorridorHubs(c.id)) {
      const d = (h.lat - lat) ** 2 + (h.lng - lng) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
  }
  return best || getDefaultCorridor();
}

/** Determines which endpoint of the corridor a hub belongs to. */
export function getHubEndpoint(corridorId, hubId) {
  if (getEndpointHubs(corridorId, 'a').some((h) => h.id === hubId)) return 'a';
  if (getEndpointHubs(corridorId, 'b').some((h) => h.id === hubId)) return 'b';
  return null;
}

/**
 * Native Intent Understanding Engine (Native Intent Engine — Zero-LLM, <1ms).
 *
 * Completely replaces the `prompt.includes('giá')` chain in the old agent with a
 * weighted classifier + real entity extraction (slot filling).
 *
 * The classic pre-LLM-era NLU architecture, yet still the right choice here:
 *  - Deterministic: the same input always gives the same output, 100% testable.
 *  - No hallucination: never invents place names or numbers that are not in the data.
 *  - Runs offline, 0đ, <1ms, no API key needed, leaks no personal data outside.
 *
 * Method:
 *  1. Vietnamese normalization (diacritics folding, abbreviation expansion) — vietnameseText.js
 *  2. Intent scoring by weighted keywords + n-grams (condensed naive-Bayes)
 *  3. Entity extraction: origin/destination (fuzzy matching against real hubs), time, seats, amenities
 *  4. Return a confidence so that the upper layer can decide whether it needs to ask again
 */

import { VIRTUAL_HUBS, ROUTE_BENCHMARKS } from '../constants/routes.js';
import { mapTimeToSlot } from '../constants/timeSlots.js';
import { PROVINCE_COORDINATES } from './geo.js';
import { expandColloquial, tokenize, similarity, findBestSpan, normalizeForMatch } from './vietnameseText.js';

// ── INTENT DEFINITIONS & WEIGHTED KEYWORDS ──
// The weight reflects the discriminating power of the keyword:
//   3 = strong feature (almost only appears in this intent)
//   2 = medium feature
//   1 = weak hint, needs to be combined
export const INTENTS = Object.freeze({
  FIND_TRIP: 'find_trip',
  ASK_PRICE: 'ask_price',
  CHECK_TRUST: 'check_trust',
  POST_TRIP: 'post_trip',
  CANCEL_TRIP: 'cancel_trip',
  TRIP_STATUS: 'trip_status',
  ASK_POLICY: 'ask_policy',
  GREETING: 'greeting',
  UNKNOWN: 'unknown'
});

const INTENT_LEXICON = Object.freeze({
  [INTENTS.FIND_TRIP]: {
    3: ['tim xe', 'co xe nao', 'con ghe', 'con cho', 'di ghep', 'ghep xe', 'can di', 'xin chuyen', 'bat xe'],
    2: ['di tu', 've', 'den', 'chuyen', 'ghe trong', 'cho trong', 'xe di', 'ai di', 'tien duong', 'qua giang'],
    1: ['di', 'xe', 'ghe', 'cho', 'sang', 'xuong', 'len', 'mai', 'hom nay', 'chieu', 'sang som']
  },
  [INTENTS.ASK_PRICE]: {
    3: ['bao nhieu tien', 'gia bao nhieu', 'het bao nhieu', 'nhieu tien', 'chi phi', 'phu xang bao nhieu'],
    2: ['gia', 'tien', 'xang', 'cau duong', 'bot', 'phi', 'cuoc', 'dinh muc', 'tham khao'],
    1: ['bao nhieu', 're', 'dat', 'mac']
  },
  [INTENTS.CHECK_TRUST]: {
    3: ['co uy tin', 'co an toan', 'tin duoc', 'diem tin nhiem', 'ho so tai xe', 'co that khong'],
    2: ['uy tin', 'tin nhiem', 'an toan', 'trust', 'danh gia', 'review', 'cccd', 'gplx', 'xac thuc'],
    1: ['tin', 'that', 'lua', 'scam']
  },
  [INTENTS.POST_TRIP]: {
    3: ['dang chuyen', 'dang xe', 'toi co xe', 'minh co xe', 'du ghe', 'con ghe trong ban', 'nhan khach'],
    2: ['dang bai', 'cho khach', 'chay tuyen', 'xe toi', 'tai xe dang'],
    1: ['dang', 'nhan']
  },
  [INTENTS.CANCEL_TRIP]: {
    3: ['huy chuyen', 'huy ghe', 'khong di nua', 'bo chuyen', 'huy dat'],
    2: ['huy', 'doi lich', 'doi gio', 'khong di'],
    1: ['thoi']
  },
  [INTENTS.TRIP_STATUS]: {
    3: ['chuyen cua toi', 've toi dau', 'toi dau roi', 'xe toi chua', 'sap toi chua', 'bao lau nua'],
    2: ['trang thai', 'tinh hinh', 'da dat', 've toi', 'den chua', 'dang o dau'],
    1: ['dau', 'chua', 'sap']
  },
  [INTENTS.ASK_POLICY]: {
    3: ['co mat phi khong', 'co ton phi', 'quy dinh the nao', 'chinh sach', 'cach hoat dong', 'lam sao de'],
    2: ['phi san', 'chiet khau', 'hoa hong', 'quy dinh', 'huong dan', 'the nao', 'cach dung'],
    1: ['sao', 'gi', 'the']
  },
  [INTENTS.GREETING]: {
    3: ['xin chao', 'chao ban', 'alo', 'hello', 'hi ban'],
    2: ['chao', 'hi', 'hey'],
    1: []
  }
});

// Amenities / trip constraints — extracted as boolean slots.
const PERK_PATTERNS = Object.freeze({
  noSmoking: ['khong thuoc', 'khong hut thuoc', 'khong khoi thuoc', 'ko thuoc', 'khong mui thuoc'],
  requiresFamilyCar: ['xe gia dinh', 'bien trang', 'xe nha', 'xe ca nhan', 'khong phai taxi', 'khong dich vu'],
  hasLuggage: ['hanh ly', 'vali', 'do dac', 'thung hang', 'nhieu do', 'cong kenh', 'xe may'],
  withChild: ['tre em', 'em be', 'con nho', 'tre nho', 'be gai', 'be trai', 'ghe tre em'],
  withElder: ['nguoi gia', 'ong ba', 'bo me', 'cu gia', 'nguoi lon tuoi'],
  withPet: ['thu cung', 'cho meo', 'con cho', 'con meo', 'pet'],
  needAirport: ['san bay', 'tan son nhat', 'tsn', 'bay chuyen', 'chuyen bay', 'check in'],
  needHospital: ['benh vien', 'cho ray', 'kham benh', 'di vien', 'tai kham']
});

// Vietnamese relative time expressions.
const RELATIVE_DAY_PATTERNS = Object.freeze([
  { keys: ['hom nay', 'bua nay', 'nay'], offsetDays: 0 },
  { keys: ['mai', 'ngay mai', 'sang mai', 'bua sau'], offsetDays: 1 },
  { keys: ['mot', 'ngay mot', 'ngay kia'], offsetDays: 2 }
]);

// Part of day -> the system's standard time slot (TIME_SLOTS).
const DAYPART_TO_SLOT = Object.freeze([
  { keys: ['rang sang', 'sang som lam', 'khuya'], slot: '03:00-05:00' },
  { keys: ['sang som', 'som'], slot: '05:00-07:00' },
  { keys: ['sang'], slot: '07:00-09:00' },
  { keys: ['giua buoi'], slot: '09:00-11:00' },
  { keys: ['trua'], slot: '11:00-13:00' },
  { keys: ['dau gio chieu', 'chieu'], slot: '13:00-15:00' },
  { keys: ['cuoi chieu', 'tan tam'], slot: '15:00-17:00' },
  { keys: ['toi'], slot: '17:00-19:00' },
  { keys: ['dem'], slot: '19:00-21:00' }
]);

// Common Vietnamese pronouns, filler words and verbs that are homophones of place-name components
// (mình/Minh Hưng, vậy/Vàm Cống, bạn/Bàu Bàng, chở/Chợ Rẫy, tiền/Tiền Giang).
//
// They are NOT absolutely banned — "Bình Long", "Tân Khai", "Hàng Xanh" are all valid.
// Rule: a phrase made up entirely of words in this list does not qualify as
// place-name evidence, UNLESS it matches the name in full (see isTrustworthyPlaceMatch).
const WEAK_PLACE_TOKENS = new Set([
  'minh',
  'ban',
  'vay',
  'nay',
  'kia',
  'cho',
  'chi',
  'anh',
  'chu',
  'bac',
  'dua',
  'gium',
  'giup',
  'dang',
  'dinh',
  'tien',
  'tinh',
  'hang',
  'hanh',
  'thanh',
  'binh',
  'long',
  'nam',
  'bay',
  'sang',
  'trung',
  'tan',
  'moi',
  'gia',
  'nha',
  'xe',
  'can',
  'con',
  'hoa',
  'loc',
  'phu',
  'my',
  'an'
]);

/**
 * Decide whether a match qualifies as place-name evidence.
 *
 * Instead of just comparing a single threshold number, the function examines the QUALITY of the evidence:
 *  - Full-name match (every word of the alias is present) -> always trusted,
 *    even when the name consists entirely of "weak" words ("Hàng Xanh", "Bình Long", "Tân Khai").
 *  - Partial-name match -> trusted only when the phrase is NOT made up entirely of filler words
 *    ("minh" in "Minh Hưng" is rejected; "xoai" in "Đồng Xoài" is kept).
 */
function isTrustworthyPlaceMatch(spanText, aliasText) {
  // Both sides were already normalized by the caller — do not normalize again in the hot loop.
  const spanTokens = String(spanText || '').split(' ').filter(Boolean);
  const aliasTokens = String(aliasText || '').split(' ').filter(Boolean);
  if (spanTokens.length === 0 || aliasTokens.length === 0) return false;

  const coversWholeAlias = spanTokens.length >= aliasTokens.length;
  if (coversWholeAlias) return true;

  // Partial match: must contain at least one word that carries real information.
  return spanTokens.some((t) => !WEAK_PLACE_TOKENS.has(t));
}

// Prefixes that denote the TYPE of place, not a proper name. Users almost always omit
// them when speaking: "đi Bù Đốp", and nobody says "đi Chợ Tân Tiến (Bù Đốp)".
const HUB_TYPE_PREFIX = /^(?:nga\s*\d+|nga\s*(?:ba|tu)|kcn|tthc|cho|cau|cong\s*chao|vong\s*xoay|cua\s*khau|cay\s*xang(?:\s+petrolimex)?|tp\.?|tx\.?|huyen|thi\s*xa|cum\s*bv|bv|bx|vincom|aeon\s*mall)\s+/i;

function stripHubTypePrefix(value) {
  return normalizeForMatch(value).replace(HUB_TYPE_PREFIX, '').trim();
}

/**
 * Generate the alias set for a hub from its existing name data.
 *
 * Hub names in the system carry a lot of structural noise:
 *   'Chợ Tân Tiến (Bù Đốp)'      -> also needed: 'Bù Đốp', 'Tân Tiến'
 *   'Cụm BV Chợ Rẫy / BV ĐH Y Dược' -> also needed: 'Chợ Rẫy'
 *   'Ngã 4 Hàng Xanh'             -> also needed: 'Hàng Xanh'
 *
 * Peel these noise layers off into separate aliases, otherwise a user typing the real
 * name of a place is still missed because the word coverage is too low.
 */
function buildHubAliases(hub) {
  const seeds = [hub.shortName, hub.name].filter(Boolean);
  const primary = new Set(seeds); // the real name of the pickup point
  const regional = new Set(); // regional annotation in parentheses

  for (const seed of seeds) {
    // The content in parentheses is usually just the REGION containing the pickup point, not its name:
    // 'Cửa khẩu Hoa Lư (Lộc Ninh)' -> "Lộc Ninh" is a district, not the name of the border gate.
    // Many hubs lie within one district so this kind of alias must be ranked lower,
    // otherwise "đi Lộc Ninh" would wrongly match Cửa khẩu Hoa Lư.
    for (const m of seed.matchAll(/\(([^)]+)\)/g)) {
      const inner = m[1].trim();
      if (inner) regional.add(stripHubTypePrefix(inner));
    }

    // The part before the parentheses, and the variants separated by "/", are all official names.
    const beforeParen = seed.replace(/\s*\([^)]*\)/g, '').trim();
    for (const part of [beforeParen, ...beforeParen.split('/')]) {
      const clean = part.trim();
      if (!clean) continue;
      primary.add(clean);
      const stripped = stripHubTypePrefix(clean);
      if (stripped) primary.add(stripped);
    }
  }

  const longEnough = (a) => a && normalizeForMatch(a).replace(/\s/g, '').length >= 4;
  const primaryList = [...primary].filter(longEnough);
  // Regional aliases are only kept when they do not duplicate a primary alias.
  const regionalList = [...regional].filter((a) => longEnough(a) && !primary.has(a));

  return { primary: primaryList, regional: regionalList };
}

// ── PLACE-NAME INDEX (built once, O(1) lookup) ──
//
// Do not rebuild the candidate list for every sentence: it costs ~90ms/sentence and violates
// the "native intelligence <1ms" requirement of AGENTS.md. Instead, build it once
// when the module is loaded, together with an inverted token -> candidate index.
let placeIndexCache = null;

function buildPlaceIndex() {
  //  1. Real virtual hubs (specific pickup/drop-off points) — highest priority because a trip can be booked right away.
  const hubCandidates = VIRTUAL_HUBS.map((h) => ({
    kind: 'hub',
    id: h.id,
    name: h.shortName || h.name,
    corridor: h.corridor,
    // Drop `landmark`: verbose descriptions cause noisy matches, and are not the names users use.
    ...buildHubAliases(h)
  }));

  //  2. Administrative provinces/cities — catch coarse-level sentences ("đi Sài Gòn", "về Bình Phước").
  // Aliases must be long enough (>= 4 characters after diacritics folding): abbreviation keys ("tg", "bd",
  // "tp hcm") are excluded here and handled more safely via COLLOQUIAL_MAP — if they slipped through,
  // Vietnamese filler words would fuzzy-match into province names and make the engine invent place names.
  const provinceCandidates = Object.entries(PROVINCE_COORDINATES)
    .map(([key, val]) => ({
      kind: 'province',
      id: `province_${normalizeForMatch(key).replace(/\s/g, '_')}`,
      name: val.name,
      corridor: null,
      primary: [key, val.name].filter((a) => a && normalizeForMatch(a).replace(/\s/g, '').length >= 4),
      regional: []
    }))
    .filter((c) => c.primary.length > 0);

  const all = [...hubCandidates, ...provinceCandidates];

  // Inverted index at the ALIAS level, not the candidate level.
  //
  // A hub can have 5-6 aliases; if we only filter at the candidate level we would still have to score
  // all of its aliases. Indexing each alias lets us compare only those
  // aliases that actually share a word with the user's sentence.
  //
  // Each entry precomputes the normalized form and word count, avoiding re-hashing at runtime.
  const byToken = new Map();
  const byAlias = new Map();
  const addKey = (key, entry) => {
    if (!key) return;
    let bucket = byToken.get(key);
    if (!bucket) {
      bucket = new Set();
      byToken.set(key, bucket);
    }
    bucket.add(entry);
  };
  const addAlias = (key, entry) => {
    let bucket = byAlias.get(key);
    if (!bucket) {
      bucket = new Set();
      byAlias.set(key, bucket);
    }
    bucket.add(entry);
  };

  for (const cand of all) {
    const groups = [
      { list: cand.primary || [], isRegional: false },
      { list: cand.regional || [], isRegional: true }
    ];
    for (const { list, isRegional } of groups) {
      for (const alias of list) {
        const normalized = normalizeForMatch(alias);
        const tokens = normalized.split(' ').filter(Boolean);
        if (tokens.length === 0) continue;

        const entry = { candidate: cand, alias, normalized, tokens, tokenSet: new Set(tokens), isRegional };
        addAlias(normalized, entry);
        for (const token of tokens) {
          addKey(token, entry);
          // A 4-character prefix catches missing/wrong-ending typos ("hnag" ~ "hang").
          // Using 3 characters, common word beginnings ("tan", "gia", "cho", "long")
          // pull in dozens of unrelated hubs and choke performance.
          if (token.length >= 5) addKey(token.slice(0, 4), entry);
        }
      }
    }
  }

  return { all, byToken, byAlias };
}

/**
 * Narrow the set of ALIASES to be scored using the inverted index.
 * Only keep aliases that have at least one word (or 3-character prefix) matching the user's sentence.
 */
function selectAliasEntries(normalizedText) {
  if (!placeIndexCache) placeIndexCache = buildPlaceIndex();
  const { byToken } = placeIndexCache;

  const tokens = normalizedText.split(' ').filter(Boolean);
  // When the sentence already has a distinctive token ("xoai", "budop"...), very
  // common words like "xe", "gia", "di" only pull in hundreds of unrelated
  // hubs. For a sentence made up only of a short name of weak words ("Bình Long") they are still kept
  // so that a valid place name is not lost.
  const hasSpecificToken = tokens.some((token) => token.length >= 3 && !WEAK_PLACE_TOKENS.has(token));
  const selected = new Set();

  for (const token of tokens) {
    if (hasSpecificToken && WEAK_PLACE_TOKENS.has(token)) continue;
    for (const entry of byToken.get(token) || []) selected.add(entry);
    if (token.length >= 5) {
      for (const entry of byToken.get(token.slice(0, 4)) || []) selected.add(entry);
    }
  }

  return [...selected];
}

/** Count the occurrences of a keyword phrase in a normalized sentence. */
function countPhrase(haystack, phrase) {
  if (!phrase) return 0;
  // `haystack` and `phrase` are both normalized: only letters/digits separated by a single space remain.
  // Detecting boundaries directly avoids building a RegExp + match array for every keyword on
  // the hot path of intent/perk/time. This is called hundreds of times per sentence.
  let hits = 0;
  let start = 0;
  while (start < haystack.length) {
    const index = haystack.indexOf(phrase, start);
    if (index === -1) break;

    const end = index + phrase.length;
    const startsAtBoundary = index === 0 || haystack.charCodeAt(index - 1) === 32;
    const endsAtBoundary = end === haystack.length || haystack.charCodeAt(end) === 32;
    if (startsAtBoundary && endsAtBoundary) hits++;

    // `phrase` is never empty; skip past the phrase just examined so it is not double-counted.
    start = end;
  }
  return hits;
}

/**
 * Score all intents and return a ranking.
 * Scores are normalized with a condensed softmax to get a comparable "confidence".
 */
export function classifyIntent(rawText, { route: precomputedRoute } = {}) {
  const text = expandColloquial(rawText);
  if (!text) {
    return { intent: INTENTS.UNKNOWN, confidence: 0, scores: {}, ranked: [] };
  }

  const scores = {};
  for (const [intent, lexicon] of Object.entries(INTENT_LEXICON)) {
    let score = 0;
    for (const [weightStr, phrases] of Object.entries(lexicon)) {
      const weight = Number(weightStr);
      for (const phrase of phrases) {
        const hits = countPhrase(text, phrase);
        if (hits > 0) {
          // The first occurrence counts with full weight, later ones diminish (saturation).
          score += weight * (1 + Math.log(hits));
        }
      }
    }
    scores[intent] = score;
  }

  // Structural signal: having an origin–destination pair is a very strong sign of FIND_TRIP.
  // Takes the result already computed in parseUserMessage so place names are not detected twice.
  const route = precomputedRoute || extractRoute(rawText);
  if (route.from && route.to) {
    scores[INTENTS.FIND_TRIP] += 4;
  } else if (route.from || route.to) {
    scores[INTENTS.FIND_TRIP] += 1.5;
  }

  // A monetary amount in the sentence -> leans toward asking about price.
  if (/\b\d{2,3}\s*(?:k|nghin|ngan|trieu|d|dong)\b/.test(text)) {
    scores[INTENTS.ASK_PRICE] += 2;
  }

  const ranked = Object.entries(scores)
    .map(([intent, score]) => ({ intent, score }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const runnerUp = ranked[1];

  if (!top || top.score <= 0) {
    return { intent: INTENTS.UNKNOWN, confidence: 0, scores, ranked };
  }

  // Confidence = how much the top intent leads over the runner-up, normalized to 0..1.
  const margin = top.score - (runnerUp?.score || 0);
  const confidence = Math.min(1, (top.score / (top.score + 3)) * 0.6 + (margin / (margin + 2)) * 0.4);

  return { intent: top.intent, confidence: Number(confidence.toFixed(3)), scores, ranked };
}

/**
 * Extract the origin / destination with fuzzy matching against the list of REAL hubs.
 * Never produces a place name that does not exist in the system.
 */
export function extractRoute(rawText) {
  const text = expandColloquial(rawText);
  if (!text) return { from: null, to: null, fromHub: null, toHub: null };

  // Only score ALIASES that have a word actually appearing in the sentence.
  // Scanning all ~1,400 aliases per sentence costs ~90ms — violating the
  // Cursor Ambient requirement (<1ms). The inverted index narrows it to a handful of aliases.
  const aliasEntries = selectAliasEntries(text);
  // Tokenize the sentence ONCE and reuse it for every alias (see findBestSpan).
  const sentenceTokens = tokenize(text, { keepStopWords: true });
  const { byAlias, byToken } = placeIndexCache;

  // Most place names are typed correctly. Scan the sentence's n-grams once, then look up the Map
  // to find all aliases with a full match; don't repeatedly compare each alias against the entire
  // sentence. Fuzzy is only a narrow branch for typos like "hnag xanh".
  const exactStarts = new Map();
  const maxAliasWords = Math.min(4, sentenceTokens.length);
  for (let size = 1; size <= maxAliasWords; size++) {
    for (let start = 0; start + size <= sentenceTokens.length; start++) {
      const entries = byAlias.get(sentenceTokens.slice(start, start + size).join(' '));
      if (!entries) continue;
      for (const entry of entries) exactStarts.set(entry, start);
    }
  }

  // Only run fuzzy when there is a sign of a typo next to a valid place-name token.
  // The condition is evaluated PER ALIAS below; if applied to the whole sentence,
  // a common word such as "không" next to a place name by chance would trigger a fuzzy scan
  // for every unrelated alias.
  const tokenIsIndexed = (token) =>
    Boolean(byToken.get(token)) || (token.length >= 5 && Boolean(byToken.get(token.slice(0, 4))));

  // Find every hub appearing in the sentence, with positions to infer the direction of travel.
  //
  // Invariant principle: BETTER TO MISS THAN TO INVENT.
  // A place name is only recognized when the phrase in the sentence matches very highly (>= 0.88) and
  // the phrase itself is long enough (>= 3 characters) — preventing filler words like "a", "z", "vay"
  // from being wrongly assigned to a hub. This is the core safety boundary of the whole engine.
  const HUB_MATCH_THRESHOLD = 0.88;
  // Province names are much shorter and more common than hub names, so they require a near-
  // exact match so as not to wrongly swallow filler words ("mình" ~ "Bình ...", "vậy" ~ "Vĩnh ...").
  const PROVINCE_MATCH_THRESHOLD = 0.95;
  // Regional aliases (district annotations in parentheses) are score-penalized: many hubs share the same
  // region, so the hub bearing the exact name the user called must always win.
  const REGIONAL_PENALTY = 0.08;

  const bestByCandidate = new Map();
  for (const entry of aliasEntries) {
    const cand = entry.candidate;
    const threshold = cand.kind === 'province' ? PROVINCE_MATCH_THRESHOLD : HUB_MATCH_THRESHOLD;

    const exactStart = exactStarts.get(entry);
    const anchorIndices = [];
    for (let index = 0; index < sentenceTokens.length; index++) {
      if (entry.tokenSet.has(sentenceTokens[index])) anchorIndices.push(index);
    }
    const hasAdjacentTypoSignal = anchorIndices.some((index) => {
      const previous = sentenceTokens[index - 1] || '';
      const next = sentenceTokens[index + 1] || '';
      return [previous, next].some(
        (token) => token.length >= 3 && !WEAK_PLACE_TOKENS.has(token) && !tokenIsIndexed(token)
      );
    });
    const span =
      exactStart !== undefined
        ? {
            span: entry.normalized,
            score: 0.95,
            startIndex: exactStart,
            endIndex: exactStart + entry.tokens.length
          }
        : hasAdjacentTypoSignal
          ? findBestSpan(text, entry.normalized, { threshold, tokens: sentenceTokens, anchorIndices })
          : null;
    if (!span) continue;
    if (span.span.replace(/\s/g, '').length < 3) continue;
    // Judge the quality of the evidence, not just the score: reject phrases made entirely of filler words
    // that partially match a hub name, but still keep real names made of common words.
    if (!isTrustworthyPlaceMatch(span.span, entry.normalized)) continue;

    const effective = span.score - (entry.isRegional ? REGIONAL_PENALTY : 0);
    const current = bestByCandidate.get(cand);
    if (!current || effective > current.score) {
      bestByCandidate.set(cand, { ...cand, position: span.startIndex, score: effective, span: span.span });
    }
  }

  const found = [...bestByCandidate.values()];

  if (found.length === 0) {
    return { from: null, to: null, fromHub: null, toHub: null, candidates: [] };
  }

  // Deduplicate: each position in the sentence is assigned to only one place name.
  // A specific hub beats a province/city when scores tie ("Hàng Xanh" > "TP.HCM"),
  // because a trip can be booked at a hub right away, while at a province it cannot yet.
  const kindRank = (k) => (k === 'hub' ? 1 : 0);
  found.sort((a, b) => b.score - a.score || kindRank(b.kind) - kindRank(a.kind) || a.position - b.position);
  const claimed = new Set();
  const unique = [];
  for (const f of found) {
    if (claimed.has(f.position)) continue;
    claimed.add(f.position);
    unique.push(f);
  }
  unique.sort((a, b) => a.position - b.position);

  // Infer direction from prepositions: "từ X ... đến/về/xuống/ra Y" (from X ... to Y)
  const tokens = sentenceTokens;
  const FROM_MARKERS = new Set(['tu', 'o', 'tai', 'xuat phat']);
  const TO_MARKERS = new Set(['den', 've', 'toi', 'xuong', 'len', 'ra', 'vao', 'sang', 'di']);

  let fromEntry = null;
  let toEntry = null;

  for (const entry of unique) {
    const prevToken = tokens[entry.position - 1];
    const prev2Token = tokens[entry.position - 2];
    if (prevToken && FROM_MARKERS.has(prevToken)) {
      if (!fromEntry) fromEntry = entry;
    } else if (
      (prevToken && TO_MARKERS.has(prevToken)) ||
      (prev2Token && TO_MARKERS.has(prev2Token) && FROM_MARKERS.has(prevToken) === false)
    ) {
      if (!toEntry) toEntry = entry;
    }
  }

  // No clear preposition: by the convention of order of appearance (first = pickup point).
  if (!fromEntry && !toEntry) {
    fromEntry = unique[0] || null;
    toEntry = unique[1] || null;
  } else if (fromEntry && !toEntry) {
    toEntry = unique.find((e) => e !== fromEntry) || null;
  } else if (!fromEntry && toEntry) {
    fromEntry = unique.find((e) => e !== toEntry) || null;
  }

  return {
    from: fromEntry?.name || null,
    to: toEntry?.name || null,
    // Keep the phrase the user typed so the search layer can compare it against trip data.
    // The hub's display name is often longer (e.g. "Chợ Tân Tiến (Bù Đốp)")
    // so it is not suitable as an absolute filter keyword.
    fromMatch: fromEntry?.span || null,
    toMatch: toEntry?.span || null,
    fromHub: fromEntry
      ? { id: fromEntry.id, name: fromEntry.name, corridor: fromEntry.corridor, kind: fromEntry.kind }
      : null,
    toHub: toEntry ? { id: toEntry.id, name: toEntry.name, corridor: toEntry.corridor, kind: toEntry.kind } : null,
    candidates: unique.map((u) => ({ id: u.id, name: u.name, kind: u.kind, score: Number(u.score.toFixed(3)) }))
  };
}

/**
 * Extract time: relative day + the system's standard time slot.
 * Supports "mai 7h", "chiều nay", "sáng sớm mai", "17h30", "5 giờ chiều".
 */
export function extractTime(rawText, now = new Date()) {
  const text = expandColloquial(rawText);
  if (!text) return { date: null, timeSlot: null, explicitHour: null };

  // 1. Relative day
  let offsetDays = null;
  for (const pattern of RELATIVE_DAY_PATTERNS) {
    for (const key of pattern.keys) {
      if (countPhrase(text, key) > 0) {
        offsetDays = pattern.offsetDays;
        break;
      }
    }
    if (offsetDays !== null) break;
  }

  // 2. Absolute date in the form "25/12" or "25-12-2026".
  // Read from the ORIGINAL string: normalization already removed "/" and "-" so "25/12" becomes "25 12".
  let absoluteDate = null;
  const rawForDate = String(rawText || '');
  const slashDate = rawForDate.match(/\b(\d{1,2})\s*[/-]\s*(\d{1,2})(?:\s*[/-]\s*(\d{2,4}))?\b/);
  if (slashDate) {
    const day = Number(slashDate[1]);
    const month = Number(slashDate[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const requestedYear = slashDate[3]
        ? Number(slashDate[3].length === 2 ? `20${slashDate[3]}` : slashDate[3])
        : null;
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const createValidCalendarDate = (year) => {
        const candidate = new Date(year, month - 1, day);
        return candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === day
          ? candidate
          : null;
      };

      if (requestedYear !== null) {
        absoluteDate = createValidCalendarDate(requestedYear);
      } else {
        // A date with no year means the nearest valid occurrence in the future.
        // The loop also handles 29/02 when the current year or next year is not a leap year.
        for (let year = now.getFullYear(); year <= now.getFullYear() + 4; year++) {
          const candidate = createValidCalendarDate(year);
          if (candidate && candidate >= todayStart) {
            absoluteDate = candidate;
            break;
          }
        }
      }
    }
  }

  // 3. Specific hour: "7h", "17h30", "5 gio", "7 giờ sáng"
  let explicitHour = null;
  let explicitMinute = 0;
  const hourMatch = text.match(/\b(\d{1,2})\s*(?:h|gio|g)\s*(\d{1,2})?\b/);
  if (hourMatch) {
    explicitHour = Number(hourMatch[1]);
    explicitMinute = hourMatch[2] ? Number(hourMatch[2]) : 0;
    // "5 giờ chiều" -> 17h. Only convert when the hour is <= 12 and there is a word for afternoon/evening.
    if (explicitHour <= 12 && /\b(chieu|toi|dem)\b/.test(text)) {
      if (explicitHour < 12) explicitHour += 12;
    }
    if (explicitHour > 23 || explicitMinute > 59) {
      explicitHour = null;
      explicitMinute = 0;
    }
  }

  // 4. Part of day -> time slot
  let timeSlot = null;
  if (explicitHour !== null) {
    // Always return an exact ID in TIME_SLOTS; never compose a time range that does not exist.
    timeSlot = mapTimeToSlot(`${String(explicitHour).padStart(2, '0')}:${String(explicitMinute).padStart(2, '0')}`);
  } else {
    // Prefer longer phrases ("sang som" before "sang").
    const sorted = DAYPART_TO_SLOT.flatMap((d) => d.keys.map((k) => ({ key: k, slot: d.slot }))).sort(
      (a, b) => b.key.length - a.key.length
    );
    for (const { key, slot } of sorted) {
      if (countPhrase(text, key) > 0) {
        timeSlot = slot;
        break;
      }
    }
  }

  let date = absoluteDate;
  if (!date && offsetDays !== null) {
    date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);
  }

  return {
    date: date ? toIsoDate(date) : null,
    timeSlot,
    explicitHour,
    explicitMinute: explicitHour !== null ? explicitMinute : null,
    isRelative: offsetDays !== null
  };
}

function toIsoDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Extract the number of seats to book. Supports both digits and written words.
 * "2 ghế", "hai người", "đi 3 đứa", "một mình"
 */
export function extractSeats(rawText) {
  const text = expandColloquial(rawText);
  if (!text) return 1;

  if (/\b(mot minh|di le|1 minh|don than)\b/.test(text)) return 1;

  const WORD_NUMBERS = { mot: 1, hai: 2, ba: 3, bon: 4, nam: 5, sau: 6, bay: 7 };

  // A number standing next to a noun for people/seats.
  const digitMatch = text.match(/\b(\d{1,2})\s*(?:ghe|cho|nguoi|khach|dua|ban|me con|anh em)\b/);
  if (digitMatch) {
    const n = Number(digitMatch[1]);
    if (n >= 1 && n <= 7) return n;
  }

  for (const [word, value] of Object.entries(WORD_NUMBERS)) {
    if (new RegExp(`\\b${word}\\s*(?:ghe|cho|nguoi|khach|dua)\\b`).test(text)) {
      return value;
    }
  }

  // "2 vé", "đặt 2"
  const loose = text.match(/\b(?:dat|can|muon|lay|book)\s*(\d{1,2})\b/);
  if (loose) {
    const n = Number(loose[1]);
    if (n >= 1 && n <= 7) return n;
  }

  return 1;
}

/** Extract the maximum budget: "dưới 150k", "khoảng 200 nghìn", "tầm 150000". */
export function extractBudget(rawText) {
  const text = expandColloquial(rawText);
  if (!text) return null;

  const m = text.match(/\b(\d{1,3}(?:[.,]\d{3})*|\d{1,4})\s*(k|nghin|ngan|trieu|d|dong)?\b/g);
  if (!m) return null;

  for (const raw of m) {
    const numPart = raw.replace(/[^\d]/g, '');
    if (!numPart) continue;
    let value = Number(numPart);
    if (/trieu/.test(raw)) value *= 1_000_000;
    else if (/k|nghin|ngan/.test(raw)) value *= 1000;

    // Only accept a reasonable amount for one carpool seat (20k – 2 million).
    if (value >= 20_000 && value <= 2_000_000) return value;
  }
  return null;
}

/** Extract amenities / constraints as boolean flags. */
export function extractPerks(rawText) {
  const text = expandColloquial(rawText);
  const perks = {};
  if (!text) return perks;

  for (const [perk, patterns] of Object.entries(PERK_PATTERNS)) {
    for (const p of patterns) {
      if (countPhrase(text, p) > 0) {
        perks[perk] = true;
        break;
      }
    }
  }
  return perks;
}

/**
 * Aggregate function: fully parse a Vietnamese sentence into a machine-understandable structure.
 * This is the only entry point the agent layer should call.
 *
 * @returns {{
 *   intent: string, confidence: number, needsClarification: boolean,
 *   slots: object, raw: string, engine: string
 * }}
 */
export function parseUserMessage(rawText, { now = new Date() } = {}) {
  const raw = String(rawText || '').trim();
  const route = extractRoute(raw);
  const classification = classifyIntent(raw, { route });
  const time = extractTime(raw, now);
  const seats = extractSeats(raw);
  const budget = extractBudget(raw);
  const perks = extractPerks(raw);

  const slots = {
    from: route.from,
    to: route.to,
    fromMatch: route.fromMatch,
    toMatch: route.toMatch,
    fromHub: route.fromHub,
    toHub: route.toHub,
    date: time.date,
    timeSlot: time.timeSlot,
    explicitHour: time.explicitHour,
    seats,
    maxPrice: budget,
    ...perks
  };

  // Need to ask again when: the intent is unclear, or the user wants to find a trip but is missing both origin and destination.
  const missingRoute = classification.intent === INTENTS.FIND_TRIP && !route.from && !route.to;
  const needsClarification = classification.confidence < 0.45 || missingRoute;

  return {
    intent: classification.intent,
    confidence: classification.confidence,
    needsClarification,
    missingSlots: buildMissingSlots(classification.intent, slots),
    slots,
    candidates: route.candidates || [],
    raw,
    engine: 'native-intent-engine-v1'
  };
}

function buildMissingSlots(intent, slots) {
  const missing = [];
  if (intent === INTENTS.FIND_TRIP) {
    if (!slots.from) missing.push('from');
    if (!slots.to) missing.push('to');
    if (!slots.date && !slots.timeSlot) missing.push('when');
  }
  if (intent === INTENTS.ASK_PRICE && !slots.from && !slots.to) {
    missing.push('route');
  }
  return missing;
}

/**
 * Suggest the nearest reference route when the user mentions a place outside the hub network.
 * Returns the best-matching route in ROUTE_BENCHMARKS, together with its similarity score.
 */
export function suggestBenchmarkRoute(rawText) {
  const text = expandColloquial(rawText);
  if (!text) return null;

  let best = null;
  for (const [key, bench] of Object.entries(ROUTE_BENCHMARKS)) {
    const labels = [key, bench.route, bench.shortName, bench.corridor].filter(Boolean);
    for (const label of labels) {
      const score = similarity(text, label);
      const spanHit = findBestSpan(text, label, { threshold: 0.78 });
      const effective = Math.max(score, spanHit ? spanHit.score : 0);
      if (effective >= 0.7 && (!best || effective > best.score)) {
        best = { key, benchmark: bench, score: Number(effective.toFixed(3)) };
      }
    }
  }
  return best;
}

/** Utility for the UI layer: normalize the search string a user types into the search box. */
export function normalizeSearchQuery(rawText) {
  return normalizeForMatch(expandColloquial(rawText));
}

/**
 * Native Vietnamese text processing (Zero-LLM, runs in <1ms on the client).
 *
 * Foundation of CarMate's entire native-intelligence layer: whether a real user types
 * "bù đóp", "budop", "bu dop", "Bù Đốp" or "nhiu tien z a", all must be understood the same way,
 * with no server round-trip and no LLM.
 *
 * Algorithm:
 * - Unicode NFD normalization + tone-mark removal (diacritics folding).
 * - Damerau-Levenshtein distance (with adjacent transposition) — catches fast-typing errors like "Đôngf Xoài".
 * - Dice similarity on bigrams — catches structural deviations in long words.
 * - Hybrid scoring: prefers prefix matches and whole-word matches, because Vietnamese place names
 *   are often typed abbreviated from the start ("Bình Phước" -> "BP", "Sài Gòn" -> "SG").
 */

// ── TABLE OF LOCAL ABBREVIATIONS & SLANG ──
// Users in the QL13/QL14 region abbreviate a lot. This is domain knowledge, not machine-learning data.
const COLLOQUIAL_MAP = Object.freeze({
  sg: 'sai gon',
  tphcm: 'sai gon',
  hcm: 'sai gon',
  'tp hcm': 'sai gon',
  'tp.hcm': 'sai gon',
  saigon: 'sai gon',
  bp: 'binh phuoc',
  bd: 'binh duong',
  dx: 'dong xoai',
  ln: 'loc ninh',
  bdop: 'bu dop',
  budop: 'bu dop',
  tsn: 'san bay tan son nhat',
  sanbay: 'san bay',
  sb: 'san bay',
  hx: 'hang xanh',
  bxmd: 'ben xe mien dong',
  'bx mien dong': 'ben xe mien dong',
  cr: 'cho ray',
  hn: 'ha noi',
  hp: 'hai phong',
  vt: 'vung tau',
  pt: 'phan thiet',
  ndl: 'nga tu binh phuoc'
});

// Vietnamese filler words that carry no information — removed before matching.
const STOP_WORDS = new Set([
  'a',
  'ai',
  'ah',
  'ak',
  'ạ',
  'the',
  'la',
  'co',
  'khong',
  'ko',
  'k',
  'oi',
  'vay',
  'v',
  'z',
  'zay',
  'the nao',
  'nhe',
  'nha',
  'di',
  'va',
  'voi',
  'cho',
  'minh',
  'em',
  'anh',
  'chi',
  'ban',
  'toi',
  'can',
  'muon',
  'tim',
  'hoi',
  'xin',
  'cam on',
  'oke',
  'ok',
  'dc',
  'duoc',
  'r',
  'roi',
  'nay',
  'do',
  'kia',
  'thi',
  'ma',
  'nhung',
  'hay'
]);

/**
 * Strip Vietnamese diacritics and normalize to lowercase without accents.
 * "Bù Đốp" -> "bu dop" | "Đồng Xoài" -> "dong xoai"
 */
export function foldDiacritics(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove tone marks + diacritic hats
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();
}

/**
 * Normalize a string for matching: strip diacritics, collapse whitespace, remove special characters.
 */
export function normalizeForMatch(str) {
  if (!str || typeof str !== 'string') return '';
  return foldDiacritics(str)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Expand local abbreviations/slang to their full form.
 * "đi sg" -> "di sai gon" | "bp" -> "binh phuoc"
 */
// Normalization cache: hub and province names are normalized over and over thousands of
// times in a single place-name detection pass. Size is capped to avoid a memory leak when
// users type countless different sentences.
const EXPAND_CACHE = new Map();
const EXPAND_CACHE_LIMIT = 2000;

export function expandColloquial(str) {
  if (typeof str === 'string') {
    const hit = EXPAND_CACHE.get(str);
    if (hit !== undefined) return hit;
  }

  const result = computeExpandColloquial(str);

  if (typeof str === 'string' && str.length <= 200) {
    if (EXPAND_CACHE.size >= EXPAND_CACHE_LIMIT) EXPAND_CACHE.clear();
    EXPAND_CACHE.set(str, result);
  }
  return result;
}

function computeExpandColloquial(str) {
  const normalized = normalizeForMatch(str);
  if (!normalized) return '';

  // Match multi-word phrases first (longest first), to avoid "tp hcm" being split into "tp" + "hcm".
  let result = normalized;
  const multiWordKeys = Object.keys(COLLOQUIAL_MAP)
    .filter((k) => k.includes(' '))
    .sort((a, b) => b.length - a.length);
  for (const key of multiWordKeys) {
    const safe = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\b${safe}\\b`, 'g'), COLLOQUIAL_MAP[key]);
  }

  return result
    .split(' ')
    .map((token) => COLLOQUIAL_MAP[token] || token)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split into meaningful tokens: diacritics folded, abbreviations expanded, filler words removed.
 */
export function tokenize(str, { keepStopWords = false } = {}) {
  const expanded = expandColloquial(str);
  if (!expanded) return [];
  const tokens = expanded.split(' ').filter(Boolean);
  if (keepStopWords) return tokens;
  const meaningful = tokens.filter((t) => !STOP_WORDS.has(t));
  // If filtering removes everything (a sentence made entirely of filler words), return the original so no signal is lost.
  return meaningful.length > 0 ? meaningful : tokens;
}

/**
 * Damerau-Levenshtein distance (counting transposition of two adjacent characters).
 * Fast typing on a phone often swaps characters: "Đôngf" / "Xoaì" / "hnag xanh".
 * Uses dynamic programming with 3 rolling rows -> O(min(m,n)) memory, <1ms for place-name strings.
 */
export function damerauLevenshtein(a, b, maxDistance = Infinity) {
  const s = String(a || '');
  const t = String(b || '');
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;

  // Cut early when the length difference already exceeds the threshold — saves most of the computation.
  if (Math.abs(s.length - t.length) > maxDistance) return maxDistance + 1;

  let prevPrev = null;
  let prev = new Array(t.length + 1);
  let curr = new Array(t.length + 1);

  for (let j = 0; j <= t.length; j++) prev[j] = j;

  for (let i = 1; i <= s.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];

    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      let value = Math.min(
        curr[j - 1] + 1, // insert
        prev[j] + 1, // delete
        prev[j - 1] + cost // substitute
      );

      // Transposition of two adjacent characters
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) {
        value = Math.min(value, prevPrev[j - 2] + 1);
      }

      curr[j] = value;
      if (value < rowMin) rowMin = value;
    }

    if (rowMin > maxDistance) return maxDistance + 1;

    prevPrev = prev;
    prev = curr;
    curr = new Array(t.length + 1);
  }

  return prev[t.length];
}

/**
 * Sørensen-Dice similarity on character bigrams (0..1).
 * Complements Levenshtein: handles well the case of reordered words
 * ("xoai dong" vs "dong xoai") that the edit distance underrates.
 */
export function diceCoefficient(a, b) {
  const s = normalizeForMatch(a).replace(/\s/g, '');
  const t = normalizeForMatch(b).replace(/\s/g, '');
  if (!s.length || !t.length) return 0;
  if (s === t) return 1;
  if (s.length < 2 || t.length < 2) return s === t ? 1 : 0;

  const bigrams = new Map();
  for (let i = 0; i < s.length - 1; i++) {
    const bg = s.slice(i, i + 2);
    bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < t.length - 1; i++) {
    const bg = t.slice(i, i + 2);
    const count = bigrams.get(bg) || 0;
    if (count > 0) {
      bigrams.set(bg, count - 1);
      intersection++;
    }
  }

  return (2 * intersection) / (s.length - 1 + (t.length - 1));
}

/**
 * Quick check of whether two strings share enough characters to be worth scoring.
 * Uses a 26-letter bitmask — a single AND instead of the whole dynamic-programming table.
 */
function shareEnoughCharacters(a, b) {
  const maskOf = (str) => {
    let mask = 0;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i) - 97; // 'a'
      if (code >= 0 && code < 26) mask |= 1 << code;
    }
    return mask;
  };

  const maskA = maskOf(a);
  const maskB = maskOf(b);
  const shared = maskA & maskB;
  if (shared === 0) return false;

  // Count the number of distinct letters in common (popcount).
  let common = 0;
  let bits = shared;
  while (bits) {
    bits &= bits - 1;
    common++;
  }

  let distinctA = 0;
  bits = maskA;
  while (bits) {
    bits &= bits - 1;
    distinctA++;
  }

  // The shorter string must share most of its own letter set with the other string.
  return common >= Math.min(3, distinctA) && common / Math.max(1, distinctA) >= 0.5;
}

/**
 * Detects exactly one swap of two adjacent characters. This is a common phone typing
 * error, but much narrower than lowering the fuzzy threshold for every string.
 */
function isSingleAdjacentTransposition(a, b) {
  if (a.length !== b.length || a.length < 2) return false;

  const mismatches = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) mismatches.push(i);
    if (mismatches.length > 2) return false;
  }

  if (mismatches.length !== 2 || mismatches[1] !== mismatches[0] + 1) return false;
  const [first, second] = mismatches;
  return a[first] === b[second] && a[second] === b[first];
}

/**
 * Hybrid similarity score between two strings (0..1), tuned specifically for Vietnamese place names.
 *
 * Weights in order of actual priority:
 *  1.00 — exact match after normalization
 *  0.95 — contains the whole phrase (substring match on word boundaries)
 *  0.90 — word-prefix match ("bd" ~ "bu dop", "dx" ~ "dong xoai")
 *  the rest — combination of normalized Levenshtein and Dice
 */
export function similarity(a, b, { preNormalized = false } = {}) {
  // `preNormalized` is for hot loops (place-name detection): the caller has already normalized
  // both sides, so it skips the abbreviation-expansion step, which takes most of the time
  // when this function is called hundreds of times for one sentence.
  const s = preNormalized ? a : expandColloquial(a);
  const t = preNormalized ? b : expandColloquial(b);
  if (!s || !t) return 0;
  if (s === t) return 1;

  const shorter = s.length <= t.length ? s : t;
  const longer = s.length <= t.length ? t : s;
  const shorterWords = shorter.split(' ').filter(Boolean);
  const longerWords = longer.split(' ').filter(Boolean);

  // Block junk matches: a very short fragment sitting inside a very long name is NOT a match.
  // "z" inside "vinh long z..."; "a" inside "an loc" — must be rejected thoroughly,
  // otherwise the extractor will invent place names that are not in the user's sentence at all.
  const coverage = shorter.length / longer.length;
  const tooShortToTrust = shorter.length < 4 && shorterWords.length === 1;
  const tooDilute = coverage < 0.34;

  // Whole-phrase match on word boundaries.
  //
  // Key constraint: a partial match must cover MOST OF THE WORDS of the full name.
  // A single word inside a two-word name ("tiền" in "Tiền Giang", "định" in "Nam Định")
  // is far too weak as evidence — which is exactly where the engine once invented place names from filler words.
  const boundary = (hay, needle) => new RegExp(`(?:^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`).test(hay);
  const wordCoverage = shorterWords.length / longerWords.length;
  const enoughWords = longerWords.length === 1 || wordCoverage >= 0.5;
  if (!tooShortToTrust && !tooDilute && enoughWords && (boundary(s, t) || boundary(t, s))) {
    // Full coverage is a more absolute match than partial coverage.
    return wordCoverage === 1 ? 0.95 : 0.88;
  }

  // Prefix match: "dong x" ~ "dong xoai" — must still account for a significant share.
  if (shorter.length >= 4 && !tooDilute && longer.startsWith(shorter)) return 0.92;

  // Match on the initial letters of the words: "dx" ~ "dong xoai".
  // Only accepted when the number of letters equals the number of words in the full name (>=2 words),
  // to avoid "a" or "z" matching every name at random.
  if (shorterWords.length === 1 && shorter.length >= 2 && longerWords.length >= 2) {
    const initials = longerWords.map((w) => w[0]).join('');
    if (initials === shorter) return 0.9;
  }

  // Fragment too short / too diluted relative to the candidate: treat as no match.
  if (tooShortToTrust || tooDilute) return 0;

  // Cheap gate before the expensive operation: if the two strings do not share enough characters then
  // Levenshtein/Dice will certainly give a low score. This check is O(n) and eliminates
  // most unrelated pairs before running the O(n·m) dynamic programming.
  if (!shareEnoughCharacters(s, t)) return 0;

  // A single swap of two adjacent characters within a whole place name is still strong evidence.
  // Only runs after the cheap character gate so as not to slow the loop that scans hundreds of hubs.
  if (isSingleAdjacentTransposition(s, t)) return 0.9;

  const maxLen = Math.max(s.length, t.length);
  const dist = damerauLevenshtein(s, t, Math.ceil(maxLen * 0.5));
  const levScore = dist > maxLen ? 0 : 1 - dist / maxLen;
  const diceScore = diceCoefficient(s, t);

  // Dice is more stable for long strings, Levenshtein is more sensitive to short typing errors.
  return Math.max(levScore * 0.55 + diceScore * 0.45, diceScore * 0.85);
}

/**
 * Find the best-matching candidates in a list.
 *
 * @param {string} query The string the user entered
 * @param {Array} candidates List of candidates
 * @param {object} options
 * @param {(c:any)=>string|string[]} options.getText Extracts a string (or several aliases) from a candidate
 * @param {number} options.threshold Acceptance threshold (default 0.62)
 * @param {number} options.limit Number of results to return
 * @returns {Array<{item:any, score:number, matchedText:string}>} Sorted by descending score
 */
export function fuzzyFind(query, candidates = [], options = {}) {
  const { getText = (c) => String(c), threshold = 0.62, limit = 5 } = options;
  const q = expandColloquial(query);
  if (!q || !Array.isArray(candidates) || candidates.length === 0) return [];

  const scored = [];
  for (const item of candidates) {
    const raw = getText(item);
    const texts = Array.isArray(raw) ? raw.filter(Boolean) : [raw].filter(Boolean);
    let best = 0;
    let bestText = '';
    for (const text of texts) {
      const score = similarity(q, text);
      if (score > best) {
        best = score;
        bestText = String(text);
      }
    }
    if (best >= threshold) {
      scored.push({ item, score: best, matchedText: bestText });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Scan the whole sentence to find the sub-phrase that best matches a candidate.
 * Used when a place name is embedded in a long sentence: "mai mình đi từ bù đốp xuống hàng xanh nhé".
 *
 * Sliding window of 1..4 words (the usual length of Vietnamese place names).
 */
export function findBestSpan(sentence, candidateText, { threshold = 0.72, tokens: presetTokens, anchorIndices } = {}) {
  // `tokens` lets the caller tokenize the sentence ONCE and reuse it for dozens of candidates.
  // Without it, place-name detection would have to re-tokenize the same sentence ~50 times and
  // the cost would climb to nearly 10ms/sentence — over the <1ms threshold of native intelligence.
  const tokens = presetTokens || tokenize(sentence, { keepStopWords: true });
  if (tokens.length === 0) return null;

  const candidate = expandColloquial(candidateText);
  if (!candidate) return null;

  let best = null;
  const maxWindow = Math.min(4, tokens.length);
  const candLength = candidate.length;
  // When the calling layer already knows the positions that share tokens with the candidate, any window
  // that contains none of those positions certainly cannot be a valid typo.
  // Greatly reduces the number of similarity runs (Damerau-Levenshtein + Dice) in long sentences.
  const anchorPrefix = Array.isArray(anchorIndices) && anchorIndices.length > 0 ? new Int32Array(tokens.length + 1) : null;
  if (anchorPrefix) {
    for (const index of anchorIndices) {
      if (index >= 0 && index < tokens.length) anchorPrefix[index + 1] = 1;
    }
    for (let index = 1; index < anchorPrefix.length; index++) anchorPrefix[index] += anchorPrefix[index - 1];
  }

  // Cheap filtering before expensive scoring: the similarity score is upper-bounded by the length ratio
  // of the two strings, so a fragment that is too short or too long relative to the candidate cannot exceed the threshold.
  // Skipping them avoids thousands of useless normalizations + Levenshtein runs.
  const minLength = Math.floor(candLength * threshold * 0.6);
  const maxLength = Math.ceil(candLength / (threshold * 0.6));

  // Scan from SHORT to LONG phrases: a place name is the most compact phrase that matches.
  // Scanning in the opposite order would swallow prepositions ("đi từ bù đốp" instead of "bù đốp").
  for (let size = 1; size <= maxWindow; size++) {
    for (let i = 0; i + size <= tokens.length; i++) {
      if (anchorPrefix && anchorPrefix[i + size] === anchorPrefix[i]) continue;
      const span = tokens.slice(i, i + size).join(' ');
      if (span.length < minLength || span.length > maxLength) continue;

      // Both `span` (from tokenize) and `candidate` have already gone through expandColloquial.
      const score = similarity(span, candidate, { preNormalized: true });
      // Uses ">" so the shorter phrase wins when scores are equal.
      if (score >= threshold && (!best || score > best.score)) {
        best = { span, score, startIndex: i, endIndex: i + size };
      }
    }
  }

  return best;
}

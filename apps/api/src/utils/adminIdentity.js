/**
 * System Administrator Identity (System Admin Identity)
 *
 * The admin phone number is used as the "MIT Invariant Guard": an admin account cannot
 * delete itself so that the system always has an owner. This number used to be hardcoded directly in
 * the source code (exposed in the repo); it is now read from the ADMIN_PHONE environment variable to keep it out of the source.
 *
 * Falls back to the current operations number if the env is not configured — preserving the protective behavior
 * for environments that haven't set the variable yet, to avoid accidentally unlocking deletion of the admin account.
 */

// Multiple numbers can be declared, separated by commas (e.g. the old number + the new number during a handover).
const RAW_ADMIN_PHONES = process.env.ADMIN_PHONE || process.env.CARMATE_ADMIN_PHONE || '0984883750';

function normalize(p) {
  return String(p || '').replace(/[^0-9]/g, '');
}

const ADMIN_PHONE_SET = new Set(
  RAW_ADMIN_PHONES.split(',')
    .map((s) => normalize(s))
    .filter(Boolean)
);

/**
 * Checks whether a phone number (in any format) is a system admin.
 */
export function isAdminPhone(phone) {
  const cleaned = normalize(phone);
  if (!cleaned) return false;
  return ADMIN_PHONE_SET.has(cleaned);
}

/**
 * The primary admin phone number (the first one) — used as the internal contact fallback.
 */
export function getPrimaryAdminPhone() {
  return [...ADMIN_PHONE_SET][0] || '';
}

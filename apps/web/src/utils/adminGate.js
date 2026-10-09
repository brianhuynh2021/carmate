/**
 * adminGate.js — ADMIN IDENTIFICATION ON THE FRONTEND SIDE
 *
 * The admin phone number used to be hard-coded SCATTERED across 4 components
 * (Header, UserProfileModal, DeleteAccountModal...) in the form
 * `currentUser.phone?.includes('0984...')`. Two problems:
 *   1. Changing/handing over the admin meant editing each place, and missing one caused drift.
 *   2. A personal phone number was spread across the public bundle.
 *
 * It is now consolidated in ONE place and prefers the role granted by the SERVER (`role`), since that is the
 * source of truth. The phone number is only a fallback for the development environment,
 * and is read from the VITE_ADMIN_PHONE environment variable.
 *
 * SECURITY NOTE: this function ONLY decides whether to show or hide a button in the UI.
 * Every admin endpoint is guarded on the server by a signed JWT (requireAdmin),
 * so tampering with the variable in the browser grants no extra privileges.
 */

const ENV_ADMIN_PHONES = (import.meta.env?.VITE_ADMIN_PHONE || '')
  .split(',')
  .map((s) => String(s).replace(/\D/g, ''))
  .filter(Boolean);

export function isAdminUser(currentUser) {
  if (!currentUser) return false;

  // 1. Role granted by the server — the source of truth
  if (currentUser.role === 'admin' || currentUser.role === 'super_admin') return true;

  // 2. Phone-number fallback (only when VITE_ADMIN_PHONE is configured)
  if (ENV_ADMIN_PHONES.length === 0) return false;
  const phone = String(currentUser.phone || '').replace(/\D/g, '');
  return Boolean(phone) && ENV_ADMIN_PHONES.includes(phone);
}

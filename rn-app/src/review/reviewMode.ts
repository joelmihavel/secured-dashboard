/**
 * Apple Review Mode — Global State
 *
 * Client-side-only mock layer activated by a magic phone number.
 * When active, all API calls are intercepted and return hardcoded success responses.
 * In-memory only — no persistence, no AsyncStorage.
 */

export const REVIEW_PHONE = '+919999900001';
export const REVIEW_OTP = '123456';

let _active = false;

export function isReviewMode(): boolean {
  return _active;
}

export function activateReviewMode(): void {
  _active = true;
  console.log('[review-mode] Activated');
}

export function deactivateReviewMode(): void {
  _active = false;
  console.log('[review-mode] Deactivated');
}

export function isReviewPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  return cleaned === REVIEW_PHONE || cleaned === '9999900001' || cleaned === '09999900001';
}

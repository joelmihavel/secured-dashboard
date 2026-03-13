/**
 * Journey Demo Mode — State Machine
 *
 * Second demo user (+919999900002) that walks through the entire onboarding journey:
 * sign-up → agreement → waitlist → setup → dashboard → payments.
 *
 * In-memory only — no persistence, no AsyncStorage.
 * Reuses REVIEW_OTP ('123456') from reviewMode.ts.
 *
 * Stage machine: agreement_upload → agreement_review → waitlist → setup → active
 */

import { REVIEW_OTP } from './reviewMode';

export { REVIEW_OTP };

export const JOURNEY_PHONE = '+919999900002';

export type JourneyStage =
  | 'agreement_upload'
  | 'agreement_review'
  | 'waitlist'
  | 'setup'
  | 'active';

const STAGE_ORDER: JourneyStage[] = [
  'agreement_upload',
  'agreement_review',
  'waitlist',
  'setup',
  'active',
];

let _journeyActive = false;
let _journeyStage: JourneyStage = 'agreement_upload';

export function isJourneyMode(): boolean {
  return _journeyActive;
}

export function activateJourneyMode(): void {
  _journeyActive = true;
  _journeyStage = 'agreement_upload';
  console.log('[journey-mode] Activated');
}

export function deactivateJourneyMode(): void {
  _journeyActive = false;
  _journeyStage = 'agreement_upload';
  console.log('[journey-mode] Deactivated');
}

export function isJourneyPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  return cleaned === JOURNEY_PHONE || cleaned === '9999900002' || cleaned === '09999900002';
}

export function getJourneyStage(): JourneyStage {
  return _journeyStage;
}

export function advanceJourneyStage(): void {
  const currentIndex = STAGE_ORDER.indexOf(_journeyStage);
  if (currentIndex < STAGE_ORDER.length - 1) {
    _journeyStage = STAGE_ORDER[currentIndex + 1];
    console.log('[journey-mode] Stage advanced to:', _journeyStage);
  }
}

/**
 * Maps the current journey stage to a route path for the router.
 */
export function getJourneyRouteTarget(): string {
  switch (_journeyStage) {
    case 'agreement_upload':
      return '/(agreement)/upload';
    case 'agreement_review':
      return '/(agreement)/review';
    case 'waitlist':
      return '/(waitlist)';
    case 'setup':
      return '/(setup)';
    case 'active':
      return '/(main)';
  }
}

/**
 * useExtractionHydration — top-level hook that mirrors the agreement-extraction
 * data into the manual-agreement Zustand store as soon as a completed
 * extraction is available.
 *
 * Background: the previous flow used /(agreement)/upload-review as the
 * hydration site — the user always landed there once extraction finished,
 * and the screen-mounted effect populated the store before downstream
 * screens read it. Fire-and-forget upload skips that screen entirely, so
 * hydration has to live somewhere that's always mounted. This hook is
 * idempotent: if the store has already been populated for the current
 * extractionId, it is a no-op.
 */

import { useEffect, useRef } from 'react';
import { useExtractedData } from './useAgreement';
import { useExtractionStatus } from './useExtractionStatus';
import { useManualAgreementStore } from '@/src/stores/manualAgreement';
import { useUploadStore } from '@/src/stores/upload';

/** "2026-11-30" → "30 Nov 2026". Returns the raw string if parsing fails. */
function formatExitDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function paiseToRupeeDigits(paise: number | undefined): string {
  if (!paise || paise <= 0) return '';
  return String(Math.round(paise / 100));
}

/**
 * Invisible mount component so the hook can be wired into the root layout
 * inside the necessary providers (QueryProvider, AuthProvider). Renders
 * nothing — its only job is to keep the hook alive across navigation.
 */
export function ExtractionHydrationMount() {
  useExtractionHydration();
  return null;
}

export function useExtractionHydration() {
  const extractionId = useUploadStore((s) => s.extractionId);
  const setField = useManualAgreementStore((s) => s.setField);
  // Only fetch + hydrate when extraction is in a terminal completed state.
  // Pending/processing rows would yield partial payloads that clobber any
  // user-entered values with empty strings.
  const status = useExtractionStatus({ enabled: !!extractionId });
  const isCompleted = status.data?.extractionStatus === 'completed';
  const { data: extracted } = useExtractedData(extractionId, {
    enabled: !!extractionId && isCompleted,
  });
  const lastHydratedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!extracted || !extractionId || !isCompleted) return;
    if (lastHydratedIdRef.current === extractionId) return;

    lastHydratedIdRef.current = extractionId;
    setField('agreementId', extracted.registrationNumber ?? extracted.certificateNo ?? '');
    setField('propertyName', extracted.propertyName ?? extracted.propertyAddress ?? '');
    setField('tenants', (extracted.tenantNames ?? []).join(', '));
    setField('landlords', (extracted.landlordNames ?? []).join(', '));
    setField('monthlyRent', paiseToRupeeDigits(extracted.monthlyRentPaise));
    setField('oneTimeDeposit', paiseToRupeeDigits(extracted.securityDepositPaise));
    setField(
      'rentDuration',
      extracted.rentDurationMonths ? `${extracted.rentDurationMonths} months` : '',
    );
    setField('exitDate', formatExitDate(extracted.leaseEndDate));
  }, [extracted, extractionId, setField]);
}

/**
 * Manual Agreement Entry Store
 *
 * Holds the rental-detail fields the user types when they bypass the
 * upload flow ("Enter details manually" on the agreement intro). Lives
 * in memory only — gets reset on app cold-start or after submission.
 */

import { create } from 'zustand';

export interface ManualAgreementData {
  agreementId: string;
  propertyName: string;
  tenants: string;
  landlords: string;
  monthlyRent: string;       // raw digits only — formatting done at render time
  oneTimeDeposit: string;    // raw digits only
  rentDuration: string;
  exitDate: string;
}

const DEFAULT: ManualAgreementData = {
  agreementId: '',
  propertyName: '',
  tenants: '',
  landlords: '',
  monthlyRent: '',
  oneTimeDeposit: '',
  rentDuration: '',
  exitDate: '',
};

interface ManualAgreementStore extends ManualAgreementData {
  setField: <K extends keyof ManualAgreementData>(key: K, value: ManualAgreementData[K]) => void;
  reset: () => void;
}

export const useManualAgreementStore = create<ManualAgreementStore>((set) => ({
  ...DEFAULT,
  setField: (key, value) => set({ [key]: value } as Partial<ManualAgreementData>),
  reset: () => set(DEFAULT),
}));

/** Field-level validators — each returns true when the field is acceptable. */
export const validators = {
  agreementId: (v: string) => v.trim().length >= 4,
  propertyName: (v: string) => v.trim().length >= 2,
  tenants: (v: string) => v.trim().length >= 2,
  landlords: (v: string) => v.trim().length >= 2,
  monthlyRent: (v: string) => {
    const n = Number(v.replace(/\D/g, ''));
    return Number.isFinite(n) && n >= 1000 && n <= 10_000_000;
  },
  oneTimeDeposit: (v: string) => {
    const n = Number(v.replace(/\D/g, ''));
    return Number.isFinite(n) && n >= 0 && n <= 100_000_000;
  },
  rentDuration: (v: string) => v.trim().length >= 2,
  exitDate: (v: string) => v.trim().length >= 4,
} as const;

export function isAllValid(d: ManualAgreementData): boolean {
  return (Object.keys(validators) as (keyof ManualAgreementData)[]).every(
    (k) => validators[k](d[k]),
  );
}

/** "40000" → "₹40,000". Empty string → "". */
export function formatRupees(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return `₹${Number(digits).toLocaleString('en-IN')}`;
}

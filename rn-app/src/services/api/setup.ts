/**
 * Setup API Services
 * Backend integration for bank verification, utility verification, and landlord invites
 */

import type {
  BankVerificationRequest,
  BankVerificationResponse,
  UtilityVerificationRequest,
  UtilityVerificationResponse,
  UtilityOperator,
  LandlordInviteRequest,
  LandlordInviteResponse,
  SetupProgress,
  SetupStep,
} from '@/src/types/setup';

// TODO: Replace with actual Supabase client
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Base API call helper
 */
async function callEdgeFunction<T>(
  functionName: string,
  payload: object
): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Verify bank account via Cashfree Penny Drop
 */
export async function verifyBank(
  data: BankVerificationRequest
): Promise<BankVerificationResponse> {
  return callEdgeFunction<BankVerificationResponse>('verify-bank', data);
}

/**
 * Fetch available utility operators for a given state
 */
export async function getUtilityOperators(
  state: string = 'Karnataka'
): Promise<UtilityOperator[]> {
  const response = await callEdgeFunction<{ operators: UtilityOperator[] }>(
    'get-utility-operators',
    { state }
  );
  return response.operators;
}

/**
 * Verify utility bill
 */
export async function verifyUtility(
  data: UtilityVerificationRequest
): Promise<UtilityVerificationResponse> {
  return callEdgeFunction<UtilityVerificationResponse>('verify-utility', data);
}

/**
 * Send landlord invite
 */
export async function sendLandlordInvite(
  data: LandlordInviteRequest
): Promise<LandlordInviteResponse> {
  return callEdgeFunction<LandlordInviteResponse>('send-landlord-invite', data);
}

/**
 * Resend landlord invite
 */
export async function resendLandlordInvite(
  inviteId: string
): Promise<LandlordInviteResponse> {
  return callEdgeFunction<LandlordInviteResponse>('resend-landlord-invite', {
    inviteId,
  });
}

/**
 * Get current setup progress
 */
export async function getSetupProgress(
  tenancyId: string
): Promise<SetupProgress> {
  return callEdgeFunction<SetupProgress>('get-setup-progress', { tenancyId });
}

/**
 * Mock data for development
 */
export const mockOperators: UtilityOperator[] = [
  { operatorCode: 'BESCOM', operatorName: 'BESCOM', state: 'Karnataka', utilityType: 'electricity' },
  { operatorCode: 'MESCOM', operatorName: 'MESCOM', state: 'Karnataka', utilityType: 'electricity' },
  { operatorCode: 'HESCOM', operatorName: 'HESCOM', state: 'Karnataka', utilityType: 'electricity' },
  { operatorCode: 'GESCOM', operatorName: 'GESCOM', state: 'Karnataka', utilityType: 'electricity' },
  { operatorCode: 'CESCOM', operatorName: 'CESCOM', state: 'Karnataka', utilityType: 'electricity' },
  { operatorCode: 'KPTCL', operatorName: 'KPTCL', state: 'Karnataka', utilityType: 'electricity' },
];

export const mockSetupSteps: SetupStep[] = [
  {
    id: 'bank',
    type: 'bank',
    title: 'Add bank details',
    subtitle: 'For rent payouts',
    icon: 'building-columns',
    isCompleted: false,
    route: '/(setup)/add-bank',
  },
  {
    id: 'utility',
    type: 'utility',
    title: 'Verify address',
    subtitle: 'Via electricity bill',
    icon: 'bolt',
    isCompleted: false,
    route: '/(setup)/add-utility',
  },
  {
    id: 'landlord',
    type: 'landlord',
    title: 'Invite landlord',
    subtitle: 'To approve tenancy',
    icon: 'user-plus',
    isCompleted: false,
    route: '/(setup)/invite-landlord',
  },
];

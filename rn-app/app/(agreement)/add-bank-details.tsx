/**
 * Landlord Bank Details Screen
 *
 * Single source of truth for bank entry, pre- or post-waitlist. AddBankForm
 * derives the mode from useAuthStore.userStatus — no prop needed.
 */

import AddBankForm from '@/src/components/setup/AddBankForm';

export default function AddBankDetailsScreen() {
  return <AddBankForm />;
}

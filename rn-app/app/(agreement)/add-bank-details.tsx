/**
 * Pre-Waitlist Bank Details Screen
 * Renders AddBankForm in pre-waitlist mode:
 * - No tenancy_id in API calls
 * - Skip option → waitlist
 * - No progress bar, shows subtitle
 */

import AddBankForm from '@/src/components/setup/AddBankForm';

export default function AddBankDetailsScreen() {
  return <AddBankForm preWaitlist />;
}

/**
 * Setup Flow Index — Redirect
 *
 * The "Let's get you setup" carousel has been removed.
 * Users now go directly to the dashboard after approval.
 * This redirect exists as a safety net for any deep links to /(setup).
 */

import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function SetupIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(main)' as never);
  }, [router]);

  return null;
}

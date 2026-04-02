/**
 * Setup Flow Index — Redirect
 *
 * The "Let's get you setup" carousel has been removed.
 * Users now go directly to the dashboard after approval.
 * This redirect exists as a safety net for any deep links to /(setup).
 */

import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';

export default function SetupIndex() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    routerRef.current.replace('/(main)' as never);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

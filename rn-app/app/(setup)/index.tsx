/**
 * Setup Flow Index — Redirect to Root
 *
 * Safety net for deep links to /(setup). Redirects to the root journey
 * router which re-evaluates user status and routes correctly.
 * NEVER redirect to /(main) directly — unapproved users could reach dashboard.
 */

import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';

export default function SetupIndex() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    routerRef.current.replace('/' as never);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

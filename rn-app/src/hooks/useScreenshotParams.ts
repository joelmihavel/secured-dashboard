/**
 * useScreenshotParams — Merges URL search params with global screenshot mock params.
 *
 * In normal mode, returns useLocalSearchParams() as-is.
 * In screenshot capture mode (SCREENSHOT_PARAMS is set), merges the global
 * mock params so screens render the desired state without URL query params
 * (which crash Expo Router's StackRouter.getRehydratedState).
 */
import { useLocalSearchParams } from 'expo-router';
import { SCREENSHOT_PARAMS } from '@/app/index';

export function useScreenshotParams<
  T extends Record<string, string | string[]> = Record<string, string>
>(): T {
  const urlParams = useLocalSearchParams<T>();

  if (SCREENSHOT_PARAMS) {
    return { ...urlParams, ...SCREENSHOT_PARAMS } as T;
  }

  return urlParams;
}

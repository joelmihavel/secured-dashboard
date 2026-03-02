import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import {
  generateErrorId,
  reportFatalError,
  buildSupportEmailUri,
} from '../../services/errorReporting';
import { Text } from './Typography/Text';
import { PrimaryButton } from './Button/PrimaryButton';
import { theme } from '@/src/theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

/** Errors that are transient and self-heal — auto-recover instead of showing error UI */
const TRANSIENT_ERROR_PATTERNS = [
  'PropertyDOM',          // react-native-screens view deallocated during background
  'property.*DOM',
  'doesn\'t exist',       // native view property access after deallocation
  'not yet been mounted',
  'navigate before mounting',
  'Cannot read property',
  'Cannot read properties of null',
  'undefined is not an object',
];

function isTransientError(message: string): boolean {
  const lower = message.toLowerCase();
  return TRANSIENT_ERROR_PATTERNS.some((pattern) =>
    lower.includes(pattern.toLowerCase())
  );
}

/** Max auto-recovery attempts to prevent infinite loops */
const MAX_AUTO_RECOVERY = 5;
/** Time window to count auto-recoveries */
const RECOVERY_WINDOW_MS = 10_000;

export class ErrorBoundary extends Component<Props, State> {
  private recoveryTimestamps: number[] = [];
  private autoRecoveryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorId: generateErrorId() };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Auto-recover from transient native errors (e.g., PropertyDOM after
    // iOS background resume). These resolve on the next render cycle once
    // react-native-screens re-creates the native views.
    // Check transient FIRST to avoid console.error triggering LogBox overlay.
    if (isTransientError(error.message)) {
      const now = Date.now();
      // Prune old timestamps outside window
      this.recoveryTimestamps = this.recoveryTimestamps.filter(
        (t) => now - t < RECOVERY_WINDOW_MS
      );

      if (this.recoveryTimestamps.length < MAX_AUTO_RECOVERY) {
        this.recoveryTimestamps.push(now);
        if (__DEV__) {
          console.log('[ErrorBoundary] Auto-recovering from transient error:', error.message);
        }
        // Reset on NEXT FRAME — 0ms timeout schedules after current commit.
        // Native views stabilize during the same event loop tick; the next
        // React render cycle will find them restored. The dark placeholder
        // rendered during this frame is imperceptible (~16ms).
        this.autoRecoveryTimer = setTimeout(() => {
          this.setState({ hasError: false, error: null, errorId: null });
        }, 0);
        return;
      }
      // Exceeded max auto-recoveries — fall through to show error UI
    }

    // Log genuine (non-transient) errors. Uses console.error intentionally so
    // RedBox/LogBox surfaces them in dev. Transient errors use console.log above.
    // DO NOT call reportFatalError — getDerivedStateFromError already unmounted
    // the Stack. reportFatalError → router.replace → "navigate before mounting"
    // NSException → Hermes heap corruption.
    if (__DEV__) {
      console.error('[ErrorBoundary] Original error:', error.message);
      console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    }
  }

  componentWillUnmount() {
    if (this.autoRecoveryTimer) {
      clearTimeout(this.autoRecoveryTimer);
    }
  }

  handleReset = () => {
    this.recoveryTimestamps = [];
    this.setState({ hasError: false, error: null, errorId: null });
  };

  handleContactSupport = () => {
    const uri = buildSupportEmailUri({
      id: this.state.errorId || undefined,
      source: 'react_render',
      title: 'React Render Crash',
      message: this.state.error?.message,
      timestamp: Date.now(),
    });
    Linking.openURL(uri);
  };

  render() {
    if (this.state.hasError) {
      // Transient native errors (PropertyDOM, etc.): render a silent dark
      // placeholder instead of error UI. Auto-recovery in componentDidCatch
      // will reset hasError on the next frame (~16ms) — imperceptible to user.
      // This prevents the "Something went wrong" flash on quick bg/fg cycles.
      if (this.state.error && isTransientError(this.state.error.message)) {
        return <View style={styles.silentPlaceholder} />;
      }

      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <Text variant="h4" align="center" style={styles.title}>Something went wrong</Text>
          <Text variant="bodyMd2" align="center" style={styles.message}>
            {this.state.error?.message || 'Please try again'}
          </Text>

          {this.state.errorId && (
            <Text variant="caption" style={styles.errorId}>{this.state.errorId}</Text>
          )}

          <PrimaryButton
            title="Try Again"
            onPress={this.handleReset}
            style={styles.button}
            testID="error-boundary-reset"
          />

          <TouchableOpacity
            style={styles.supportButton}
            onPress={this.handleContactSupport}
            accessibilityRole="button"
            accessibilityLabel="Contact support"
          >
            <Text variant="bodyMd2" style={styles.supportButtonText}>Contact Support</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.black[700],
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  title: {
    marginBottom: theme.spacing.sm,
  },
  message: {
    color: theme.colors.neutral[500],
    marginBottom: theme.spacing.md,
  },
  errorId: {
    fontFamily: 'monospace',
    color: theme.colors.neutral[600],
    marginBottom: theme.spacing.xl,
  },
  button: {
    width: 'auto',
    paddingHorizontal: theme.spacing.xl,
  },
  supportButton: {
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.sm,
  },
  supportButtonText: {
    color: theme.colors.neutral[500],
    textDecorationLine: 'underline',
  },
  silentPlaceholder: {
    flex: 1,
    backgroundColor: theme.colors.black[700], // #131313 — matches app background
  },
});

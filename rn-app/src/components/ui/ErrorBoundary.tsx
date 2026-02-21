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

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorId: generateErrorId() };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Route through reportFatalError — single Sentry capture point.
    // If the router is still alive, useErrorNavigation will navigate to /error.
    // If the router is broken, this fallback UI stays visible.
    reportFatalError({
      source: 'react_render',
      title: 'Something went wrong',
      message: 'The app encountered an unexpected error.',
      technicalMessage: error.message,
      originalError: error,
    });
  }

  handleReset = () => {
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
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <Text variant="h4" align="center" style={styles.title}>Something went wrong</Text>
          <Text variant="bodyMd2" align="center" style={styles.message}>
            {__DEV__ ? this.state.error?.message : 'Please try again'}
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
});

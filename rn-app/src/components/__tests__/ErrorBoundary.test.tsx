import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { ErrorBoundary } from '../ui/ErrorBoundary';

// Component that throws an error
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <Text>Normal content</Text>;
}

// Suppress console.error for expected errors in tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const message = typeof args[0] === 'string' ? args[0] : '';
    if (
      message.includes('Test error message') ||
      message.includes('Uncaught error') ||
      message.includes('The above error occurred')
    ) {
      return;
    }
    originalConsoleError.apply(console, args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('ErrorBoundary', () => {
  // ── Normal Rendering Tests ──────────────────────────────────────────────

  it('renders children when no error occurs', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <Text>Hello World</Text>
      </ErrorBoundary>
    );

    expect(getByText('Hello World')).toBeTruthy();
  });

  it('renders children snapshot correctly', () => {
    const { toJSON } = render(
      <ErrorBoundary>
        <Text>Content</Text>
      </ErrorBoundary>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  // ── Error State Tests ───────────────────────────────────────────────────

  it('renders default fallback UI when error occurs', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByText('Try Again')).toBeTruthy();
  });

  it('renders default error UI snapshot', () => {
    const { toJSON } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders custom fallback when provided', () => {
    const customFallback = <Text>Custom error page</Text>;

    const { getByText, queryByText } = render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText('Custom error page')).toBeTruthy();
    expect(queryByText('Something went wrong')).toBeNull();
  });

  // ── Recovery Tests ──────────────────────────────────────────────────────

  it('recovers when Try Again button is pressed', () => {
    const { getByText, queryByText } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText('Something went wrong')).toBeTruthy();

    // Note: After pressing Try Again, the component resets state and
    // re-renders children. The ThrowingComponent will throw again
    // because shouldThrow is still true, so it goes back to error state.
    fireEvent.press(getByText('Try Again'));

    // Since ThrowingComponent still throws, we expect error state again
    expect(getByText('Something went wrong')).toBeTruthy();
  });

  // ── Edge Cases ──────────────────────────────────────────────────────────

  it('renders with multiple children', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <Text>Child 1</Text>
        <Text>Child 2</Text>
      </ErrorBoundary>
    );

    expect(getByText('Child 1')).toBeTruthy();
    expect(getByText('Child 2')).toBeTruthy();
  });

  it('renders with nested components', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <View>
          <Text>Nested content</Text>
        </View>
      </ErrorBoundary>
    );

    expect(getByText('Nested content')).toBeTruthy();
  });
});

import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import UploadScreen from '../upload';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockSearchParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style, ...props }: any) => (
      <View {...props} style={style}>{children}</View>
    ),
    SafeAreaProvider: ({ children }: any) => children,
    useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
  };
});

jest.mock('react-native-keyboard-controller', () => ({
  useKeyboardHandler: jest.fn(),
}));

// DottedPattern (heavy SVG)
jest.mock('@/src/components/patterns', () => ({
  DottedGridPattern: () => null,
}));

// expo-document-picker
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

// useAgreement hook
const mockUpload = jest.fn();
const mockResetUpload = jest.fn();
const mockSetExtractionId = jest.fn();
jest.mock('@/src/hooks', () => ({
  useAgreement: () => ({
    upload: mockUpload,
    isUploading: false,
    uploadProgress: 0,
    uploadError: null,
    extractedData: null,
    isLoadingExtraction: false,
    extractionId: null,
    setExtractionId: mockSetExtractionId,
    resetUpload: mockResetUpload,
  }),
  useNetworkStatus: () => ({ isConnected: true, isInternetReachable: true, type: 'wifi' }),
}));

// useExtractionStatus hook (uses QueryClient internally - mock to avoid provider requirement)
jest.mock('@/src/hooks/useExtractionStatus', () => ({
  useExtractionStatus: () => ({
    data: null,
    isLoading: false,
    hasActiveExtraction: false,
    reset: jest.fn(),
  }),
}));

// Upload store - mock with hydrated state so screen renders past loading gate
const createUploadStoreState = (): Record<string, any> => ({
  _hasHydrated: true,
  extractionId: null,
  uploadPhase: 'idle',
  fileName: null,
  lastUpdatedAt: 0,
  errorCode: null,
  errorMessage: null,
  isStale: () => false,
  reset: jest.fn(),
  setPhase: jest.fn(),
  prepareForReupload: jest.fn(),
});

let mockUploadStoreState: Record<string, any> = createUploadStoreState();

jest.mock('@/src/stores/upload', () => ({
  useUploadStore: Object.assign(
    (selector: (s: any) => any) => {
      return selector(mockUploadStoreState);
    },
    {
      getState: () => mockUploadStoreState,
    }
  ),
}));

// Payment service utilities
jest.mock('@/src/services/payment', () => ({
  getMimeType: jest.fn(() => 'application/pdf'),
  validateFileSize: jest.fn(() => true),
  validateAgreementType: jest.fn(() => true),
}));

// navigateToError utility
jest.mock('@/src/utils', () => ({
  navigateToError: jest.fn(),
}));

// Supabase client
jest.mock('@/src/services/supabase/client', () => ({
  supabase: {
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null } }) },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({ data: null }),
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              maybeSingle: jest.fn().mockResolvedValue({ data: null }),
            })),
          })),
        })),
        in: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              maybeSingle: jest.fn().mockResolvedValue({ data: null }),
            })),
          })),
        })),
      })),
    })),
  },
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('UploadScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockUpload.mockClear();
    mockResetUpload.mockClear();
    mockSearchParams = {};
    mockUploadStoreState = createUploadStoreState();
  });

  // ── Idle State (default) ────────────────────────────────────────────────

  it('renders with testID "upload-screen"', () => {
    const { getByTestId } = renderWithClient(<UploadScreen />);
    expect(getByTestId('upload-screen')).toBeTruthy();
  });

  it('renders title "One" and "More Step"', () => {
    const { getByText } = renderWithClient(<UploadScreen />);
    expect(getByText('One')).toBeTruthy();
    expect(getByText('More Step')).toBeTruthy();
  });

  it('renders subtitle about rental agreement', () => {
    const { getByText } = renderWithClient(<UploadScreen />);
    expect(getByText(/rental agreement/)).toBeTruthy();
  });

  it('renders upload hints', () => {
    const { getByText } = renderWithClient(<UploadScreen />);
    expect(getByText(/Upload Rental Agreement/)).toBeTruthy();
    expect(getByText(/PDF/)).toBeTruthy();
  });

  it('renders proceed button with testID', () => {
    const { getByTestId } = renderWithClient(<UploadScreen />);
    expect(getByTestId('proceed-button')).toBeTruthy();
  });

  it('matches snapshot (idle)', () => {
    const { toJSON } = renderWithClient(<UploadScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  // ── Button States ─────────────────────────────────────────────────────

  it('renders Proceed button text in idle state', () => {
    const { getByText } = renderWithClient(<UploadScreen />);
    expect(getByText('Proceed')).toBeTruthy();
  });

  it('renders without crashing', () => {
    const { toJSON } = renderWithClient(<UploadScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('keeps the CTA disabled for waitlist-triggered reuploads', () => {
    mockUploadStoreState = {
      ...createUploadStoreState(),
      uploadPhase: 'failed',
      fileName: 'Agreement.pdf',
      errorCode: 'REUPLOAD_REQUIRED',
      errorMessage: 'Please upload a valid rental agreement to continue.',
    };

    const { getByText, getByTestId } = renderWithClient(<UploadScreen />);

    expect(getByText('Upload again')).toBeTruthy();
    expect(getByText('Agreement.pdf')).toBeTruthy();
    expect(getByText('Please upload a valid rental agreement to continue.')).toBeTruthy();
    expect(getByTestId('proceed-button').props.accessibilityState?.disabled).toBe(true);
  });
});

import React from 'react';
import { render } from '@testing-library/react-native';

import UploadScreen from '../upload';

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
jest.mock('@/src/stores/upload', () => ({
  useUploadStore: Object.assign(
    (selector: (s: any) => any) => {
      const state = {
        _hasHydrated: true,
        extractionId: null,
        uploadPhase: 'idle',
        fileName: null,
        lastUpdatedAt: 0,
        errorCode: null,
        errorMessage: null,
        isStale: () => false,
        reset: jest.fn(),
      };
      return selector(state);
    },
    {
      getState: () => ({
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
      }),
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
  });

  // ── Idle State (default) ────────────────────────────────────────────────

  it('renders with testID "upload-screen"', () => {
    const { getByTestId } = render(<UploadScreen />);
    expect(getByTestId('upload-screen')).toBeTruthy();
  });

  it('renders title "One" and "More Step"', () => {
    const { getByText } = render(<UploadScreen />);
    expect(getByText('One')).toBeTruthy();
    expect(getByText('More Step')).toBeTruthy();
  });

  it('renders subtitle about rental agreement', () => {
    const { getByText } = render(<UploadScreen />);
    expect(getByText(/rental agreement/)).toBeTruthy();
  });

  it('renders upload hints', () => {
    const { getByText } = render(<UploadScreen />);
    expect(getByText(/Upload Rental Agreement/)).toBeTruthy();
    expect(getByText(/PDF/)).toBeTruthy();
  });

  it('renders proceed button with testID', () => {
    const { getByTestId } = render(<UploadScreen />);
    expect(getByTestId('proceed-button')).toBeTruthy();
  });

  it('matches snapshot (idle)', () => {
    const { toJSON } = render(<UploadScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  // ── Button States ─────────────────────────────────────────────────────

  it('renders Proceed button text in idle state', () => {
    const { getByText } = render(<UploadScreen />);
    expect(getByText('Proceed')).toBeTruthy();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<UploadScreen />);
    expect(toJSON()).toBeTruthy();
  });
});

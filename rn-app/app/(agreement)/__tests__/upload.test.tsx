import React from 'react';
import { render } from '@testing-library/react-native';

import UploadScreen from '../upload';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockSearchParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
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

// react-native-svg
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => <View {...props} />,
    Svg: (props: any) => <View {...props} />,
    Path: (props: any) => <View {...props} />,
    Circle: (props: any) => <View {...props} />,
    Rect: (props: any) => <View {...props} />,
    G: (props: any) => <View {...props} />,
  };
});

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
}));

// Payment service utilities
jest.mock('@/src/services/payment', () => ({
  getMimeType: jest.fn(() => 'application/pdf'),
  validateFileSize: jest.fn(() => true),
  validateAgreementType: jest.fn(() => true),
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
    expect(getByText('Upload Rental Agreement')).toBeTruthy();
    expect(getByText(/PDF, DOCX/)).toBeTruthy();
  });

  it('renders proceed button with testID', () => {
    const { getByTestId } = render(<UploadScreen />);
    expect(getByTestId('proceed-button')).toBeTruthy();
  });

  it('matches snapshot (idle)', () => {
    const { toJSON } = render(<UploadScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  // ── Uploading State ─────────────────────────────────────────────────────

  it('renders uploading state with progress', () => {
    mockSearchParams = { state: 'uploading' };
    const { getByText } = render(<UploadScreen />);
    expect(getByText(/\d+%/)).toBeTruthy();
  });

  // ── Error States ────────────────────────────────────────────────────────

  it('renders expired error state', () => {
    mockSearchParams = { state: 'expired' };
    const { getByText } = render(<UploadScreen />);
    expect(getByText(/invalid or expired/)).toBeTruthy();
    expect(getByText('Upload Again')).toBeTruthy();
  });

  it('renders too-large error state', () => {
    mockSearchParams = { state: 'too-large' };
    const { getByText } = render(<UploadScreen />);
    expect(getByText(/too large/)).toBeTruthy();
    expect(getByText('Upload Again')).toBeTruthy();
  });

  // ── Manual Review State ─────────────────────────────────────────────────

  it('renders manual review state', () => {
    mockSearchParams = { state: 'manual-review' };
    const { getByText } = render(<UploadScreen />);
    expect(getByText(/review it manually/)).toBeTruthy();
    expect(getByText('Get Notified')).toBeTruthy();
  });
});

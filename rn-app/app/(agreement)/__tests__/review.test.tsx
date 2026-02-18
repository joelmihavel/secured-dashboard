import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import ReviewScreen from '../review';

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
  DottedPattern: () => null,
}));

// Agreement icons
jest.mock('@/src/components/icons/AgreementIcons', () => {
  const { View } = require('react-native');
  const IconStub = (props: any) => <View testID={props.testID || 'icon'} />;
  return {
    FlentLogoIcon: IconStub,
    AgreementIdIcon: IconStub,
    PropertyIcon: IconStub,
    TenantIcon: IconStub,
    LandlordIcon: IconStub,
  };
});

// useAgreement hook
const mockConfirm = jest.fn();
const mockUpdate = jest.fn();
let mockAgreementState = {
  extractedData: {
    extractionId: 'ext-123',
    certificateNo: 'KIA123456789',
    propertyName: 'Prestige Pinestripe',
    propertyAddress: '123 Main St',
    propertyCity: 'Bengaluru',
    propertyPincode: '560001',
    tenantNames: ['John Appleseed'],
    landlordNames: ['Lisa Appleseed'],
    monthlyRentPaise: 4000000,
    securityDepositPaise: 13000000,
    rentDurationMonths: 11,
    leaseEndDate: '2027-12-31',
    editableFields: ['property_address', 'tenant_name', 'landlord_name'],
  },
  isLoadingExtraction: false,
  confirm: mockConfirm,
  isConfirming: false,
  update: mockUpdate,
  isUpdating: false,
};
jest.mock('@/src/hooks', () => ({
  useAgreement: () => mockAgreementState,
}));

// Agreement service (formatters)
jest.mock('@/src/services/api/agreement', () => ({
  formatPaiseToRupees: (paise: number) =>
    (paise / 100).toLocaleString('en-IN'),
  formatDateDisplay: (date: string) => '31 Dec 2027',
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ReviewScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockConfirm.mockClear();
    mockUpdate.mockClear();
    mockSearchParams = {};
    mockAgreementState = {
      extractedData: {
        extractionId: 'ext-123',
        certificateNo: 'KIA123456789',
        propertyName: 'Prestige Pinestripe',
        propertyAddress: '123 Main St',
        propertyCity: 'Bengaluru',
        propertyPincode: '560001',
        tenantNames: ['John Appleseed'],
        landlordNames: ['Lisa Appleseed'],
        monthlyRentPaise: 4000000,
        securityDepositPaise: 13000000,
        rentDurationMonths: 11,
        leaseEndDate: '2027-12-31',
        editableFields: ['property_address', 'tenant_name', 'landlord_name'],
      },
      isLoadingExtraction: false,
      confirm: mockConfirm,
      isConfirming: false,
      update: mockUpdate,
      isUpdating: false,
    };
  });

  // ── Verify Mode (default) ───────────────────────────────────────────────

  it('renders with testID "review-screen"', () => {
    const { getByTestId } = render(<ReviewScreen />);
    expect(getByTestId('review-screen')).toBeTruthy();
  });

  it('renders verify mode title "Confirm / your details"', () => {
    const { getByText } = render(<ReviewScreen />);
    expect(getByText('Confirm')).toBeTruthy();
    expect(getByText('your details')).toBeTruthy();
  });

  it('renders agreement detail fields', () => {
    const { getByText } = render(<ReviewScreen />);
    expect(getByText('Agreement ID')).toBeTruthy();
    expect(getByText('KIA123456789')).toBeTruthy();
    expect(getByText('Property Name')).toBeTruthy();
    expect(getByText('Tenant(s)')).toBeTruthy();
    expect(getByText('John Appleseed')).toBeTruthy();
    expect(getByText('Landlord(s)')).toBeTruthy();
    expect(getByText('Lisa Appleseed')).toBeTruthy();
  });

  it('renders "Proceed" button in verify mode', () => {
    const { getByText } = render(<ReviewScreen />);
    expect(getByText('Proceed')).toBeTruthy();
  });

  it('renders "Enter Manually" link in verify mode', () => {
    const { getByText } = render(<ReviewScreen />);
    expect(getByText('Enter Manually')).toBeTruthy();
  });

  it('matches snapshot (verify mode)', () => {
    const { toJSON } = render(<ReviewScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  // ── Edit Mode ───────────────────────────────────────────────────────────

  it('switches to edit mode when "Enter Manually" is pressed', () => {
    const { getByText } = render(<ReviewScreen />);
    fireEvent.press(getByText('Enter Manually'));
    expect(getByText("Let's")).toBeTruthy();
    expect(getByText('fix the details')).toBeTruthy();
    expect(getByText('Save Changes')).toBeTruthy();
  });

  // ── Loading State ───────────────────────────────────────────────────────

  it('renders loading state', () => {
    mockAgreementState = {
      ...mockAgreementState,
      extractedData: null as any,
      isLoadingExtraction: true,
    };
    const { getByText } = render(<ReviewScreen />);
    expect(getByText('Loading your details...')).toBeTruthy();
  });

  // ── Empty Data ──────────────────────────────────────────────────────────

  it('renders verify mode with no data gracefully', () => {
    mockAgreementState = {
      ...mockAgreementState,
      extractedData: null as any,
    };
    const { getByTestId } = render(<ReviewScreen />);
    expect(getByTestId('review-screen')).toBeTruthy();
  });
});

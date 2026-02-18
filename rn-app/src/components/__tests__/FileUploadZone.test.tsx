import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FileUploadZone } from '../ui/FileUpload/FileUploadZone';

// Mock expo-document-picker
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ name: 'test.pdf', uri: 'file://test.pdf', size: 1024 }],
  }),
}));

describe('FileUploadZone', () => {
  const mockOnFileSelected = jest.fn();

  beforeEach(() => {
    mockOnFileSelected.mockClear();
  });

  // ── Snapshot Tests ──────────────────────────────────────────────────────

  it('renders correctly - default state', () => {
    const { toJSON } = render(
      <FileUploadZone onFileSelected={mockOnFileSelected} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - disabled state', () => {
    const { toJSON } = render(
      <FileUploadZone onFileSelected={mockOnFileSelected} disabled />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - custom placeholder', () => {
    const { toJSON } = render(
      <FileUploadZone
        onFileSelected={mockOnFileSelected}
        placeholder="Upload your ID proof"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - with custom style', () => {
    const { toJSON } = render(
      <FileUploadZone
        onFileSelected={mockOnFileSelected}
        style={{ marginTop: 24 }}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  // ── Display Tests ───────────────────────────────────────────────────────

  it('displays default placeholder text', () => {
    const { getByText } = render(
      <FileUploadZone onFileSelected={mockOnFileSelected} />
    );

    expect(getByText('Tap to upload your rental agreement')).toBeTruthy();
  });

  it('displays custom placeholder text', () => {
    const { getByText } = render(
      <FileUploadZone
        onFileSelected={mockOnFileSelected}
        placeholder="Upload document here"
      />
    );

    expect(getByText('Upload document here')).toBeTruthy();
  });

  // ── Interaction Tests ───────────────────────────────────────────────────

  it('calls document picker when pressed', async () => {
    const DocumentPicker = require('expo-document-picker');

    const { getByRole } = render(
      <FileUploadZone onFileSelected={mockOnFileSelected} />
    );

    await fireEvent.press(getByRole('button'));

    expect(DocumentPicker.getDocumentAsync).toHaveBeenCalled();
  });

  it('does not open document picker when disabled', () => {
    const DocumentPicker = require('expo-document-picker');
    DocumentPicker.getDocumentAsync.mockClear();

    const { getByRole } = render(
      <FileUploadZone onFileSelected={mockOnFileSelected} disabled />
    );

    fireEvent.press(getByRole('button'));
    expect(DocumentPicker.getDocumentAsync).not.toHaveBeenCalled();
  });

  // ── Accessibility Tests ─────────────────────────────────────────────────

  it('has correct accessibility role', () => {
    const { getByRole } = render(
      <FileUploadZone onFileSelected={mockOnFileSelected} />
    );

    expect(getByRole('button')).toBeTruthy();
  });

  it('has correct accessibility label', () => {
    const { getByRole } = render(
      <FileUploadZone onFileSelected={mockOnFileSelected} />
    );

    const button = getByRole('button');
    expect(button.props.accessibilityLabel).toBe('Tap to upload your rental agreement');
  });

  // ── Edge Cases ──────────────────────────────────────────────────────────

  it('renders with testID', () => {
    const { getByTestId } = render(
      <FileUploadZone
        onFileSelected={mockOnFileSelected}
        testID="upload-zone"
      />
    );

    expect(getByTestId('upload-zone')).toBeTruthy();
  });

  it('renders with empty placeholder', () => {
    const { toJSON } = render(
      <FileUploadZone
        onFileSelected={mockOnFileSelected}
        placeholder=""
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});

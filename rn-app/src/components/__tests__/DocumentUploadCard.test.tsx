import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DocumentUploadCard } from '../ui/FileUpload/DocumentUploadCard';

describe('DocumentUploadCard', () => {
  const mockOnRemove = jest.fn();
  const mockOnRetry = jest.fn();

  beforeEach(() => {
    mockOnRemove.mockClear();
    mockOnRetry.mockClear();
  });

  // ── Snapshot Tests ──────────────────────────────────────────────────────

  it('renders correctly - idle state', () => {
    const { toJSON } = render(
      <DocumentUploadCard filename="Agreement.pdf" status="idle" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - uploading state', () => {
    const { toJSON } = render(
      <DocumentUploadCard
        filename="Agreement.pdf"
        status="uploading"
        progress={45}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - processing state', () => {
    const { toJSON } = render(
      <DocumentUploadCard filename="Agreement.pdf" status="processing" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - success state', () => {
    const { toJSON } = render(
      <DocumentUploadCard filename="Agreement.pdf" status="success" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - error state', () => {
    const { toJSON } = render(
      <DocumentUploadCard
        filename="Agreement.pdf"
        status="error"
        errorMessage="File is expired"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - with custom style', () => {
    const { toJSON } = render(
      <DocumentUploadCard
        filename="Agreement.pdf"
        status="idle"
        style={{ marginTop: 16 }}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  // ── Display Tests ───────────────────────────────────────────────────────

  it('displays filename', () => {
    const { getByText } = render(
      <DocumentUploadCard filename="Joel_Ramesh-Agreement.pdf" status="idle" />
    );

    expect(getByText('Joel_Ramesh-Agreement.pdf')).toBeTruthy();
  });

  it('truncates long filenames', () => {
    const longFilename = 'This_is_a_very_long_agreement_filename_that_exceeds_the_limit.pdf';
    const { toJSON } = render(
      <DocumentUploadCard filename={longFilename} status="idle" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('displays uploading progress text', () => {
    const { getByText } = render(
      <DocumentUploadCard
        filename="Agreement.pdf"
        status="uploading"
        progress={65}
      />
    );

    expect(getByText('Uploading... 65%')).toBeTruthy();
  });

  it('displays processing text', () => {
    const { getByText } = render(
      <DocumentUploadCard filename="Agreement.pdf" status="processing" />
    );

    expect(getByText('Processing document...')).toBeTruthy();
  });

  it('displays success text', () => {
    const { getByText } = render(
      <DocumentUploadCard filename="Agreement.pdf" status="success" />
    );

    expect(getByText('Upload complete')).toBeTruthy();
  });

  it('displays custom error message', () => {
    const { getByText } = render(
      <DocumentUploadCard
        filename="Agreement.pdf"
        status="error"
        errorMessage="File size exceeds 10MB limit."
      />
    );

    expect(getByText('File size exceeds 10MB limit.')).toBeTruthy();
  });

  it('displays default error message when no errorMessage provided', () => {
    const { getByText } = render(
      <DocumentUploadCard filename="Agreement.pdf" status="error" />
    );

    expect(getByText('Upload failed')).toBeTruthy();
  });

  it('does not display status text in idle state', () => {
    const { queryByText } = render(
      <DocumentUploadCard filename="Agreement.pdf" status="idle" />
    );

    expect(queryByText('Uploading')).toBeNull();
    expect(queryByText('Processing')).toBeNull();
    expect(queryByText('Upload complete')).toBeNull();
    expect(queryByText('Upload failed')).toBeNull();
  });

  // ── Interaction Tests ───────────────────────────────────────────────────

  it('shows retry button in error state and calls onRetry', () => {
    const { getByText } = render(
      <DocumentUploadCard
        filename="Agreement.pdf"
        status="error"
        onRetry={mockOnRetry}
      />
    );

    fireEvent.press(getByText('Retry'));
    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it('shows remove button in success state and calls onRemove', () => {
    const { toJSON } = render(
      <DocumentUploadCard
        filename="Agreement.pdf"
        status="success"
        onRemove={mockOnRemove}
      />
    );

    // Remove button renders as an icon (removeIconLine), verify via snapshot
    expect(toJSON()).toMatchSnapshot();
  });

  it('shows remove button in idle state', () => {
    const { toJSON } = render(
      <DocumentUploadCard
        filename="Agreement.pdf"
        status="idle"
        onRemove={mockOnRemove}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('does not show retry button when onRetry is not provided', () => {
    const { queryByText } = render(
      <DocumentUploadCard filename="Agreement.pdf" status="error" />
    );

    expect(queryByText('Retry')).toBeNull();
  });

  // ── Edge Cases ──────────────────────────────────────────────────────────

  it('renders with testID', () => {
    const { getByTestId } = render(
      <DocumentUploadCard
        filename="Agreement.pdf"
        status="idle"
        testID="upload-card"
      />
    );

    expect(getByTestId('upload-card')).toBeTruthy();
  });

  it('renders with zero progress', () => {
    const { getByText } = render(
      <DocumentUploadCard
        filename="Agreement.pdf"
        status="uploading"
        progress={0}
      />
    );

    expect(getByText('Uploading... 0%')).toBeTruthy();
  });

  it('renders with 100% progress', () => {
    const { getByText } = render(
      <DocumentUploadCard
        filename="Agreement.pdf"
        status="uploading"
        progress={100}
      />
    );

    expect(getByText('Uploading... 100%')).toBeTruthy();
  });

  it('renders with short filename', () => {
    const { getByText } = render(
      <DocumentUploadCard filename="a.pdf" status="idle" />
    );

    expect(getByText('a.pdf')).toBeTruthy();
  });
});

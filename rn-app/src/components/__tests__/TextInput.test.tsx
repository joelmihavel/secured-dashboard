import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TextInput } from '../ui/Input/TextInput';

describe('TextInput', () => {
  const mockOnChangeText = jest.fn();

  beforeEach(() => {
    mockOnChangeText.mockClear();
  });

  it('renders correctly - empty dark variant', () => {
    const { toJSON } = render(
      <TextInput
        label="Full Name"
        value=""
        onChangeText={mockOnChangeText}
        placeholder="Enter your name"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - with value dark variant', () => {
    const { toJSON } = render(
      <TextInput
        label="Full Name"
        value="John Doe"
        onChangeText={mockOnChangeText}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - with error', () => {
    const { toJSON } = render(
      <TextInput
        label="Email"
        value="invalid"
        onChangeText={mockOnChangeText}
        error="Invalid email address"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - disabled', () => {
    const { toJSON } = render(
      <TextInput
        label="Username"
        value="johndoe"
        onChangeText={mockOnChangeText}
        disabled
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - light variant empty', () => {
    const { toJSON } = render(
      <TextInput
        label="Address"
        value=""
        onChangeText={mockOnChangeText}
        placeholder="Enter address"
        variant="light"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - light variant with value', () => {
    const { toJSON } = render(
      <TextInput
        label="City"
        value="Mumbai"
        onChangeText={mockOnChangeText}
        variant="light"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('calls onChangeText when text changes', () => {
    const { getByTestId } = render(
      <TextInput
        label="Name"
        value=""
        onChangeText={mockOnChangeText}
        testID="name-input"
      />
    );

    fireEvent.changeText(getByTestId('name-input'), 'New Value');
    expect(mockOnChangeText).toHaveBeenCalledWith('New Value');
  });

  it('renders testID correctly', () => {
    const { getByTestId } = render(
      <TextInput
        label="Email"
        value=""
        onChangeText={mockOnChangeText}
        testID="email-input"
      />
    );

    expect(getByTestId('email-input')).toBeTruthy();
  });

  it('displays label text', () => {
    const { getByText } = render(
      <TextInput
        label="Password"
        value=""
        onChangeText={mockOnChangeText}
      />
    );

    expect(getByText('Password')).toBeTruthy();
  });

  it('displays error text when error prop is provided', () => {
    const { getByText } = render(
      <TextInput
        label="Email"
        value=""
        onChangeText={mockOnChangeText}
        error="This field is required"
      />
    );

    expect(getByText('This field is required')).toBeTruthy();
  });

  it('does not display error text when error is not provided', () => {
    const { queryByText } = render(
      <TextInput
        label="Email"
        value=""
        onChangeText={mockOnChangeText}
      />
    );

    expect(queryByText('This field is required')).toBeNull();
  });
});

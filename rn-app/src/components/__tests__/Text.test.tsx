import React from 'react';
import { render } from '@testing-library/react-native';
import { Text, Heading1, Heading2, Heading3, Heading5, BodyText, Caption } from '../ui/Typography/Text';

describe('Text', () => {
  // ── Snapshot Tests ──────────────────────────────────────────────────────

  it('renders correctly - default variant (bodyMdRegular)', () => {
    const { toJSON } = render(<Text>Hello World</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - h1 variant', () => {
    const { toJSON } = render(<Text variant="h1">Heading 1</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - h2 variant', () => {
    const { toJSON } = render(<Text variant="h2">Heading 2</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - h3 variant', () => {
    const { toJSON } = render(<Text variant="h3">Heading 3</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - caption variant', () => {
    const { toJSON } = render(<Text variant="caption">Caption text</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  // ── Color Tests ─────────────────────────────────────────────────────────

  it('renders with primary color (default)', () => {
    const { toJSON } = render(<Text>Primary text</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders with secondary color', () => {
    const { toJSON } = render(<Text color="secondary">Secondary</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders with error color', () => {
    const { toJSON } = render(<Text color="error">Error text</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders with accent color', () => {
    const { toJSON } = render(<Text color="accent">Accent text</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders with disabled color', () => {
    const { toJSON } = render(<Text color="disabled">Disabled</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders with muted color', () => {
    const { toJSON } = render(<Text color="muted">Muted</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders with success color', () => {
    const { toJSON } = render(<Text color="success">Success</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders with onAccent color', () => {
    const { toJSON } = render(<Text color="onAccent">On Accent</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  // ── Alignment Tests ─────────────────────────────────────────────────────

  it('renders with center alignment', () => {
    const { toJSON } = render(<Text align="center">Centered</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders with right alignment', () => {
    const { toJSON } = render(<Text align="right">Right aligned</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  // ── Inherit Mode Tests ──────────────────────────────────────────────────

  it('renders in inherit mode - skips variant defaults', () => {
    const { toJSON } = render(
      <Text variant="h1">
        Parent text <Text inherit color="accent">nested span</Text>
      </Text>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders in inherit mode with color override', () => {
    const { toJSON } = render(
      <Text inherit color="error">Error span</Text>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders in inherit mode without color', () => {
    const { toJSON } = render(
      <Text inherit>Inherited text</Text>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  // ── Convenience Component Tests ─────────────────────────────────────────

  it('Heading1 renders correctly', () => {
    const { toJSON } = render(<Heading1>H1 Title</Heading1>);
    expect(toJSON()).toMatchSnapshot();
  });

  it('Heading2 renders correctly', () => {
    const { toJSON } = render(<Heading2>H2 Title</Heading2>);
    expect(toJSON()).toMatchSnapshot();
  });

  it('Heading3 renders correctly', () => {
    const { toJSON } = render(<Heading3>H3 Title</Heading3>);
    expect(toJSON()).toMatchSnapshot();
  });

  it('Heading5 renders correctly', () => {
    const { toJSON } = render(<Heading5>H5 Title</Heading5>);
    expect(toJSON()).toMatchSnapshot();
  });

  it('BodyText renders correctly', () => {
    const { toJSON } = render(<BodyText>Body text content</BodyText>);
    expect(toJSON()).toMatchSnapshot();
  });

  it('Caption renders correctly', () => {
    const { toJSON } = render(<Caption>Caption content</Caption>);
    expect(toJSON()).toMatchSnapshot();
  });

  // ── Custom Style Tests ──────────────────────────────────────────────────

  it('applies custom style prop', () => {
    const { toJSON } = render(
      <Text style={{ marginBottom: 8, fontWeight: 'bold' }}>Styled text</Text>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  // ── Accessibility Tests ─────────────────────────────────────────────────

  it('passes through accessibilityRole prop', () => {
    const { getByRole } = render(
      <Text accessibilityRole="header">Header Text</Text>
    );
    expect(getByRole('header')).toBeTruthy();
  });

  // ── Edge Cases ──────────────────────────────────────────────────────────

  it('renders with empty children', () => {
    const { toJSON } = render(<Text>{''}</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders with number children', () => {
    const { toJSON } = render(<Text>{42}</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders with multiple children', () => {
    const { toJSON } = render(
      <Text>
        Hello {'world'} {123}
      </Text>
    );
    expect(toJSON()).toMatchSnapshot();
  });
});

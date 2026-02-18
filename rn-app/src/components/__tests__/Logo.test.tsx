import React from 'react';
import { render } from '@testing-library/react-native';
import { Logo } from '../ui/Layout/Logo';

describe('Logo', () => {
  // ── Snapshot Tests ──────────────────────────────────────────────────────

  it('renders correctly - default size (48)', () => {
    const { toJSON } = render(<Logo />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - small size (24)', () => {
    const { toJSON } = render(<Logo size={24} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - large size (96)', () => {
    const { toJSON } = render(<Logo size={96} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - custom color', () => {
    const { toJSON } = render(<Logo color="#FF9A6D" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - custom size and color', () => {
    const { toJSON } = render(<Logo size={64} color="#E5484D" />);
    expect(toJSON()).toMatchSnapshot();
  });

  // ── Scaling Tests ───────────────────────────────────────────────────────

  it('scales proportionally based on size prop', () => {
    const { toJSON: toJSONSmall } = render(<Logo size={20} />);
    const { toJSON: toJSONLarge } = render(<Logo size={80} />);

    const smallTree = toJSONSmall();
    const largeTree = toJSONLarge();

    expect(smallTree).not.toEqual(largeTree);
  });

  // ── Edge Cases ──────────────────────────────────────────────────────────

  it('renders with zero size', () => {
    const { toJSON } = render(<Logo size={0} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders with very large size', () => {
    const { toJSON } = render(<Logo size={500} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders with hex color', () => {
    const { toJSON } = render(<Logo color="#00FF00" />);
    expect(toJSON()).toMatchSnapshot();
  });
});

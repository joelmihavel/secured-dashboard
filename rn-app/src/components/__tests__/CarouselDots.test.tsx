import React from 'react';
import { render } from '@testing-library/react-native';
import { CarouselDots } from '../composed/auth/CarouselDots';

describe('CarouselDots', () => {
  // ── Snapshot Tests ──────────────────────────────────────────────────────

  it('renders correctly - 3 dots, first active', () => {
    const { toJSON } = render(
      <CarouselDots count={3} activeIndex={0} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - 3 dots, second active', () => {
    const { toJSON } = render(
      <CarouselDots count={3} activeIndex={1} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - 3 dots, third active', () => {
    const { toJSON } = render(
      <CarouselDots count={3} activeIndex={2} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - single dot', () => {
    const { toJSON } = render(
      <CarouselDots count={1} activeIndex={0} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - 5 dots', () => {
    const { toJSON } = render(
      <CarouselDots count={5} activeIndex={2} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  // ── Structure Tests ─────────────────────────────────────────────────────

  it('renders correct number of dots', () => {
    const { toJSON } = render(
      <CarouselDots count={4} activeIndex={0} />
    );

    const tree = toJSON();
    // Container should have 4 children (dots)
    expect(tree).toBeTruthy();
    if (tree && 'children' in tree && tree.children) {
      expect(tree.children).toHaveLength(4);
    }
  });

  it('renders different active states', () => {
    const { toJSON: tree0 } = render(
      <CarouselDots count={3} activeIndex={0} />
    );
    const { toJSON: tree2 } = render(
      <CarouselDots count={3} activeIndex={2} />
    );

    // Different active indices should produce different snapshots
    expect(tree0()).not.toEqual(tree2());
  });

  // ── Edge Cases ──────────────────────────────────────────────────────────

  it('renders with zero count', () => {
    const { toJSON } = render(
      <CarouselDots count={0} activeIndex={0} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('handles activeIndex out of bounds (greater than count)', () => {
    const { toJSON } = render(
      <CarouselDots count={3} activeIndex={5} />
    );
    // Should render without crash, all dots inactive
    expect(toJSON()).toMatchSnapshot();
  });

  it('handles negative activeIndex', () => {
    const { toJSON } = render(
      <CarouselDots count={3} activeIndex={-1} />
    );
    // Should render without crash, all dots inactive
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders many dots', () => {
    const { toJSON } = render(
      <CarouselDots count={10} activeIndex={5} />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});

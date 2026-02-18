import React from 'react';
import { render } from '@testing-library/react-native';
import { DottedPattern } from '../patterns/DottedPattern';

// Mock image requires
jest.mock('@/src/assets/images/image_149_dotted.png', () => 'dotted-pattern-image');
jest.mock('@/src/assets/images/background_shape.png', () => 'bg-shape-default');
jest.mock('@/src/assets/images/background_shape_splash.png', () => 'bg-shape-splash');
jest.mock('@/src/assets/images/background_shape_carousel1.png', () => 'bg-shape-carousel1');
jest.mock('@/src/assets/images/background_shape_carousel2.png', () => 'bg-shape-carousel2');
jest.mock('@/src/assets/images/background_shape_carousel3.png', () => 'bg-shape-carousel3');
jest.mock('@/src/assets/images/background_shape_agreement.png', () => 'bg-shape-agreement');

describe('DottedPattern', () => {
  // Seed Math.random so SVG gradient brushRef IDs are deterministic
  let mathRandomSpy: jest.SpyInstance;
  beforeEach(() => {
    let seed = 0;
    mathRandomSpy = jest.spyOn(Math, 'random').mockImplementation(() => {
      seed = (seed + 1) % 100;
      return seed / 100;
    });
  });
  afterEach(() => {
    mathRandomSpy.mockRestore();
  });

  // ── Snapshot Tests ──────────────────────────────────────────────────────

  it('renders correctly - default (with shape)', () => {
    const { toJSON } = render(<DottedPattern />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - without shape', () => {
    const { toJSON } = render(<DottedPattern showShape={false} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - splash background shape', () => {
    const { toJSON } = render(<DottedPattern backgroundShape="splash" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - carousel1 background shape', () => {
    const { toJSON } = render(<DottedPattern backgroundShape="carousel1" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - carousel2 background shape', () => {
    const { toJSON } = render(<DottedPattern backgroundShape="carousel2" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - carousel3 background shape', () => {
    const { toJSON } = render(<DottedPattern backgroundShape="carousel3" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - agreement background shape', () => {
    const { toJSON } = render(<DottedPattern backgroundShape="agreement" />);
    expect(toJSON()).toMatchSnapshot();
  });

  // ── Structure Tests ─────────────────────────────────────────────────────

  it('renders as non-interactive overlay (pointerEvents=none)', () => {
    const { toJSON } = render(<DottedPattern />);

    const tree = toJSON();
    expect(tree).toBeTruthy();
    if (tree && 'props' in tree) {
      expect(tree.props.pointerEvents).toBe('none');
    }
  });

  it('hides vector and shape when showShape is false', () => {
    const withShape = render(<DottedPattern showShape={true} />);
    const withoutShape = render(<DottedPattern showShape={false} />);

    // withoutShape should have fewer children than withShape
    const treeWithShape = withShape.toJSON();
    const treeWithoutShape = withoutShape.toJSON();

    expect(treeWithShape).not.toEqual(treeWithoutShape);
  });

  // ── Edge Cases ──────────────────────────────────────────────────────────

  it('renders with custom numeric image source', () => {
    // When backgroundShape is a number (require result), it should be used directly
    const { toJSON } = render(<DottedPattern backgroundShape={42} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders default shape key correctly', () => {
    const { toJSON } = render(<DottedPattern backgroundShape="default" />);
    expect(toJSON()).toMatchSnapshot();
  });
});

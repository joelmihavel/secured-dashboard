import React from 'react';
import { render } from '@testing-library/react-native';
import { CarouselDots } from '../composed/auth/CarouselDots';

describe('CarouselDots', () => {
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

  it('renders correct number of dots', () => {
    const { toJSON } = render(
      <CarouselDots count={4} activeIndex={0} />
    );

    const tree = toJSON();
    expect(tree).toBeTruthy();
    if (tree && 'children' in tree && tree.children) {
      expect(tree.children).toHaveLength(4);
    }
  });

  it('renders with zero count', () => {
    const { toJSON } = render(
      <CarouselDots count={0} activeIndex={0} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders single dot', () => {
    const { toJSON } = render(
      <CarouselDots count={1} activeIndex={0} />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});

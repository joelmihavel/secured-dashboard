const fs = require('fs');
const path = require('path');

function processSvg(filename, componentName) {
  const svgStr = fs.readFileSync(path.join(__dirname, filename), 'utf8');
  
  const viewBoxMatch = svgStr.match(/viewBox="([^"]+)"/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 209 141";
  const [vx, vy, vw, vh] = viewBox.split(' ').map(Number);
  const cx = vx + vw / 2;
  const cy = vy + vh / 2;
  
  const paths = [];
  const regex = /<path\s+d="([^"]+)"/g;
  let match;
  while ((match = regex.exec(svgStr)) !== null) {
    const d = match[1];
    const mMatch = d.match(/M\s*([\d.-]+)[\s,]+([\d.-]+)/);
    if (mMatch) {
      const x = parseFloat(mMatch[1]);
      const y = parseFloat(mMatch[2]);
      // For a more rectangular running trace, we can use perimeter distance,
      // but angle is a very good approximation that guarantees monotonic progress 
      // around the center.
      // Offset by PI/2 so it starts at the top
      let angle = Math.atan2(y - cy, x - cx) + Math.PI / 2;
      if (angle < 0) angle += 2 * Math.PI;
      paths.push({ d, angle, x, y });
    }
  }
  
  paths.sort((a, b) => a.angle - b.angle);
  const sortedPathStrings = paths.map(p => p.d);
  
  const componentStr = `import React, { useEffect } from 'react';
import Svg, { G, Path } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withRepeat, withTiming, Easing } from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const PATHS = ${JSON.stringify(sortedPathStrings, null, 2)};
const TOTAL_DOTS = PATHS.length;
const TRAIL_LENGTH = 5; // A small trail looks better

function Dot({ d, index, progress }) {
  const animatedProps = useAnimatedProps(() => {
    const currentPos = progress.value * TOTAL_DOTS;
    
    let isHighlighted = false;
    let opacity = 0.48;
    let fill = '#DDDDDD';

    // Calculate circular distance
    let dist = currentPos - index;
    if (dist < 0) dist += TOTAL_DOTS;
    
    if (dist < TRAIL_LENGTH) {
      isHighlighted = true;
      // Fade out the trail
      const intensity = 1 - (dist / TRAIL_LENGTH);
      // We can just keep it solid orange for the trail, or just color 1 dot
      // The user asked for "one a time", let's just make the very closest one solid orange
    }

    if (isHighlighted) {
        fill = '#FF9A6D';
        opacity = 1.0;
    }
    
    return {
      fill,
      opacity,
    };
  });

  return <AnimatedPath d={d} animatedProps={animatedProps} />;
}

export default function ${componentName}(props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  return (
    <Svg viewBox="${viewBox}" {...props}>
      {PATHS.map((d, i) => (
        <Dot key={i} d={d} index={i} progress={progress} />
      ))}
    </Svg>
  );
}
`;

  fs.writeFileSync(path.join(__dirname, `../../../src/components/onboarding/${componentName}.tsx`), componentStr);
}

processSvg('illus1.svg', 'Illustration1');
processSvg('illus2.svg', 'Illustration2');
processSvg('illus3.svg', 'Illustration3');
console.log('Done Processing SVGs!');

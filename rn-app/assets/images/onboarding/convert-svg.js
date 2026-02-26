const fs = require('fs');
const path = require('path');

function convertSvg(filename, componentName) {
  const svgStr = fs.readFileSync(path.join(__dirname, filename), 'utf8');
  
  // Extract width, height, viewBox
  const viewBoxMatch = svgStr.match(/viewBox="([^"]+)"/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 209 141";
  
  // Extract paths
  const paths = [];
  const regex = /<path\s+d="([^"]+)"/g;
  let match;
  while ((match = regex.exec(svgStr)) !== null) {
    paths.push(match[1]);
  }
  
  const componentStr = `import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export default function ${componentName}({ activeIndex, progress, ...props }) {
  const paths = ${JSON.stringify(paths, null, 2)};
  
  return (
    <Svg viewBox="${viewBox}" {...props}>
      <G opacity={0.48}>
        {paths.map((d, i) => {
          // Calculate distance from activeIndex (0 to 1)
          // to make a trail effect
          return (
            <Path
              key={i}
              d={d}
              fill={i === activeIndex ? '#FF9A6D' : '#DDDDDD'}
            />
          );
        })}
      </G>
    </Svg>
  );
}
`;

  fs.writeFileSync(path.join(__dirname, `../../../src/components/onboarding/${componentName}.tsx`), componentStr);
}

// ensure directory exists
fs.mkdirSync(path.join(__dirname, '../../../src/components/onboarding'), { recursive: true });

convertSvg('illus1.svg', 'Illustration1');
convertSvg('illus2.svg', 'Illustration2');
convertSvg('illus3.svg', 'Illustration3');

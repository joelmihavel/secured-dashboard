const fs = require('fs');

let code = fs.readFileSync('rn-app/src/components/home/LandlordStatusCard.tsx', 'utf8');

code = code.replace(
  /container: \{\s+backgroundColor: '#1A1A1A', \/\/ Figma: #1A1A1A \(black\[600\]\)\s+borderRadius: 12, \/\/ Figma: borderRadius 12\s+padding: 24, \/\/ Figma: padding 24\s+gap: 8, \/\/ Figma: gap 8\s+\},/m,
  `container: {\n    backgroundColor: '#202020',\n    borderRadius: 12,\n    padding: 16,\n    gap: 16,\n  },`
);

code = code.replace(
  /title: \{\s+fontFamily: 'PlusJakartaSans-Medium', \/\/ Figma: fontWeight 500\s+fontSize: 14, \/\/ Figma: fontSize 14\s+lineHeight: 20, \/\/ Figma: lineHeight 20\s+color: '#FFFFFF', \/\/ Figma: #FFFFFF \(white\)\s+\},/m,
  `title: {\n    fontFamily: 'PlusJakartaSans-Medium',\n    fontSize: 14,\n    lineHeight: 20,\n    color: '#CBCBCB',\n  },`
);

code = code.replace(
  /description: \{\s+fontFamily: 'PlusJakartaSans-Regular', \/\/ Figma: fontWeight 400\s+fontSize: 14, \/\/ Figma: fontSize 14\s+lineHeight: 20, \/\/ Figma: lineHeight 20\s+color: '#BABABA', \/\/ Figma: #BABABA \(neutral\[400\]\)\s+\},/m,
  `description: {\n    fontFamily: 'PlusJakartaSans-Regular',\n    fontSize: 12,\n    lineHeight: 20,\n    color: '#878787',\n  },`
);

code = code.replace(
  /actionLink: \{\s+fontFamily: 'PlusJakartaSans-Regular', \/\/ Figma: fontWeight 400\s+fontSize: 14, \/\/ Figma: fontSize 14\s+lineHeight: 20, \/\/ Figma: lineHeight 20\s+color: '#FF9A6D', \/\/ Figma: #FF9A6D \(brand\[500\]\)\s+textDecorationLine: 'underline',\s+\},/m,
  `actionLink: {\n    fontFamily: 'PlusJakartaSans-SemiBold',\n    fontSize: 12,\n    lineHeight: 20,\n    color: '#FF9A6D',\n    textDecorationLine: 'underline',\n  },`
);

fs.writeFileSync('rn-app/src/components/home/LandlordStatusCard.tsx', code);
console.log('Fixed LandlordStatusCard');

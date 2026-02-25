const fs = require('fs');
let file = fs.readFileSync('rn-app/src/components/home/RentStatusCarousel.tsx', 'utf8');

// The new requirement says the UI has removed "Paying with" and the gap between Headline and Carousel is 24px
// In `parse_12836_output.txt`:
// Frame 2095586343 (FRAME) [684:12837] y=157 | Layout: column, justify flex-start, align center, gap 24
// This is the container holding Headline and Carousel. Gap is 24.
// Headline has NO bottom margin. Carousel has NO top margin.

// I will update the Carousel slightly to remove the bottom spacing and ensure the 24px gap is respected.
file = file.replace(/container: \{\n    gap: 12,\n  \},/, `container: {\n    // Container handles its own margins. The parent gives a 24px gap.\n  },`);
fs.writeFileSync('rn-app/src/components/home/RentStatusCarousel.tsx', file);

const fs = require('fs');

const screens = [
  '243-4258', '243-4462', '243-4666', '243-5074',
  '243-3170', '243-3378', '243-3586', '243-4870'
];

screens.forEach(id => {
  const path = `rn-app/figma-1on1parity/data/${id}-blueprint.json`;
  if (!fs.existsSync(path)) return;
  
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  console.log(`\n=== Screen: ${id} ===`);
  
  // Find interesting frames (Warning Banner, Landlord Status)
  data.nodes.forEach(n => {
    if (n.type === 'TEXT' && n.characters) {
      const text = n.characters.replace(/\n/g, '\\n');
      const fontSize = n.typography?.fontSize || n.style?.fontSize;
      const fill = n.fills?.[0]?.color;
      console.log(`TEXT: "${text}" | ${fontSize}px | color: ${fill}`);
    }
  });
});

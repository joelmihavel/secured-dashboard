const fs = require('fs');
['684-3107', '684-3128', '684-3149'].forEach(id => {
  const data = JSON.parse(fs.readFileSync(`data/blueprints/${id}-blueprint.json`));
  const innerContainer = data.nodes.find(n => n.name === 'Inner Container');
  const textContainer = data.nodes.find(n => n.name === 'Text Container');
  const outerContainer = data.nodes.find(n => n.name === 'Outer Container');
  console.log(`\n=== SLIDE ${id} ===`);
  if (outerContainer) {
    console.log(`Outer Container: x=${outerContainer.geometry.x}, y=${outerContainer.geometry.y}, height=${outerContainer.geometry.height}, paddingTop=${outerContainer.layout.padding.top}, paddingBottom=${outerContainer.layout.padding.bottom}`);
  }
  if (innerContainer) {
    console.log(`Inner Container: gap=${innerContainer.layout.gap}, px=${innerContainer.layout.padding.left}`);
  }
  if (textContainer) {
    console.log(`Text Container: gap=${textContainer.layout.gap}`);
  }
});

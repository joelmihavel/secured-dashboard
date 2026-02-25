const fs = require('fs');
const blueprint = JSON.parse(fs.readFileSync('figma-1on1parity/data/696-8140-blueprint.json', 'utf8'));

const extractText = (node) => {
  let texts = [];
  if (node.type === 'TEXT') {
    texts.push({ name: node.name, content: node.typography?.content, y: node.geometry?.y, size: node.typography?.fontSize, color: node.typography?.color });
  }
  if (node.children) {
    node.children.forEach(c => texts.push(...extractText(c)));
  }
  return texts;
};

const texts = extractText(blueprint.nodes.find(n => n.parentId === null));
texts.forEach(t => console.log(JSON.stringify(t)));

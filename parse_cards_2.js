const fs = require('fs');

const extractText = (node) => {
  if (!node) return [];
  let texts = [];
  if (node.type === 'TEXT') {
    texts.push(node.characters);
  }
  if (node.children) {
    for (const child of node.children) {
      texts = texts.concat(extractText(child));
    }
  }
  return texts;
};

const files = ['figma_flipcards.json', 'figma_front.json'];
for (const file of files) {
  if (fs.existsSync(file)) {
    console.log(`\n\n=== FILE: ${file} ===`);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [key, node] of Object.entries(data.nodes || {})) {
      if (!node.document) continue;
      const texts = extractText(node.document);
      console.log(`\n--- Card: ${node.document.name} ---`);
      console.log(texts.filter(t => t && t.trim().length > 0).join(' | '));
    }
  }
}

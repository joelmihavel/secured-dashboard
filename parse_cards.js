const fs = require('fs');

const extractText = (node) => {
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

const data = JSON.parse(fs.readFileSync('new_cards.json', 'utf8'));
for (const [key, node] of Object.entries(data.nodes || {})) {
  const texts = extractText(node.document);
  console.log(`\n--- Card: ${node.document.name} ---`);
  console.log(texts.filter(t => t.trim().length > 0).join(' | '));
}

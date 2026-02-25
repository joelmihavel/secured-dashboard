const fs = require('fs');
const blueprint = JSON.parse(fs.readFileSync('rn-app/figma-1on1parity/data/684-8639-blueprint.json', 'utf8'));

const findCards = (nodes) => {
  return nodes.filter(n => n.name.startsWith('Card') || n.name.includes('progress') || n.name.includes('setup') || n.type === 'FRAME');
};

const extractText = (node) => {
  let texts = [];
  if (node.type === 'TEXT') texts.push(node.typography?.content || '');
  if (node.children) node.children.forEach(c => texts.push(...extractText(c)));
  return texts.filter(t => t);
};

const carouselNodes = blueprint.nodes.filter(n => n.name === 'Frame 2095586448' || n.name === 'Frame 2095586450');
for (const cn of carouselNodes) {
   console.log('Carousel Node:', cn.name);
   // Not all children are in the node object directly, we should search the flat nodes array
   const children = blueprint.nodes.filter(n => n.parentId === cn.id);
   for (const c of children) {
     console.log('  Child:', c.name);
     const subChildren = blueprint.nodes.filter(n => n.parentId === c.id);
     for (const sc of subChildren) {
       console.log('    Sub:', sc.name, extractText(sc).join(', '));
     }
   }
}

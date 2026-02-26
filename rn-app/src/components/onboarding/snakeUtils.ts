/**
 * Snake Border Animation Utilities
 *
 * Pre-computes which SVG dots are on the perimeter of the card shape
 * and sorts them clockwise for a snake-game-style trailing glow animation.
 *
 * Used by Illustration1, Illustration2, Illustration3 on the carousel screen.
 */

export interface BorderData {
  /** Maps dot index → position in clockwise border order (-1 = interior) */
  borderPosition: number[];
  /** Total number of border dots */
  totalBorder: number;
}

/**
 * Parse the starting (x, y) coordinate from an SVG path "M x y ..." string.
 */
function parseDotCenter(pathD: string): { x: number; y: number } {
  const m = pathD.match(/^M([\d.]+)\s+([\d.]+)/);
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
}

/**
 * Compute clockwise perimeter ordering for a set of SVG dot paths.
 *
 * 1. Parses the position of each dot from its path data
 * 2. Determines the bounding box of all dots
 * 3. Identifies border dots (within THRESHOLD px of any edge)
 * 4. Assigns each border dot to one edge (top/right/bottom/left)
 * 5. Sorts each edge for clockwise traversal:
 *    top (L→R), right (T→B), bottom (R→L), left (B→T)
 * 6. Returns a reverse-mapping from dot index → border position
 */
export function computeBorderData(paths: string[], threshold = 7): BorderData {
  const positions = paths.map(parseDotCenter);

  // Find bounding box
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of positions) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const T = threshold;

  // Classify border dots into edges
  const top: number[] = [];
  const right: number[] = [];
  const bottom: number[] = [];
  const left: number[] = [];

  for (let i = 0; i < positions.length; i++) {
    const { x, y } = positions[i];
    const nearTop = y - minY < T;
    const nearBottom = maxY - y < T;
    const nearLeft = x - minX < T;
    const nearRight = maxX - x < T;

    // Interior dot — skip
    if (!nearTop && !nearBottom && !nearLeft && !nearRight) continue;

    // Assign to ONE edge. Corner dots go to the edge that maintains
    // clockwise flow: TL→top, TR→right, BR→bottom, BL→left.
    if (nearTop && !nearRight) {
      top.push(i);
    } else if (nearRight && !nearBottom) {
      right.push(i);
    } else if (nearBottom && !nearLeft) {
      bottom.push(i);
    } else {
      left.push(i);
    }
  }

  // Sort each edge for clockwise traversal
  top.sort((a, b) => positions[a].x - positions[b].x); // L → R
  right.sort((a, b) => positions[a].y - positions[b].y); // T → B
  bottom.sort((a, b) => positions[b].x - positions[a].x); // R → L
  left.sort((a, b) => positions[b].y - positions[a].y); // B → T

  const borderOrder = [...top, ...right, ...bottom, ...left];

  // Build reverse map: dotIndex → borderPosition (-1 if interior)
  const borderPosition = new Array(paths.length).fill(-1);
  for (let i = 0; i < borderOrder.length; i++) {
    borderPosition[borderOrder[i]] = i;
  }

  return { borderPosition, totalBorder: borderOrder.length };
}

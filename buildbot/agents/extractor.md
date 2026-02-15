# Extractor Agent Instructions

## Identity
You are the Extractor agent. You pull deterministic data from the Figma REST API and produce a Screen Blueprint JSON file.

## Source of Truth
- Figma REST API is the ONLY source of truth
- Never use AI analysis for values
- Never guess or estimate — extract exact values

## API Endpoints
- File key: `HZaVuwWn6B6jOjrmxZ7Kzv`
- Nodes: `GET /v1/files/{key}/nodes?ids={nodeId}&depth=999`
- Images: `GET /v1/images/{key}?ids={nodeIds}&scale=3&format=png`
- Token: Set via `X-Figma-Token` header

## Node ID Format
- Figma uses `1:29914` format
- CLI and filenames use `1-29914` format (colon → hyphen)
- Convert: `id.replace(':', '-')` for files, `id.replace('-', ':')` for API

## Extraction Rules

### Depth
Always use `depth=999` (unlimited). Shallow extraction misses nested components.

### Properties Per Node
Extract ALL of these for every node:
- Identity: nodeId, name, type, visible
- Geometry: x, y, width, height, rotation
- Layout: layoutMode, primaryAxisAlignItems, counterAxisAlignItems, padding*, itemSpacing, layoutSizing*
- Typography (TEXT only): fontSize, fontFamily, fontWeight, lineHeightPx, letterSpacing, textAlignHorizontal, textDecoration, textCase, characters, characterStyleOverrides, styleOverrideTable
- Fills: type, color (RGBA→hex), opacity, gradientStops, gradientHandlePositions, imageRef
- Strokes: color, weight, align, cap, join, dashPattern
- Effects: type, color, offset, blur, spread
- Borders: cornerRadius, rectangleCornerRadii, individualStrokeWeights
- Vectors: fillGeometry path d, strokeGeometry
- Component: componentId, componentProperties

### Font Weight Resolution
```
400 → PlusJakartaSans-Regular
500 → PlusJakartaSans-Medium
600 → PlusJakartaSans-SemiBold
700 → PlusJakartaSans-Bold
```
No other weights exist in the app. If Figma reports 300 or 800, map to nearest.

### Color Conversion
```typescript
// Figma RGBA {r: 0-1, g: 0-1, b: 0-1, a: 0-1} → hex
function figmaColorToHex(c: {r:number, g:number, b:number, a?:number}): string {
  const r = Math.round(c.r * 255).toString(16).padStart(2, '0');
  const g = Math.round(c.g * 255).toString(16).padStart(2, '0');
  const b = Math.round(c.b * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`.toUpperCase();
}
```

### Skip Nodes
- `visible: false` → skip entirely
- Name matches: StatusBar, HW Cutout, SafeArea, Home Indicator → skip
- Nodes outside screen bounds (y > 852 for default frame) → skip

### Design Token Mapping
After extraction, map values to design tokens from `config/design-tokens.json`:
- Colors: hex → `_colorByHex` lookup (e.g., `#FF9A6D` → `colors.brand[500]`)
- Typography: `{fontSize}:{lineHeight}:{fontWeight}` → `_typographyByStyle` lookup
- Spacing: numeric value → `_spacingByValue` lookup
- Radius: numeric value → `_radiusByValue` lookup

## Output
- Blueprint: `data/blueprints/{screenId}-blueprint.json`
- Baseline: `data/baselines/{screenId}-baseline.png`

## Rate Limiting
- Figma API: ~30 requests/minute
- If 429 response: wait 60s, retry up to 3x
- Batch image requests (max 20 node IDs per call)

## Known Pitfalls
- gradientHandlePositions is normalized 0-1, not pixel values
- lineHeightPx is already in px — do NOT multiply by anything
- strokeAlign: INSIDE is default in RN, OUTSIDE needs wrapper
- characterStyleOverrides is 0-indexed per character, not per word

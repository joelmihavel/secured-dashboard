#!/bin/bash

# Pixel-Perfect Comparison Script for FlentSecured
# Usage: ./pixel-compare.sh <figma_screenshot_path> <screen_name>
# Example: ./pixel-compare.sh /path/to/41-4569.png "Home Zero State"

set -e

# Configuration
FIGMA_SCREENSHOT="$1"
SCREEN_NAME="${2:-Unknown Screen}"
OUTPUT_DIR="/Users/atrishabh/Documents/Dev/Secured v2/docs/pixel-comparisons"
SIMULATOR_NAME="iPhone 17"
FIGMA_WIDTH=1179
FUZZ_PERCENT=5
TARGET_DIFF=2.0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Validate input
if [ -z "$FIGMA_SCREENSHOT" ]; then
    echo -e "${RED}Error: Please provide Figma screenshot path${NC}"
    echo "Usage: $0 <figma_screenshot_path> [screen_name]"
    exit 1
fi

if [ ! -f "$FIGMA_SCREENSHOT" ]; then
    echo -e "${RED}Error: Figma screenshot not found: $FIGMA_SCREENSHOT${NC}"
    exit 1
fi

echo "========================================"
echo "Pixel-Perfect Comparison"
echo "Screen: $SCREEN_NAME"
echo "Figma: $FIGMA_SCREENSHOT"
echo "========================================"

# Step 1: Capture simulator screenshot
echo -e "\n${YELLOW}Step 1: Capturing simulator screenshot...${NC}"
SIM_SCREENSHOT="/tmp/simulator_screenshot.png"
xcrun simctl io booted screenshot "$SIM_SCREENSHOT" 2>/dev/null || {
    echo -e "${RED}Error: Failed to capture screenshot. Is simulator booted?${NC}"
    echo "Boot simulator with: xcrun simctl boot '$SIMULATOR_NAME'"
    exit 1
}
echo "Captured: $SIM_SCREENSHOT"

# Step 2: Resize simulator screenshot to match Figma width
echo -e "\n${YELLOW}Step 2: Resizing simulator screenshot to ${FIGMA_WIDTH}px width...${NC}"
SIM_RESIZED="/tmp/sim_resized.png"
magick "$SIM_SCREENSHOT" -resize "${FIGMA_WIDTH}x" "$SIM_RESIZED"
echo "Resized: $SIM_RESIZED"

# Step 3: Get simulator height and crop Figma
echo -e "\n${YELLOW}Step 3: Cropping Figma to match simulator viewport...${NC}"
SIM_HEIGHT=$(identify -format "%h" "$SIM_RESIZED")
echo "Simulator height: ${SIM_HEIGHT}px"

FIGMA_CROPPED="/tmp/figma_cropped.png"
magick "$FIGMA_SCREENSHOT" -crop "${FIGMA_WIDTH}x${SIM_HEIGHT}+0+0" +repage "$FIGMA_CROPPED"
echo "Cropped: $FIGMA_CROPPED"

# Step 4: Calculate pixel difference
echo -e "\n${YELLOW}Step 4: Calculating pixel difference...${NC}"
DIFF_PIXELS=$(magick compare -metric AE -fuzz "${FUZZ_PERCENT}%" "$FIGMA_CROPPED" "$SIM_RESIZED" null: 2>&1) || true
TOTAL_PIXELS=$(identify -format "%[fx:w*h]" "$FIGMA_CROPPED")
DIFF_PERCENT=$(python3 -c "print(f'{($DIFF_PIXELS / $TOTAL_PIXELS) * 100:.2f}')")

echo "Different pixels: $DIFF_PIXELS / $TOTAL_PIXELS"
echo "Pixel difference: ${DIFF_PERCENT}%"

# Step 5: Generate visual diff
echo -e "\n${YELLOW}Step 5: Generating visual diff...${NC}"
DIFF_IMAGE="/tmp/diff.png"
magick compare -highlight-color red -fuzz "${FUZZ_PERCENT}%" "$FIGMA_CROPPED" "$SIM_RESIZED" "$DIFF_IMAGE" || true
echo "Diff image: $DIFF_IMAGE"

# Step 6: Create side-by-side comparison
echo -e "\n${YELLOW}Step 6: Creating side-by-side comparison...${NC}"
COMPARISON_IMAGE="/tmp/comparison.png"
magick "$FIGMA_CROPPED" "$SIM_RESIZED" "$DIFF_IMAGE" +append "$COMPARISON_IMAGE"
echo "Comparison: $COMPARISON_IMAGE"

# Step 7: Copy to output directory with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SAFE_NAME=$(echo "$SCREEN_NAME" | tr ' ' '_' | tr -cd '[:alnum:]_-')
FINAL_COMPARISON="$OUTPUT_DIR/${SAFE_NAME}_${TIMESTAMP}.png"
cp "$COMPARISON_IMAGE" "$FINAL_COMPARISON"
echo "Saved to: $FINAL_COMPARISON"

# Step 8: Evaluate result
echo -e "\n========================================"
if (( $(echo "$DIFF_PERCENT < $TARGET_DIFF" | bc -l) )); then
    echo -e "${GREEN}PASS: Pixel difference ${DIFF_PERCENT}% < ${TARGET_DIFF}%${NC}"
    STATUS="PASS"
else
    echo -e "${RED}FAIL: Pixel difference ${DIFF_PERCENT}% >= ${TARGET_DIFF}%${NC}"
    STATUS="FAIL"
fi
echo "========================================"

# Step 9: Output JSON result for tracking
RESULT_JSON="/tmp/pixel_result.json"
cat > "$RESULT_JSON" << EOF
{
  "screen_name": "$SCREEN_NAME",
  "figma_screenshot": "$FIGMA_SCREENSHOT",
  "timestamp": "$(date -Iseconds)",
  "diff_pixels": $DIFF_PIXELS,
  "total_pixels": $TOTAL_PIXELS,
  "diff_percent": $DIFF_PERCENT,
  "target_percent": $TARGET_DIFF,
  "status": "$STATUS",
  "comparison_image": "$FINAL_COMPARISON"
}
EOF
echo -e "\nResult JSON: $RESULT_JSON"

# Display summary
echo -e "\n${YELLOW}Summary:${NC}"
echo "  Screen: $SCREEN_NAME"
echo "  Pixel Diff: ${DIFF_PERCENT}%"
echo "  Status: $STATUS"
echo "  Comparison: $FINAL_COMPARISON"

exit 0

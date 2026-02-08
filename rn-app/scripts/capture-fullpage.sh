#!/bin/bash
# Full Page Screenshot Capture Script
# Captures screenshots at multiple scroll positions and optionally stitches them

set -e

SCREEN_NAME="${1:-waitlist}"
SCROLL_COUNT="${2:-3}"
OUTPUT_DIR="$(dirname "$0")/../figma-parity/screenshots"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$OUTPUT_DIR"

echo "📸 Capturing full-page screenshot: $SCREEN_NAME"
echo "   Scroll positions: $((SCROLL_COUNT + 1))"
echo "   Output: $OUTPUT_DIR"
echo ""

# Function to capture screenshot
capture() {
    local filename="$1"
    xcrun simctl io booted screenshot "$OUTPUT_DIR/$filename" 2>/dev/null
    echo "  ✓ Captured: $filename"
}

# Function to scroll down using simctl
scroll_down() {
    local pixels="${1:-400}"
    # Swipe from bottom to top (scroll down)
    # Center of screen: 196, swipe from y=700 to y=300
    xcrun simctl io booted swipe 196 700 196 $((700 - pixels)) --delay 0.3 2>/dev/null || true
    sleep 0.5
    echo "  ↓ Scrolled down ${pixels}px"
}

# Function to scroll up (to reset)
scroll_up() {
    local pixels="${1:-400}"
    xcrun simctl io booted swipe 196 200 196 $((200 + pixels)) --delay 0.3 2>/dev/null || true
    sleep 0.3
}

# Scroll to top first
echo "↑ Scrolling to top..."
for i in {1..10}; do
    scroll_up 200
done
sleep 1

# Capture screenshots at each position
CAPTURED_FILES=()
for i in $(seq 0 $SCROLL_COUNT); do
    pos=$((i + 1))
    filename="${SCREEN_NAME}_${TIMESTAMP}_${pos}of$((SCROLL_COUNT + 1)).png"

    echo ""
    echo "[$pos/$((SCROLL_COUNT + 1))] Position $((i * 350))px"
    capture "$filename"
    CAPTURED_FILES+=("$OUTPUT_DIR/$filename")

    if [ $i -lt $SCROLL_COUNT ]; then
        scroll_down 350
    fi
done

# Try to stitch images with ImageMagick if available
echo ""
if command -v convert &> /dev/null; then
    echo "🔗 Stitching images with ImageMagick..."

    STITCHED_FILE="$OUTPUT_DIR/${SCREEN_NAME}_${TIMESTAMP}_full.png"

    # For stitching, we need to crop overlap from subsequent images
    TEMP_FILES=()
    for i in "${!CAPTURED_FILES[@]}"; do
        if [ $i -eq 0 ]; then
            TEMP_FILES+=("${CAPTURED_FILES[$i]}")
        else
            # Crop top 100px overlap from subsequent images
            CROPPED="${CAPTURED_FILES[$i]%.png}_cropped.png"
            convert "${CAPTURED_FILES[$i]}" -crop +0+150 "$CROPPED"
            TEMP_FILES+=("$CROPPED")
        fi
    done

    # Stitch vertically
    convert "${TEMP_FILES[@]}" -append "$STITCHED_FILE"

    # Cleanup temp files
    for f in "${TEMP_FILES[@]}"; do
        if [[ "$f" == *"_cropped.png" ]]; then
            rm -f "$f"
        fi
    done

    echo "✓ Stitched: $STITCHED_FILE"
else
    echo "⚠ ImageMagick not found. Individual screenshots saved."
    echo "  Install with: brew install imagemagick"
fi

echo ""
echo "✅ Done! Screenshots:"
for f in "${CAPTURED_FILES[@]}"; do
    echo "   $f"
done

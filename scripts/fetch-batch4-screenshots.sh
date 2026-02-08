#!/bin/bash
# fetch-batch4-screenshots.sh
# Fetches all 22 Figma screenshots for Batch 4 analysis
#
# Usage: ./fetch-batch4-screenshots.sh
# Requires: FIGMA_ACCESS_TOKEN environment variable
#
# Author: UI Designer Agent
# Date: 2026-01-31

set -e

# Configuration
FIGMA_FILE_KEY="HZaVuwWn6B6jOjrmxZ7Kzv"
OUTPUT_DIR="./figma_baselines/batch4"
SCALE=3
FORMAT="png"

# Check for token
if [ -z "$FIGMA_ACCESS_TOKEN" ]; then
    echo "Error: FIGMA_ACCESS_TOKEN environment variable not set"
    echo "Please set your Figma token: export FIGMA_ACCESS_TOKEN='your-token-here'"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Node IDs and names mapping
declare -A SCREENS=(
    ["243:4870"]="01-home-default-state"
    ["243:5074"]="02-home-variant-a"
    ["243:5277"]="03-home-variant-b"
    ["243:5483"]="04-home-variant-c"
    ["243:5689"]="05-profile-section"
    ["243:5870"]="06-home-active-state"
    ["243:6083"]="07-home-state-d"
    ["243:6296"]="08-home-state-e"
    ["243:6490"]="09-home-state-f"
    ["243:6731"]="10-setup-sheet-initial"
    ["243:6971"]="11-setup-sheet-variant"
    ["243:7185"]="12-transaction-history"
    ["243:7397"]="13-transaction-variant-a"
    ["243:7398"]="14-transaction-variant-b"
    ["243:7463"]="15-payment-transaction"
    ["1:31756"]="16-flow-screen-step1"
    ["1:31757"]="17-flow-screen-step2"
    ["1:31758"]="18-flow-screen-step3"
    ["1:33737"]="19-success-screen"
    ["1:34150"]="20-success-variant"
    ["1:34236"]="21-error-screen"
    ["1:34343"]="22-error-variant"
)

echo "========================================"
echo "  Figma Batch 4 Screenshot Fetcher"
echo "========================================"
echo ""
echo "File Key: $FIGMA_FILE_KEY"
echo "Output: $OUTPUT_DIR"
echo "Scale: ${SCALE}x"
echo ""

# Counter for progress
TOTAL=${#SCREENS[@]}
CURRENT=0
SUCCESS=0
FAILED=0

# Fetch each screenshot
for NODE_ID in "${!SCREENS[@]}"; do
    ((CURRENT++))
    SCREEN_NAME="${SCREENS[$NODE_ID]}"
    OUTPUT_FILE="$OUTPUT_DIR/${SCREEN_NAME}.png"

    echo "[$CURRENT/$TOTAL] Fetching: $SCREEN_NAME"
    echo "         Node: $NODE_ID"

    # Get image URL from Figma API
    RESPONSE=$(curl -s -H "X-Figma-Token: $FIGMA_ACCESS_TOKEN" \
        "https://api.figma.com/v1/images/$FIGMA_FILE_KEY?ids=$NODE_ID&scale=$SCALE&format=$FORMAT")

    # Extract image URL
    IMAGE_URL=$(echo "$RESPONSE" | jq -r ".images[\"$NODE_ID\"]")

    if [ "$IMAGE_URL" == "null" ] || [ -z "$IMAGE_URL" ]; then
        echo "         ERROR: Could not get image URL"
        echo "         Response: $RESPONSE"
        ((FAILED++))
        echo ""
        continue
    fi

    # Download the image
    HTTP_CODE=$(curl -s -w "%{http_code}" -o "$OUTPUT_FILE" "$IMAGE_URL")

    if [ "$HTTP_CODE" == "200" ]; then
        FILE_SIZE=$(ls -lh "$OUTPUT_FILE" | awk '{print $5}')
        echo "         SUCCESS: $OUTPUT_FILE ($FILE_SIZE)"
        ((SUCCESS++))
    else
        echo "         ERROR: HTTP $HTTP_CODE downloading image"
        ((FAILED++))
    fi

    # Rate limiting - Figma API has limits
    sleep 0.5
    echo ""
done

echo "========================================"
echo "  Summary"
echo "========================================"
echo "Total:   $TOTAL screens"
echo "Success: $SUCCESS"
echo "Failed:  $FAILED"
echo ""
echo "Screenshots saved to: $OUTPUT_DIR"
echo ""

if [ $FAILED -gt 0 ]; then
    echo "WARNING: Some screenshots failed to download"
    exit 1
fi

echo "All screenshots fetched successfully!"

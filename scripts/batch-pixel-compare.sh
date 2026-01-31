#!/bin/bash

# Batch Pixel-Perfect Comparison Script for FlentSecured
# Processes all screens in the tracking document
# Usage: ./batch-pixel-compare.sh [group_number]
# Example: ./batch-pixel-compare.sh 1  # Only Group 1 (Onboarding)
# Example: ./batch-pixel-compare.sh     # All groups

set -e

# Configuration
FIGMA_SCREENS_DIR="/private/tmp/claude-501/-Users-atrishabh-Documents-Dev/02a8fb93-1b76-4373-9d05-447368f836a9/scratchpad/figma_screens"
OUTPUT_DIR="/Users/atrishabh/Documents/Dev/Secured v2/docs/pixel-comparisons"
RESULTS_FILE="/Users/atrishabh/Documents/Dev/Secured v2/docs/pixel-results.json"
PROJECT_DIR="/Users/atrishabh/Documents/Dev/Secured v2/ios/FlentSecured"
SIMULATOR_NAME="iPhone 17"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Initialize results file
echo '{"screens": [], "summary": {}}' > "$RESULTS_FILE"

# Screen mapping: Node ID -> Screen Name
declare -A SCREEN_NAMES=(
    # Group 1: Onboarding & Splash
    ["1-28055"]="Splash"
    ["1-28985"]="Onboarding 1"
    ["1-29025"]="Onboarding 2"
    ["1-29065"]="Onboarding 3"
    ["1-29108"]="Onboarding 4"

    # Group 2: Authentication
    ["1-28071"]="Phone Entry"
    ["1-28053"]="Phone Entry Variant"
    ["1-31590"]="OTP Screen"
    ["1-31752"]="Auth Component"
    ["1-34343"]="Auth State 1"
    ["1-34150"]="Auth State 2"
    ["1-33737"]="Auth State 3"
    ["1-34236"]="Auth State 4"

    # Group 3: Agreement Upload
    ["1-29914"]="Upload Initial"
    ["1-30001"]="Upload Progress"
    ["1-30268"]="Error File Too Large"
    ["1-30178"]="Error Invalid Expired"
    ["1-30358"]="Manual Review"
    ["1-30090"]="Upload Success"

    # Group 4: Setup Flow
    ["41-10859"]="Upload Address Proof"
    ["41-11006"]="Invite Landlord"
    ["41-10712"]="Setup Variant"
    ["41-4969"]="Waiting Landlord"
    ["41-5587"]="Landlord Declined"
    ["41-4301"]="Setup Step 1"
    ["41-4559"]="Setup Step 2"
    ["41-4323"]="Setup Step 3"
    ["41-4345"]="Setup Step 4"
    ["41-4430"]="Setup Step 5"
    ["41-4515"]="Setup Step 6"
    ["41-4537"]="Setup Step 7"

    # Group 5: Home Dashboard
    ["41-4569"]="Home Zero State"
    ["41-6385"]="Home UPI Cashbacks"
    ["41-6598"]="Home Variant 1"
    ["41-6811"]="Home Variant 2"
    ["41-3677"]="Home Overdue"
    ["41-3472"]="Home State 1"
    ["41-5792"]="Home State 2"
    ["41-5998"]="Home State 3"
    ["41-6204"]="Home State 4"
    ["41-3186"]="Home State 5"
    ["41-3267"]="Home State 6"
    ["41-5175"]="Home State 7"
    ["41-5381"]="Home State 8"
    ["41-3885"]="Home State 9"
    ["41-4093"]="Home State 10"

    # Group 6: Payment Method Selection
    ["41-7005"]="Choose Payment Method"
    ["41-9114"]="Payment Method Fees"
    ["41-7246"]="Payment Selection 1"
    ["41-7460"]="Payment Selection 2"
    ["41-7674"]="Payment Card 1"
    ["41-7675"]="Payment Card 2"
    ["41-7676"]="Payment Card 3"
    ["41-7741"]="Payment Method 4"
    ["41-8367"]="Profile Section Header"
    ["41-8369"]="Payment Profile"

    # Group 7: Payment Flow
    ["41-9746"]="Payment Breakdown"
    ["41-9635"]="Payment State 1"
    ["41-9460"]="Payment State 2"
    ["41-9563"]="Payment Confirmation"
    ["41-9681"]="Payment State 3"
    ["41-9511"]="Payment State 4"
    ["41-8612"]="Payment State 5"
    ["41-8693"]="Payment State 6"
    ["41-8695"]="Payment State 7"
    ["41-8760"]="Payment State 8"
    ["41-8880"]="Payment State 9"
    ["41-8901"]="Payment State 10"

    # Group 8: Application Status
    ["41-11206"]="Welcome In Review"
    ["41-11825"]="Setting Things Up"
    ["1-30820"]="Status Confirmation"

    # Group 9: Transactions
    ["41-3184"]="Transactions Header"
    ["41-9004"]="Transaction State 1"
    ["41-9307"]="Transaction State 2"
    ["41-9388"]="Transaction State 3"
    ["41-9811"]="Transaction Detail"

    # Group 10: Profile & Settings
    ["1-31277"]="Profile Main"
    ["1-31073"]="Settings 1"
    ["1-31175"]="Settings 2"
    ["1-31380"]="Settings 3"
    ["1-31485"]="Settings 4"

    # Group 11: Misc
    ["1-31671"]="Misc State 1"
    ["1-31753"]="Component 1"
    ["1-31754"]="Component 2"
    ["1-31756"]="Component 3"
    ["1-31757"]="Component 4"
    ["1-31758"]="Component 5"
    ["1-30448"]="State"
    ["41-4765"]="Modal 1"
    ["41-8450"]="Modal 2"
    ["41-8529"]="Modal 3"
)

# Group mapping for filtering
declare -A SCREEN_GROUPS=(
    ["1-28055"]=1 ["1-28985"]=1 ["1-29025"]=1 ["1-29065"]=1 ["1-29108"]=1
    ["1-28071"]=2 ["1-28053"]=2 ["1-31590"]=2 ["1-31752"]=2 ["1-34343"]=2 ["1-34150"]=2 ["1-33737"]=2 ["1-34236"]=2
    ["1-29914"]=3 ["1-30001"]=3 ["1-30268"]=3 ["1-30178"]=3 ["1-30358"]=3 ["1-30090"]=3
    ["41-10859"]=4 ["41-11006"]=4 ["41-10712"]=4 ["41-4969"]=4 ["41-5587"]=4 ["41-4301"]=4 ["41-4559"]=4 ["41-4323"]=4 ["41-4345"]=4 ["41-4430"]=4 ["41-4515"]=4 ["41-4537"]=4
    ["41-4569"]=5 ["41-6385"]=5 ["41-6598"]=5 ["41-6811"]=5 ["41-3677"]=5 ["41-3472"]=5 ["41-5792"]=5 ["41-5998"]=5 ["41-6204"]=5 ["41-3186"]=5 ["41-3267"]=5 ["41-5175"]=5 ["41-5381"]=5 ["41-3885"]=5 ["41-4093"]=5
    ["41-7005"]=6 ["41-9114"]=6 ["41-7246"]=6 ["41-7460"]=6 ["41-7674"]=6 ["41-7675"]=6 ["41-7676"]=6 ["41-7741"]=6 ["41-8367"]=6 ["41-8369"]=6
    ["41-9746"]=7 ["41-9635"]=7 ["41-9460"]=7 ["41-9563"]=7 ["41-9681"]=7 ["41-9511"]=7 ["41-8612"]=7 ["41-8693"]=7 ["41-8695"]=7 ["41-8760"]=7 ["41-8880"]=7 ["41-8901"]=7
    ["41-11206"]=8 ["41-11825"]=8 ["1-30820"]=8
    ["41-3184"]=9 ["41-9004"]=9 ["41-9307"]=9 ["41-9388"]=9 ["41-9811"]=9
    ["1-31277"]=10 ["1-31073"]=10 ["1-31175"]=10 ["1-31380"]=10 ["1-31485"]=10
    ["1-31671"]=11 ["1-31753"]=11 ["1-31754"]=11 ["1-31756"]=11 ["1-31757"]=11 ["1-31758"]=11 ["1-30448"]=11 ["41-4765"]=11 ["41-8450"]=11 ["41-8529"]=11
)

# Filter by group if specified
FILTER_GROUP="$1"

# Statistics
TOTAL=0
PASSED=0
FAILED=0
SKIPPED=0

echo "========================================"
echo "Batch Pixel-Perfect Comparison"
echo "========================================"

if [ -n "$FILTER_GROUP" ]; then
    echo "Filtering to Group $FILTER_GROUP only"
fi

echo ""

# Check if simulator is running
if ! xcrun simctl list | grep -q "$SIMULATOR_NAME.*Booted"; then
    echo -e "${YELLOW}Warning: Simulator '$SIMULATOR_NAME' is not booted${NC}"
    echo "Boot it with: xcrun simctl boot '$SIMULATOR_NAME'"
    echo ""
fi

# Process each screen
for figma_file in "$FIGMA_SCREENS_DIR"/*.png; do
    if [ ! -f "$figma_file" ]; then
        continue
    fi

    # Extract node ID from filename
    filename=$(basename "$figma_file" .png)

    # Skip if filtering and not in group
    if [ -n "$FILTER_GROUP" ]; then
        group="${SCREEN_GROUPS[$filename]:-0}"
        if [ "$group" != "$FILTER_GROUP" ]; then
            continue
        fi
    fi

    screen_name="${SCREEN_NAMES[$filename]:-$filename}"

    ((TOTAL++))

    echo -e "${BLUE}[$TOTAL] Processing: $screen_name ($filename)${NC}"

    # Check if Figma file exists
    if [ ! -s "$figma_file" ]; then
        echo -e "  ${YELLOW}SKIPPED: Empty file${NC}"
        ((SKIPPED++))
        continue
    fi

    # Note: In a real run, you would navigate to the screen first
    # This is a placeholder for manual verification
    echo "  Figma: $figma_file"
    echo "  Action: Navigate to screen in simulator, then press Enter to capture"
    # read -p "  Press Enter when ready (or 's' to skip): " response

    # For now, just mark as pending
    echo -e "  ${YELLOW}PENDING: Manual navigation required${NC}"
    ((SKIPPED++))

    echo ""
done

# Summary
echo "========================================"
echo "Summary"
echo "========================================"
echo "Total screens: $TOTAL"
echo -e "Passed (<2% diff): ${GREEN}$PASSED${NC}"
echo -e "Failed (>=2% diff): ${RED}$FAILED${NC}"
echo -e "Skipped: ${YELLOW}$SKIPPED${NC}"
echo ""
echo "Results saved to: $RESULTS_FILE"
echo "Comparisons saved to: $OUTPUT_DIR"

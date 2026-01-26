# Lottie Animations

This directory contains Lottie JSON animation files used throughout the app.

## Required Animations

| File | Usage | Loop Mode |
|------|-------|-----------|
| `loading.json` | General loading states | Loop |
| `payment_success.json` | Payment successful screen | Play Once |
| `payment_failed.json` | Payment failed screen | Play Once |
| `confetti.json` | Celebration effects | Play Once |
| `processing.json` | Payment processing | Loop |
| `empty.json` | Empty state backgrounds | Loop |
| `success.json` | Generic success checkmark | Play Once |
| `error.json` | Generic error state | Play Once |

## Animation Sources

Recommended sources for Lottie animations:
- [LottieFiles](https://lottiefiles.com/)
- [IconScout](https://iconscout.com/lottie-animations)

## Guidelines

1. **File Size**: Keep animations under 100KB for performance
2. **Colors**: Ensure animations match the app's color scheme or can be tinted
3. **Duration**: Loading animations should be 1-2 seconds
4. **Frame Rate**: 30fps is sufficient for most animations

## Adding New Animations

1. Download/export the Lottie JSON file
2. Add to this directory with descriptive name
3. Add static factory method in `LottieView.swift`
4. Test on device for performance

## Placeholder Note

If animation files are not available, the app will show fallback SF Symbols icons.
Add actual Lottie JSON files before production release.

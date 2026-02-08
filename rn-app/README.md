# Flent Secured - React Native

React Native (Expo) implementation of Flent Secured, a rent payment app.

## Tech Stack

- **Framework**: Expo SDK 52+ with expo-router v4
- **Styling**: NativeWind v4 (Tailwind for React Native)
- **Animations**: React Native Reanimated 3
- **State**: Zustand
- **Backend**: Supabase

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

### Font Setup

Download Plus Jakarta Sans fonts and place them in `assets/fonts/`:
- PlusJakartaSans-Regular.ttf
- PlusJakartaSans-Medium.ttf
- PlusJakartaSans-SemiBold.ttf
- PlusJakartaSans-Bold.ttf

## Project Structure

```
rn-app/
├── app/                    # expo-router screens
│   ├── (auth)/            # Auth flow
│   │   ├── splash.tsx     # Get Started screen
│   │   ├── beta-splash.tsx# Beta launch splash
│   │   ├── carousel.tsx   # Onboarding carousel
│   │   ├── sign-up.tsx    # Sign up form
│   │   └── otp.tsx        # OTP verification
│   └── (main)/            # Main app
├── src/
│   ├── components/        # UI components
│   │   ├── ui/           # Design system primitives
│   │   ├── composed/     # Feature components
│   │   └── patterns/     # Background patterns
│   ├── theme/            # Design tokens
│   ├── hooks/            # Custom hooks
│   ├── services/         # API layer
│   ├── stores/           # Zustand stores
│   └── utils/            # Utilities
└── assets/               # Static assets
```

## Implemented Screens

All screens match Figma designs pixel-perfectly:

| Screen | Figma Node | Status |
|--------|------------|--------|
| Splash (Get Started) | 1-28055 | ✅ Done |
| Beta Splash | 1-28071 | ✅ Done |
| Carousel Slide 1 | 1-28985 | ✅ Done |
| Carousel Slide 2 | 1-29025 | ✅ Done |
| Carousel Slide 3 | 1-29065 | ✅ Done |
| Sign Up (Empty) | 1-29108 | ✅ Done |
| Sign Up (Filled) | 1-31073 | ✅ Done |
| Sign Up (Error: Exists) | 1-31671 | ✅ Done |
| Sign Up (Error: Invalid) | 1-31590 | ✅ Done |
| OTP (Empty) | 1-31175 | ✅ Done |
| OTP (Filled) | 1-31277 | ✅ Done |
| OTP (Error: Wrong Code) | 1-31485 | ✅ Done |
| OTP (Error: Attempts) | 1-31380 | ✅ Done |

## Design System

### Colors
- Primary background: `#131313`
- Brand accent: `#FF9A6D`
- Error: `#FF8080`

### Typography
- Font: Plus Jakarta Sans
- Variants: h1-h6, bodyLg, bodyMd, bodySm, button

### Spacing
- Scale: 2, 4, 8, 12, 16, 24, 32, 40, 48, 64

## Development

```bash
# Type check
npx tsc --noEmit

# Lint
npm run lint
```

## Build

```bash
# Create development build
npx expo build:ios
npx expo build:android

# Or use EAS Build
npx eas build --platform ios
npx eas build --platform android
```

## License

Proprietary - Flent Technologies

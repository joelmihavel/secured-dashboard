/**
 * Dotted Pattern Component
 * Background pattern matching Figma design exactly
 *
 * CORRECTED Figma Reference (Node 1:31073 - Sign Up Filled):
 * From get_design_context (2026-02-01):
 *
 * image 149 (237:2737):
 * - Outer container: `-translate-x-1/2 -translate-y-1/2 absolute flex h-[2346px] items-center justify-center left-1/2 top-1/2 w-[1319px]`
 * - Inner flex: `flex-none rotate-90`
 * - Image div: `h-[1319px] relative w-[2346px]` with `opacity-8`
 * - CENTERED BOTH HORIZONTALLY AND VERTICALLY
 *
 * Background Shape (174:2668):
 * - Position: `-translate-x-1/2 absolute h-[405px] left-1/2 top-0 w-[481px]`
 * - Opacity: 40% on inner image
 * - Gradient overlay: from transparent (39.691%) to #131313 (79.383%)
 *
 * Vector 1 (1:31075):
 * - Position: `absolute flex h-[400px] items-center justify-center right-[-120.56px] top-0 w-[333.751px]`
 * - Transform: `-scale-y-100` (flipped vertically)
 */

import React, { memo } from 'react';
import { View, StyleSheet, Dimensions, Image } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Path,
} from 'react-native-svg';

import { colors } from '@/src/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Figma exported images
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dottedPatternImage = require('@/src/assets/images/image_149_dotted.png');

// Screen-specific background shapes from Figma
// Each screen has a unique silhouette/image in the "Background Shape" node
// eslint-disable-next-line @typescript-eslint/no-var-requires
const backgroundShapeDefault = require('@/src/assets/images/background_shape.png');
// Splash screen specific background shape (from Figma MCP 2026-02-01)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const backgroundShapeSplash = require('@/src/assets/images/background_shape_splash.png');
// Carousel screen 1: "Earn 1% back" (1-28985) - handshake silhouette
// Fresh from Figma MCP (2026-02-01): 5df9fbe5-ae78-4ef0-b08d-c5bb737d3e68
// eslint-disable-next-line @typescript-eslint/no-var-requires
const backgroundShapeCarousel1 = require('@/src/assets/images/background_shape_carousel1.png');
// Carousel screen 2: "More than just cashback" (1-29025) - room/scene silhouette
// Fresh from Figma MCP (2026-02-01): 7f79858a-de05-496f-be2c-a24a67dcfc79
// eslint-disable-next-line @typescript-eslint/no-var-requires
const backgroundShapeCarousel2 = require('@/src/assets/images/background_shape_carousel2.png');
// Carousel screen 3: "Your landlord benefits too" (1-29065) - unique silhouette
// Fresh from Figma MCP (2026-02-01): 796c84ec-68db-43a2-bc90-98950e37900c
// eslint-disable-next-line @typescript-eslint/no-var-requires
const backgroundShapeCarousel3 = require('@/src/assets/images/background_shape_carousel3.png');
// Agreement upload screen (1-29914) - handshake silhouette
// eslint-disable-next-line @typescript-eslint/no-var-requires
const backgroundShapeAgreement = require('@/src/assets/images/background_shape_agreement.png');
// Waitlist screen (41-11206) - hand signing document
// eslint-disable-next-line @typescript-eslint/no-var-requires
const backgroundShapeWaitlist = require('@/src/assets/images/background_shape_waitlist.png');
// Post Approval Carousel 1
// eslint-disable-next-line @typescript-eslint/no-var-requires
const backgroundShapePostApproval1 = require('@/src/assets/images/background_shape_postapproval1.png');
// Post Approval Carousel 2
// eslint-disable-next-line @typescript-eslint/no-var-requires
const backgroundShapePostApproval2 = require('@/src/assets/images/background_shape_postapproval2.png');
// Post Approval Carousel 3
// eslint-disable-next-line @typescript-eslint/no-var-requires
const backgroundShapePostApproval3 = require('@/src/assets/images/background_shape_postapproval3.png');
// Personalized Cashback Plan Summary
// eslint-disable-next-line @typescript-eslint/no-var-requires
const backgroundShapeSummary = require('@/src/assets/images/background_shape_summary.png');

// Background shape options for different screens
export const BACKGROUND_SHAPES = {
  // Splash screen: "Make your rent work for you" (1-28055)
  // Fresh from Figma MCP: d6f863f9-3f9b-438e-993e-4a1bbe6112ee
  splash: backgroundShapeSplash,
  // Carousel screen 1: "Earn 1% back" (1-28985) - handshake silhouette
  // Fresh from Figma MCP (2026-02-01): h-[113.35%] left-[-7.02%] top-[-6.67%] w-[129.27%]
  carousel1: backgroundShapeCarousel1,
  // Carousel screen 2: "More than just cashback" (1-29025) - room/scene silhouette
  // Fresh from Figma MCP (2026-02-01): 7f79858a-de05-496f-be2c-a24a67dcfc79
  carousel2: backgroundShapeCarousel2,
  // Carousel screen 3: "Your landlord benefits too" (1-29065) - unique silhouette
  // Fresh from Figma MCP (2026-02-01): 796c84ec-68db-43a2-bc90-98950e37900c
  carousel3: backgroundShapeCarousel3,
  // Agreement upload screen (1-29914) - handshake silhouette
  agreement: backgroundShapeAgreement,
  // Waitlist screen
  waitlist: backgroundShapeWaitlist,
  // Post approval step 1
  postapproval1: backgroundShapePostApproval1,
  // Post approval step 2
  postapproval2: backgroundShapePostApproval2,
  // Post approval step 3
  postapproval3: backgroundShapePostApproval3,
  // Summary (Cashback Plan)
  summary: backgroundShapeSummary,
  // Default fallback
  default: backgroundShapeDefault,
} as const;

export type BackgroundShapeKey = keyof typeof BACKGROUND_SHAPES;

// Vector 1 SVG path data from Figma (node 1:31075)
const VECTOR_1_PATH = "M124.751 400H37.2631V212.062H0V160.217H37.2631C16.5252 79.8576 75.0667 31.6855 106.93 17.6445C200.25 -31.6081 297.028 33.8457 333.751 72.7293V400H246.263V116.473C195.714 33.5216 132.312 52.7474 106.93 72.7293C74.5266 128.462 120.431 154.277 147.433 160.217H192.798V212.062H124.751V400Z";

// EXACT Figma dimensions from get_design_context
// Container: outer wrapper that's centered on screen
// Image: actual image size before rotation
const FIGMA = {
  // Outer container: w-[1319px] h-[2346px], centered via left-1/2 top-1/2 -translate-x/y-1/2
  container: {
    width: 1319,
    height: 2346,
  },
  // Inner image: w-[2346px] h-[1319px], rotate-90, opacity-8
  image: {
    width: 2346,
    height: 1319,
    opacity: 0.08,
  },
  // Background shape: w-[481px] h-[405px], left-1/2 top-0 -translate-x-1/2, opacity-40
  // Corrected from Figma REST API imageTransform: [[0.6544, 0, 0.0503], [0, 0.8255, 0.2095]]
  shape: {
    width: 481,
    height: 405,
    opacity: 0.4,
    // Image positioning derived from Figma REST API imageTransform (node 1:29109)
    // imageWidth = 1/scaleX = 1/0.6544 = 1.5281 (152.81% of container)
    // imageHeight = 1/scaleY = 1/0.8255 = 1.2114 (121.14% of container)
    // imageLeft = -(translateX/scaleX) = -(0.0503/0.6544) = -0.07693
    // imageTop = -(translateY/scaleY) = -(0.2095/0.8255) = -0.25382
    imageWidth: 1.5281,    // 152.81% of container width
    imageHeight: 1.2114,   // 121.14% of container height
    imageLeft: -0.07693,   // -7.69% offset from left
    imageTop: -0.25382,    // -25.38% offset from top
  },
  // Vector 1: w-[333.751px] h-[400px], right-[-120.56px] top-0, -scale-y-100
  vector1: {
    width: 333.751,
    height: 400,
    rightOffset: -120.56,
  },
} as const;

export interface DottedPatternProps {
  /** Whether to show the background shape overlay */
  showShape?: boolean;
  /** Screen-specific background shape key or custom image source */
  backgroundShape?: BackgroundShapeKey | number;
  /** The previous shape to render beneath for crossfading transitions */
  previousBackgroundShape?: BackgroundShapeKey | number;
  /** Optional animated opacity style for the primary shape image (useful for crossfades) */
  animatedOpacityStyle?: any;
}

function DottedPatternComponent({
  showShape = true,
  backgroundShape = 'default',
  previousBackgroundShape,
  animatedOpacityStyle,
}: DottedPatternProps) {
  // Resolve background image - either from preset keys or custom source
  const backgroundShapeImage = typeof backgroundShape === 'string'
    ? BACKGROUND_SHAPES[backgroundShape]
    : backgroundShape;
    
  const previousShapeImage = typeof previousBackgroundShape === 'string'
    ? BACKGROUND_SHAPES[previousBackgroundShape]
    : previousBackgroundShape;
    
  const gradientId = `shapeGradient-${Math.random().toString(36).slice(2)}`;
  
  // Shared styles for shape image
  const getShapeStyle = (shapeKey: BackgroundShapeKey | number) => {
    if (shapeKey === 'waitlist') {
      return {
        width: FIGMA.shape.width,
        height: FIGMA.shape.height,
        left: 0,
        top: 0,
      };
    }
    return {
      width: FIGMA.shape.width * FIGMA.shape.imageWidth,
      height: FIGMA.shape.height * FIGMA.shape.imageHeight,
      left: FIGMA.shape.width * FIGMA.shape.imageLeft,
      top: FIGMA.shape.height * FIGMA.shape.imageTop,
    };
  };

  return (
    <View style={styles.container} pointerEvents="none">
      {/* image 149: Full-screen dotted pattern - rotated 90°, centered, 8% opacity */}
      <View style={styles.dottedPatternContainer}>
        <Image
          source={dottedPatternImage}
          style={[
            styles.dottedPatternImage,
            { transform: [{ rotate: '90deg' }] }
          ]}
          resizeMode="cover"
        />
      </View>

      {/* Background Shape: CENTER-TOP position (left-1/2, top-0), 40% opacity */}
      {/* Image is LARGER than container and offset per Figma: h-121.14% w-152.81% left--7.69% top--25.38% */}
      {showShape && (
        <View style={styles.shapeContainer}>
          {previousShapeImage && (
             <Image
               source={previousShapeImage}
               style={[styles.shapeImage, getShapeStyle(previousBackgroundShape as any)]}
               resizeMode="cover"
             />
          )}
          {animatedOpacityStyle ? (
             // @ts-ignore (Animated.Image supports style array)
             <Animated.Image
               source={backgroundShapeImage}
               style={[styles.shapeImage, getShapeStyle(backgroundShape), animatedOpacityStyle]}
               resizeMode="cover"
             />
          ) : (
             <Image
               source={backgroundShapeImage}
               style={[styles.shapeImage, getShapeStyle(backgroundShape)]}
               resizeMode="cover"
             />
          )}
          {/* Gradient overlay: transparent to #131313 */}
          <Svg
            width={FIGMA.shape.width}
            height={FIGMA.shape.height}
            style={StyleSheet.absoluteFill}
          >
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0.5" stopColor="transparent" stopOpacity={0} />
                <Stop offset="1.0" stopColor={colors.black[700]} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect
              x="0"
              y="0"
              width={FIGMA.shape.width}
              height={FIGMA.shape.height}
              fill={`url(#${gradientId})`}
            />
          </Svg>
        </View>
      )}

      {/* Vector 1: TOP-RIGHT position (right-[-120.56px] top-0), flipped vertically */}
      {showShape && (
        <View style={styles.vector1Container}>
          <Svg
            width={FIGMA.vector1.width}
            height={FIGMA.vector1.height}
            viewBox={`0 0 ${FIGMA.vector1.width} ${FIGMA.vector1.height}`}
            style={styles.vector1Svg}
          >
            <Path
              d={VECTOR_1_PATH}
              fill="white"
              opacity={0.01}
            />
          </Svg>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
    overflow: 'hidden',
  },
  // image 149: Figma shows container w-[1319px] h-[2346px] centered (left-1/2 top-1/2 -translate-x/y-1/2)
  // The inner image is w-[2346px] h-[1319px] then rotate-90
  dottedPatternContainer: {
    position: 'absolute',
    width: FIGMA.container.width,  // 1319px from Figma container
    height: FIGMA.container.height, // 2346px from Figma container
    left: (SCREEN_WIDTH - FIGMA.container.width) / 2,   // Center horizontally
    top: (SCREEN_HEIGHT - FIGMA.container.height) / 2,  // Center vertically
    opacity: FIGMA.image.opacity,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dottedPatternImage: {
    width: FIGMA.image.width,   // 2346px (before rotation)
    height: FIGMA.image.height, // 1319px (before rotation)
  },
  // Background Shape: CENTER-TOP position per Figma MCP (left-1/2 -translate-x-1/2 top-0)
  // 481x405px, 40% opacity, overflow-hidden to clip the larger image
  shapeContainer: {
    position: 'absolute',
    top: 0,
    left: (SCREEN_WIDTH - FIGMA.shape.width) / 2, // Horizontally centered
    width: FIGMA.shape.width,
    height: FIGMA.shape.height,
    opacity: FIGMA.shape.opacity,
    overflow: 'hidden', // Figma: overflow-hidden on inner container
  },
  // Shape image - Figma: positioned LARGER than container with offset
  // h-[121.14%] w-[152.81%] left-[-7.69%] top-[-25.38%]
  shapeImage: {
    position: 'absolute',
    // Dimensions set inline using FIGMA.shape.image* values
  },
  // Vector 1: TOP-RIGHT position per Figma MCP (right-[-120.56px] top-0, -scale-y-100)
  // 333.751x400px, extends past right edge, flipped vertically
  vector1Container: {
    position: 'absolute',
    top: 0,
    right: FIGMA.vector1.rightOffset, // -120.56px (extends past screen edge)
    width: FIGMA.vector1.width,
    height: FIGMA.vector1.height,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vector1Svg: {
    transform: [{ scaleY: -1 }], // -scale-y-100 (flip vertically)
  },
});

export const DottedPattern = memo(DottedPatternComponent);

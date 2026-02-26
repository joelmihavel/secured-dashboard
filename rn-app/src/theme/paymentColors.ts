/**
 * Shared Payment Flow Color Tokens
 *
 * Consolidates the repeated color definitions across payment screens:
 * - confirm.tsx (was `C`)
 * - status.tsx (was `FIGMA_COLORS`)
 * - PaymentReceiptCard.tsx (was `CARD_COLORS`)
 *
 * All values sourced from Figma and mapped to the canonical `colors` tokens.
 */

import { colors } from './colors';

export const PAYMENT_COLORS = {
  // ── Backgrounds ──────────────────────────────────────────────
  background: colors.black[700],        // #131313
  cardBackground: colors.black[500],    // #202020
  cardDivider: colors.black[600],       // #1A1A1A
  paperclip: colors.black[400],         // #4D4D4D

  // ── Text ─────────────────────────────────────────────────────
  white: colors.white,                  // #FFFFFF
  accent: colors.brand[500],            // #FF9A6D (brand accent, hash icon)
  labelText: colors.neutral[600],       // #878787 (receipt row labels)
  valueText: colors.neutral[300],       // #CBCBCB (receipt row values)
  highlightText: colors.neutral[200],   // #DDDDDD (payable values, cashback notes)
  mutedText: colors.neutral[500],       // #A9A9A9 (footer text, info text)
  brightText: colors.neutral[100],      // #EEEEEE (timer highlight)

  // ── Borders / Dividers ───────────────────────────────────────
  divider: colors.black[400],           // #4D4D4D

  // ── Stamp Colors (status-specific) ───────────────────────────
  successStamp: colors.success.approved, // #06C270
  successStampBorder: colors.success.dark, // #27803B
  failedStamp: colors.error.default,     // #FF8080
  refundedStamp: colors.neutral[500],    // #A9A9A9
  pendingStamp: '#C7C9D9',              // light gray-blue (no exact token)

  // ── Cashback ─────────────────────────────────────────────────
  cashbackBg: colors.black[600],         // #1A1A1A
  cashbackText: colors.neutral[200],     // #DDDDDD
  cashbackDeduct: '#EF9194',             // error-light (cashback deduction line)
} as const;

export type PaymentColorKey = keyof typeof PAYMENT_COLORS;

# Design System — Flent Secured

Single source of truth for all design decisions. Developers writing new UI should reference this file.

---

## Visual Tokens

### Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `colors.black[700]` | `#131313` | App background |
| `colors.black[500]` | `#202020` | Cards, containers |
| `colors.black[600]` | `#1A1A1A` | Banners, pills |
| `colors.brand[500]` | `#FF9A6D` | Brand accent, CTAs, highlights |
| `colors.neutral[600]` | `#878787` | Secondary labels |
| `colors.neutral[500]` | `#A9A9A9` | Tertiary labels, inactive states |
| | `#CBCBCB` | Primary values |
| | `#DDDDDD` | Emphasized values |
| `colors.success.material` | `#06C270` | Success states |
| `colors.error.radix` | `#E5484D` | Error states |
| `#FF8080` | | Failed stamps |
| `#FFC04D` | | Warning states |

### Typography

**Font family:** PlusJakartaSans

| Weight | Name | Usage |
|--------|------|-------|
| 400 | Regular | Body text, descriptions, placeholders |
| 500 | Medium | Labels, subtitles, secondary headings |
| 600 | SemiBold | Primary headings, card titles |
| 700 | Bold | Emphasis, key values |

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 8 | Tight gaps, icon padding |
| `sm` | 12 | Compact spacing |
| `md` | 16 | Standard padding, card padding |
| `lg` | 24 | Section gaps |
| `xl` | 32 | Large gaps |
| `xxl` | 40 | Screen-level spacing |
| `xxxl` | 48 | Major section breaks |
| `huge` | 64 | Hero spacing |

---

## Text Style Guide

### Casing

| UI element | Convention | Example |
|------------|-----------|---------|
| Screen headings | Sentence case | "Add your bank account" |
| Card titles | Sentence case | "Landlord invitation sent" |
| Body / descriptions | Sentence case | "Most landlords respond after a quick reminder" |
| Buttons / CTAs | Sentence case | "Get started", "Contact support", "Confirm & continue" |
| Form labels | Sentence case | "Account number", "PAN card", "Username" |
| Placeholders | Sentence case | "Enter account number", "e.g. 1234567890" |
| Status badges / labels | All lowercase | "paid", "failed", "pending", "initiated", "settled" |
| Progress steps | All lowercase | "initiated", "processing", "settled" |
| Navigation tabs | Sentence case | "Home", "Payments", "Profile" |
| Error messages | Sentence case | "This card has expired" |
| Notification titles | Sentence case | "Your landlord got paid" |
| Notification bodies | Sentence case | "Pay early, earn cashback" |

### Punctuation

| Rule | Convention | Example |
|------|-----------|---------|
| Single-sentence text | No trailing period | "Payment successful" |
| Multi-sentence text | Period between, no trailing period | "Your rent has been paid. You'll receive confirmation shortly" |
| Buttons | Never any punctuation | "Pay now" |
| Error + action | Period between, no trailing | "Payment failed. Try a different method" |
| Exclamation marks | Max 1 per screen, celebrations only | "Your first cashback is here!" |
| Ellipsis | In-progress states only | "Processing..." |
| Question marks | Allowed (functional) | "How to invite your landlord?" |
| Colons after labels | Never | "Share with" not "Share with:" |
| Ampersands in buttons | Use "&" to save space | "Confirm & continue", "Terms & conditions" |

### Error Messages

Follow the pattern: **[What happened] + [What to do]**

```
Validation:    "Enter a valid UPI ID"
Network:       "Unable to connect. Check your internet and try again"
Payment fail:  "Payment could not be completed. Try a different method"
Generic:       "Something went wrong. Please try again"
```

Never use: "Oops!", "Uh oh!", technical error codes, or accusatory language.

### Voice and Tone

- **Use contractions**: "You'll", "We've", "can't" — not "You will", "We have"
- **Address as "you"**: never passive voice or "the user"
- **Refer to Flent as "we"** when needed, but focus on the user
- **Active voice preferred**: "We've sent your payment" not "Your payment has been sent"
- **No financial jargon** where avoidable
- **Tone**: Warm and competent — more approachable than a bank, not as casual as a chat app

### Status Label Vocabulary

| State | Label | Color context |
|-------|-------|---------------|
| Payment complete | "paid" | Green |
| Payment processing | "processing" | Amber |
| Payment failed | "failed" | Red |
| Payment pending | "pending" | Amber |
| Settlement complete | "settled" | Green |
| Settlement failed | "settlement failed" | Red |
| Refunded | "refunded" | Gray |
| Setup step done | "completed" | Green |
| Setup step pending | "pending" | Gray |
| Verification in progress | "in review" | Amber |
| Verified | "verified" | Green |
| Cashback received | "received" | Default |
| Cashback locked | "accrued" | Amber |
| Cashback missed | "missed" | Default |

### Button Label Vocabulary

| Action | Label |
|--------|-------|
| Move forward | "Continue" |
| Submit payment | "Pay rent" or "Pay Rs 25,000" |
| Confirm action | "Confirm" or "Confirm and continue" |
| Cancel action | "Cancel" |
| Dismiss informational | "Got it" |
| Retry after error | "Try again" |
| Skip optional step | "Skip for now" |
| Complete flow | "Done" |
| Learn more | "Learn more" |
| Contact help | "Contact support" |

---

## Component Patterns

### Shared UI Components

Always reuse from `@/src/components/ui/` — never rebuild:
- `Text` (Typography)
- `Button`
- `Input` / `PhoneInput`
- `Pill`
- `FileUpload`

### Background Pattern

Each screen has its own Figma background asset via `DottedPattern`. Available `backgroundShape` keys: `splash`, `carousel1-3`, `agreement`, `default`. Don't use `default` blindly.

### Dark Theme

All UI is dark-theme only. Background `#131313`, cards `#202020`, no light mode.

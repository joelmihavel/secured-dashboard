/**
 * receiptHtml.ts
 *
 * Generates a complete HTML string for a rent payment receipt PDF.
 * Designed for use with expo-print (WebKit renderer on iOS/Android).
 *
 * Design language: Dark theme matching Flent Secured app design system.
 * Background #131313, secondary #1A1A1A, brand accent #FF9A6D.
 * Optimised for A4 PDF output with PlusJakartaSans embedded fonts.
 */

import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReceiptHtmlData {
  receiptNumber: string;
  payment: {
    amount: number;
    pgFee: number;
    paymentMethod: string | null;
    paidAt: string;
    rentMonthDisplay: string;
    utr: string | null;
    timeliness: 'on_time' | 'late' | null;
    transactionId: string | null;
  };
  tenant: {
    name: string;
    phone: string | null;
    email: string | null;
  };
  property: {
    address: string;
    city: string | null;
  };
  landlord: {
    name: string;
    pan: string | null;
  };
  agreement: {
    certId: string | null;
  };
}

export interface ReceiptFonts {
  regular: string;
  medium: string;
  semiBold: string;
  bold: string;
}

// ---------------------------------------------------------------------------
// Font Loading
// ---------------------------------------------------------------------------

let cachedFonts: ReceiptFonts | null = null;

export async function loadReceiptFonts(): Promise<ReceiptFonts | null> {
  if (cachedFonts) return cachedFonts;

  try {
    const [regularAsset, mediumAsset, semiBoldAsset, boldAsset] = await Promise.all([
      Asset.fromModule(require('../../assets/fonts/PlusJakartaSans-Regular.ttf')).downloadAsync(),
      Asset.fromModule(require('../../assets/fonts/PlusJakartaSans-Medium.ttf')).downloadAsync(),
      Asset.fromModule(require('../../assets/fonts/PlusJakartaSans-SemiBold.ttf')).downloadAsync(),
      Asset.fromModule(require('../../assets/fonts/PlusJakartaSans-Bold.ttf')).downloadAsync(),
    ]);

    const [regular, medium, semiBold, bold] = await Promise.all([
      FileSystem.readAsStringAsync(regularAsset.localUri!, { encoding: FileSystem.EncodingType.Base64 }),
      FileSystem.readAsStringAsync(mediumAsset.localUri!, { encoding: FileSystem.EncodingType.Base64 }),
      FileSystem.readAsStringAsync(semiBoldAsset.localUri!, { encoding: FileSystem.EncodingType.Base64 }),
      FileSystem.readAsStringAsync(boldAsset.localUri!, { encoding: FileSystem.EncodingType.Base64 }),
    ]);

    cachedFonts = { regular, medium, semiBold, bold };
    return cachedFonts;
  } catch (error) {
    console.warn('[receiptHtml] Failed to load receipt fonts:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatIndianAmount(value: number): string {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function esc(value: string | null | undefined): string {
  if (value == null) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Design tokens (inline for PDF -- no external deps)
// ---------------------------------------------------------------------------

const C = {
  bg: '#131313',
  secondaryBg: '#1A1A1A',
  border: '#4D4D4D',
  accent: '#FF9A6D',
  accentLight: '#FFAE8A',
  label: '#878787',
  value: '#CBCBCB',
  highlight: '#DDDDDD',
  muted: '#A9A9A9',
  white: '#FFFFFF',
  success: '#06C270',
  error: '#FF8080',
} as const;

// ---------------------------------------------------------------------------
// SVG Logos
// ---------------------------------------------------------------------------

const LOGO_HEADER = `<div class="logo-neo"><svg width="42" height="42" viewBox="0 0 172.46 172.46" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Flent logo"><path d="M86.23,0h0C38.61,0,0,38.61,0,86.23v86.23h172.46v-86.23C172.46,38.61,133.85,0,86.23,0ZM123.43,140.61h-21.36v-69.79s-5.15-15.08-22.64-15.08c-7.82,0-14.74,5.28-14.74,12.1,0,8.18,6.07,14.02,16.57,14.02h7.58v12.56h-16.57v46.2h-21.36v-46.2h-9.36v-12.44l9.34-.03c-5.67-19.35,9.86-39.16,34.74-39.16,19.57,0,32.94,11.5,37.79,17.81v80.02Z" fill="${C.accent}"/></svg></div>`;

const LOGO_FOOTER = `<svg width="16" height="18" viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Flent logo"><path d="M0 56V24C0 10.745 10.745 0 24 0C37.255 0 48 10.745 48 24V56Z" fill="${C.border}"/><g transform="translate(7,10)"><path d="M12.4751 40H3.72631V21.2062H0V16.0217H3.72631C1.65252 7.98576 7.50667 3.16855 10.693 1.76445C20.025 -3.16081 29.7028 3.38457 33.3751 7.27293V40H24.6263V11.6473C19.5714 3.35216 13.2312 5.27474 10.693 7.27293C7.45266 12.8463 12.0431 15.4277 14.7433 16.0217H19.2798V21.2062H12.4751V40Z" fill="${C.bg}"/></g></svg>`;

// ---------------------------------------------------------------------------
// Font Face Declarations
// ---------------------------------------------------------------------------

function buildFontFaceCSS(fonts: ReceiptFonts): string {
  return `
    @font-face {
      font-family: 'PlusJakartaSans';
      font-weight: 400;
      font-style: normal;
      src: url(data:font/truetype;base64,${fonts.regular}) format('truetype');
    }
    @font-face {
      font-family: 'PlusJakartaSans';
      font-weight: 500;
      font-style: normal;
      src: url(data:font/truetype;base64,${fonts.medium}) format('truetype');
    }
    @font-face {
      font-family: 'PlusJakartaSans';
      font-weight: 600;
      font-style: normal;
      src: url(data:font/truetype;base64,${fonts.semiBold}) format('truetype');
    }
    @font-face {
      font-family: 'PlusJakartaSans';
      font-weight: 700;
      font-style: normal;
      src: url(data:font/truetype;base64,${fonts.bold}) format('truetype');
    }
    @font-face {
      font-family: 'PlusJakartaSans';
      font-weight: 800;
      font-style: normal;
      src: url(data:font/truetype;base64,${fonts.bold}) format('truetype');
    }`;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildReceiptHtml(receipt: ReceiptHtmlData, fonts?: ReceiptFonts | null): string {
  const { payment, tenant, property, landlord, agreement } = receipt;

  // Transaction reference: prefer UTR, fall back to transactionId, hide if both null
  const transactionRef = payment.utr ?? payment.transactionId ?? null;

  // Property line
  const propertyLine = property.city
    ? `${esc(property.address)}, ${esc(property.city)}`
    : esc(property.address);

  // Payment method display
  const methodDisplay = payment.paymentMethod
    ? payment.paymentMethod.toUpperCase()
    : null;


  // Font face CSS (only if fonts are provided)
  const fontFaceCSS = fonts ? buildFontFaceCSS(fonts) : '';

  // Timeliness badge removed — keeping receipt minimal

  // Detail rows for payment section
  let paymentDetailsHtml = '';

  // Rent Month (always first, no top border)
  paymentDetailsHtml += `
        <div class="detail-row">
          <span class="detail-label">Rent Month</span>
          <span class="detail-value" style="font-weight:600;">${esc(payment.rentMonthDisplay)}</span>
        </div>`;

  // Rent Amount
  paymentDetailsHtml += `
        <div class="detail-row">
          <span class="detail-label">Rent Amount</span>
          <span class="detail-value">&#8377;${esc(formatIndianAmount(payment.amount))}</span>
        </div>`;

  // Payment Method
  paymentDetailsHtml += `
        <div class="detail-row">
          <span class="detail-label">Payment Method</span>
          <span class="detail-value detail-value-method">${methodDisplay ? esc(methodDisplay) : '&mdash;'}</span>
        </div>`;

  // Transaction Ref / UTR (always show)
  paymentDetailsHtml += `
        <div class="detail-row">
          <span class="detail-label">UTR / Transaction Ref</span>
          <span class="detail-value detail-value-mono">${transactionRef ? esc(transactionRef) : 'N/A'}</span>
        </div>`;

  // Landlord PAN (always shown as line item)
  paymentDetailsHtml += `
        <div class="detail-row">
          <span class="detail-label">Landlord PAN</span>
          <span class="detail-value" style="letter-spacing:1px;">${landlord.pan ? esc(landlord.pan) : 'N/A'}</span>
        </div>`;

  // Tenant details section (line items)
  let tenantSectionHtml = `
        <div class="divider"></div>
        <section>
          <div class="section-header">Tenant</div>
          <div class="detail-row">
            <span class="detail-label">Name</span>
            <span class="detail-value" style="font-weight:600;">${esc(tenant.name) || '&mdash;'}</span>
          </div>`;
  if (tenant.phone) {
    tenantSectionHtml += `
          <div class="detail-row">
            <span class="detail-label">Phone</span>
            <span class="detail-value">${esc(tenant.phone)}</span>
          </div>`;
  }
  if (tenant.email) {
    tenantSectionHtml += `
          <div class="detail-row">
            <span class="detail-label">Email</span>
            <span class="detail-value" style="word-break:break-word;">${esc(tenant.email)}</span>
          </div>`;
  }
  tenantSectionHtml += `
        </section>`;

  // Landlord details section (line items)
  const landlordSectionHtml = `
        <div class="divider"></div>
        <section>
          <div class="section-header">Landlord</div>
          <div class="detail-row">
            <span class="detail-label">Name</span>
            <span class="detail-value" style="font-weight:600;">${esc(landlord.name) || '&mdash;'}</span>
          </div>
        </section>`;

  // Property & Agreement section (always shown)
  const propertySectionHtml = `
        <div class="divider"></div>
        <section>
          <div class="section-header">Property &amp; Agreement</div>
          <div class="detail-row">
            <span class="detail-label">Address</span>
            <span class="detail-value" style="word-break:break-word;text-align:right;max-width:280px;">${propertyLine || 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Agreement ID</span>
            <span class="detail-value detail-value-mono">${agreement.certId ? esc(agreement.certId) : 'N/A'}</span>
          </div>
        </section>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Rent Receipt - ${esc(receipt.receiptNumber)}</title>
<style>
  ${fontFaceCSS}

  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 0; }

  body {
    background: ${C.bg};
    font-family: 'PlusJakartaSans', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    color: ${C.value};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .container {
    max-width: 540px;
    margin: 0 auto;
    padding: 40px 32px;
  }

  /* Dividers */
  .divider {
    height: 1px;
    background: rgba(77, 77, 77, 0.4);
    margin: 24px 0;
  }

  /* ----- HEADER ----- */
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .logo-neo {
    width: 42px;
    height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(4px 4px 8px rgba(0, 0, 0, 0.6))
            drop-shadow(-2px -2px 6px rgba(255, 255, 255, 0.03))
            drop-shadow(0 0 12px rgba(255, 154, 109, 0.15));
  }
  .brand-text {
    font-size: 14px;
    font-weight: 500;
    color: ${C.white};
    letter-spacing: 0.3px;
  }
  .brand-text-flent {
    font-weight: 700;
  }
  .receipt-meta {
    text-align: right;
  }
  .receipt-number {
    font-size: 11px;
    font-weight: 600;
    color: ${C.muted};
    font-variant-numeric: tabular-nums;
  }
  .receipt-date {
    font-size: 10px;
    font-weight: 400;
    color: ${C.border};
    margin-top: 2px;
  }

  /* ----- HERO ----- */
  .hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .hero-left {
    display: flex;
    flex-direction: column;
  }
  .hero-label {
    font-size: 10px;
    font-weight: 500;
    color: ${C.border};
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-bottom: 8px;
  }
  .hero-amount {
    font-size: 36px;
    font-weight: 700;
    color: ${C.white};
    letter-spacing: -1px;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .hero-currency {
    font-size: 20px;
    font-weight: 300;
    color: ${C.label};
    vertical-align: top;
    position: relative;
    top: 2px;
    margin-right: 2px;
  }
  .hero-datetime {
    font-size: 11px;
    font-weight: 400;
    color: ${C.border};
    margin-top: 10px;
  }
  .hero-right {
    display: flex;
    align-items: center;
  }
  .paid-stamp {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 2.5px solid ${C.success};
    border-radius: 8px;
    padding: 8px 16px;
    transform: rotate(-4deg);
    -webkit-transform: rotate(-4deg);
  }
  .paid-stamp-text {
    font-size: 18px;
    font-weight: 800;
    color: ${C.success};
    letter-spacing: 4px;
    line-height: 1;
  }

  /* ----- SECTIONS ----- */
  .section-header {
    font-size: 9px;
    font-weight: 600;
    color: ${C.border};
    text-transform: uppercase;
    letter-spacing: 2.5px;
    margin-bottom: 16px;
  }

  /* ----- DETAIL ROWS ----- */
  .detail-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px 0;
  }
  .detail-row + .detail-row {
    border-top: 1px solid rgba(77, 77, 77, 0.15);
  }
  .detail-label {
    font-size: 12px;
    font-weight: 400;
    color: ${C.label};
  }
  .detail-value {
    font-size: 12px;
    font-weight: 500;
    color: ${C.value};
    text-align: right;
    word-break: break-word;
  }
  .detail-value-method {
    font-size: 11px;
    font-weight: 600;
    color: ${C.accent};
    letter-spacing: 0.5px;
  }
  .detail-value-mono {
    font-size: 10px;
    font-weight: 400;
    color: ${C.label};
    font-family: monospace;
    word-break: break-word;
    max-width: 240px;
    letter-spacing: 0.5px;
  }


  /* ----- FOOTER ----- */
  footer {
    padding-top: 16px;
    border-top: 1px solid rgba(77, 77, 77, 0.25);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .footer-brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .footer-brand-text {
    font-size: 10px;
    font-weight: 500;
    color: ${C.border};
  }
  .footer-brand-text-flent {
    color: rgba(255, 154, 109, 0.4);
  }
  .footer-note {
    font-size: 8px;
    font-weight: 400;
    color: rgba(77, 77, 77, 0.8);
    text-align: right;
    max-width: 220px;
    line-height: 1.5;
  }
</style>
</head>
<body>

<div class="container">

  <!-- HEADER -->
  <header>
    <div class="brand">
      ${LOGO_HEADER}
      <span class="brand-text">Secured by Flent</span>
    </div>
    <div class="receipt-meta">
      <div class="receipt-number">${esc(receipt.receiptNumber)}</div>
      <div class="receipt-date">${esc(formatDate(payment.paidAt))}</div>
    </div>
  </header>

  <div class="divider"></div>

  <!-- MAIN -->
  <main>

    <!-- HERO -->
    <section class="hero">
      <div class="hero-left">
        <div class="hero-label">Amount Paid</div>
        <div class="hero-amount">
          <span class="hero-currency">&#8377;</span>${esc(formatIndianAmount(payment.amount))}
        </div>
        <div class="hero-datetime">${esc(formatDate(payment.paidAt))}&nbsp;&middot;&nbsp;${esc(formatTime(payment.paidAt))}</div>
      </div>
      <div class="hero-right">
        <div class="paid-stamp"><span class="paid-stamp-text">PAID</span></div>
      </div>
    </section>

    <div class="divider"></div>

    <!-- PAYMENT DETAILS -->
    <section>
      <div class="section-header">Payment Details</div>
      ${paymentDetailsHtml}
    </section>

    ${tenantSectionHtml}

    ${landlordSectionHtml}

    ${propertySectionHtml}

  </main>

  <div class="divider"></div>

  <!-- FOOTER -->
  <footer>
    <div class="footer-brand">
      ${LOGO_FOOTER}
      <span class="footer-brand-text">Secured by <span class="footer-brand-text-flent">Flent</span></span>
    </div>
    <div class="footer-note">
      Computer-generated receipt.<br/>Does not require a signature.
    </div>
  </footer>

</div>

</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Fallback builder (when server receipt data is unavailable)
// ---------------------------------------------------------------------------

interface FallbackReceiptParams {
  amount?: string;
  method?: string;
  transactionId?: string;
  landlordName?: string;
  agreementId?: string;
  paymentId?: string;
}

export function buildFallbackReceiptData(params: FallbackReceiptParams): ReceiptHtmlData {
  const amountNum = parseFloat((params.amount ?? '0').replace(/,/g, '')) || 0;
  const receiptNumber = params.paymentId
    ? `FR-${params.paymentId.slice(-8).toUpperCase()}`
    : `FR-${Date.now().toString().slice(-8)}`;

  const now = new Date();
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const rentMonth = `${months[now.getMonth()]} ${now.getFullYear()}`;

  return {
    receiptNumber,
    payment: {
      amount: amountNum,
      pgFee: 0,
      paymentMethod: params.method ?? null,
      paidAt: now.toISOString(),
      rentMonthDisplay: rentMonth,
      utr: null,
      timeliness: null,
      transactionId: params.transactionId ?? null,
    },
    tenant: {
      name: '',
      phone: null,
      email: null,
    },
    property: {
      address: '',
      city: null,
    },
    landlord: {
      name: params.landlordName ?? '',
      pan: null,
    },
    agreement: {
      certId: params.agreementId ?? null,
    },
  };
}

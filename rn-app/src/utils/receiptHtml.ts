/**
 * receiptHtml.ts
 *
 * Generates a complete HTML string for a rent payment receipt PDF.
 * Designed for use with expo-print (WebKit renderer on iOS/Android).
 *
 * Design language: Dark theme matching Flent Secured app design system.
 * Background #131313, cards #202020, brand accent #FF9A6D.
 * Optimised for A4/Letter PDF output.
 */

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
    panMasked: string | null;
  };
  property: {
    address: string;
    city: string | null;
  };
  landlord: {
    name: string;
    panMasked: string | null;
  };
  agreement: {
    certId: string | null;
  };
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
// Design tokens (inline for PDF — no external deps)
// ---------------------------------------------------------------------------

const C = {
  bg: '#0E0E0E',
  cardBg: '#181818',
  card: '#1E1E1E',
  cardBorder: '#2A2A2A',
  cardBorderLight: '#333333',
  accent: '#FF9A6D',
  accentLight: '#FFAE8A',
  accentDim: 'rgba(255,154,109,0.12)',
  accentDimBorder: 'rgba(255,154,109,0.25)',
  textPrimary: '#E0E0E0',
  textSecondary: '#A9A9A9',
  textMuted: '#777777',
  textDim: '#555555',
  divider: '#272727',
  successGreen: '#34D399',
  successBg: 'rgba(52,211,153,0.10)',
  successBorder: 'rgba(52,211,153,0.25)',
  errorRed: '#F87171',
  errorBg: 'rgba(248,113,113,0.10)',
  white: '#FFFFFF',
  pillBg: '#2A2A2A',
} as const;

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildReceiptHtml(receipt: ReceiptHtmlData): string {
  const { payment, tenant, property, landlord, agreement } = receipt;

  const transactionRef = payment.utr
    ? payment.utr
    : payment.transactionId
      ? payment.transactionId
      : 'N/A';

  const propertyLine = property.city
    ? `${esc(property.address)}, ${esc(property.city)}`
    : esc(property.address);

  const methodDisplay = payment.paymentMethod
    ? payment.paymentMethod.toUpperCase()
    : 'N/A';

  const timelinessBadge =
    payment.timeliness === 'on_time'
      ? `<span class="badge badge-success">ON TIME</span>`
      : payment.timeliness === 'late'
        ? `<span class="badge badge-late">LATE</span>`
        : '';

  const totalPaid = payment.amount + payment.pgFee;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Rent Receipt - ${esc(receipt.receiptNumber)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 0; }
  body {
    background: ${C.bg};
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    color: ${C.textPrimary};
    padding: 40px 32px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .container {
    max-width: 540px;
    margin: 0 auto;
  }

  /* Brand header */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 28px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .brand-name {
    font-size: 20px;
    font-weight: 700;
    color: ${C.white};
    letter-spacing: -0.3px;
  }
  .brand-name span { color: ${C.accent}; }
  .brand-sub {
    font-size: 9px;
    color: ${C.textMuted};
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-top: 2px;
  }
  .receipt-meta {
    text-align: right;
  }
  .receipt-meta .label {
    font-size: 9px;
    color: ${C.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }
  .receipt-meta .value {
    font-size: 12px;
    font-weight: 600;
    color: ${C.textPrimary};
    font-variant-numeric: tabular-nums;
    margin-top: 1px;
  }
  .receipt-meta .date {
    font-size: 11px;
    color: ${C.textSecondary};
    margin-top: 2px;
  }

  /* Main card */
  .main-card {
    background: ${C.card};
    border: 1px solid ${C.cardBorder};
    border-radius: 16px;
    overflow: hidden;
  }
  .accent-bar {
    height: 3px;
    background: linear-gradient(90deg, ${C.accent} 0%, ${C.accentLight} 50%, ${C.accent} 100%);
  }
  .card-body {
    padding: 28px 28px 24px;
  }

  /* Hero amount section */
  .hero {
    background: ${C.bg};
    border: 1px solid ${C.cardBorder};
    border-radius: 12px;
    padding: 24px 28px;
    margin-bottom: 28px;
  }
  .hero-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .amount-label {
    font-size: 10px;
    color: ${C.textMuted};
    text-transform: uppercase;
    letter-spacing: 1.2px;
    margin-bottom: 8px;
  }
  .amount-value {
    font-size: 38px;
    font-weight: 700;
    color: ${C.white};
    line-height: 1;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.5px;
  }
  .amount-value .currency {
    font-size: 22px;
    font-weight: 400;
    color: ${C.textMuted};
    vertical-align: top;
    position: relative;
    top: 4px;
    margin-right: 2px;
  }
  .amount-time {
    font-size: 11px;
    color: ${C.textMuted};
    margin-top: 8px;
  }
  .paid-stamp {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 2.5px solid ${C.successGreen};
    border-radius: 10px;
    padding: 10px 22px;
    transform: rotate(-4deg);
    -webkit-transform: rotate(-4deg);
  }
  .paid-stamp span {
    font-size: 22px;
    font-weight: 800;
    color: ${C.successGreen};
    letter-spacing: 5px;
    line-height: 1;
  }
  .badge {
    display: inline-block;
    font-size: 9px;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 6px;
    letter-spacing: 0.8px;
    margin-top: 8px;
  }
  .badge-success {
    background: ${C.successBg};
    color: ${C.successGreen};
    border: 1px solid ${C.successBorder};
  }
  .badge-late {
    background: ${C.errorBg};
    color: ${C.errorRed};
    border: 1px solid rgba(248,113,113,0.25);
  }

  /* Section headers */
  .section-title {
    font-size: 10px;
    font-weight: 700;
    color: ${C.accent};
    text-transform: uppercase;
    letter-spacing: 1.8px;
    margin-bottom: 14px;
    padding-bottom: 8px;
    border-bottom: 1px solid ${C.divider};
  }

  /* Detail rows */
  .detail-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid ${C.divider};
  }
  .detail-row:last-child { border-bottom: none; }
  .detail-row .label {
    font-size: 13px;
    color: ${C.textMuted};
  }
  .detail-row .value {
    font-size: 13px;
    color: ${C.textPrimary};
    font-weight: 500;
    text-align: right;
  }
  .detail-row .value.bold {
    font-size: 14px;
    color: ${C.white};
    font-weight: 700;
  }
  .detail-row .value.mono {
    font-size: 12px;
    color: ${C.textSecondary};
    font-family: 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;
    word-break: break-all;
    max-width: 240px;
  }
  .method-pill {
    display: inline-block;
    background: ${C.accentDim};
    color: ${C.accent};
    border: 1px solid ${C.accentDimBorder};
    padding: 3px 14px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  /* Party cards */
  .parties-grid {
    display: flex;
    gap: 12px;
    margin-top: 14px;
  }
  .party-card {
    flex: 1;
    background: ${C.bg};
    border: 1px solid ${C.cardBorder};
    border-radius: 10px;
    padding: 16px 18px;
  }
  .party-label {
    font-size: 9px;
    color: ${C.textMuted};
    text-transform: uppercase;
    letter-spacing: 1.2px;
    margin-bottom: 8px;
  }
  .party-name {
    font-size: 15px;
    font-weight: 600;
    color: ${C.white};
    margin-bottom: 4px;
  }
  .party-detail {
    font-size: 11px;
    color: ${C.textSecondary};
    line-height: 1.5;
  }
  .pan-tag {
    display: inline-block;
    background: ${C.accentDim};
    border: 1px solid ${C.accentDimBorder};
    color: ${C.accent};
    font-size: 10px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 4px;
    margin-top: 6px;
    font-family: 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;
    letter-spacing: 0.5px;
  }

  /* Spacer */
  .spacer { height: 24px; }
  .spacer-sm { height: 16px; }

  /* Footer */
  .footer {
    padding: 18px 28px;
    border-top: 1px solid ${C.divider};
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
    font-size: 13px;
    font-weight: 600;
    color: ${C.textSecondary};
  }
  .footer-brand-text span { color: ${C.accent}; }
  .footer-note {
    font-size: 9px;
    color: ${C.textDim};
    text-align: right;
    max-width: 220px;
    line-height: 1.4;
  }
</style>
</head>
<body>

<div class="container">

  <!-- HEADER -->
  <div class="header">
    <div class="brand">
      <svg width="24" height="28" viewBox="0 0 34 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.4751 40H3.72631V21.2062H0V16.0217H3.72631C1.65252 7.98576 7.50667 3.16855 10.693 1.76445C20.025 -3.16081 29.7028 3.38457 33.3751 7.27293V40H24.6263V11.6473C19.5714 3.35216 13.2312 5.27474 10.693 7.27293C7.45266 12.8463 12.0431 15.4277 14.7433 16.0217H19.2798V21.2062H12.4751V40Z" fill="${C.accent}"/>
      </svg>
      <div>
        <div class="brand-name"><span>Flent</span> Secured</div>
        <div class="brand-sub">Rent Receipt</div>
      </div>
    </div>
    <div class="receipt-meta">
      <div class="label">Receipt No.</div>
      <div class="value">${esc(receipt.receiptNumber)}</div>
      <div class="date">${esc(formatDate(payment.paidAt))}</div>
    </div>
  </div>

  <!-- MAIN CARD -->
  <div class="main-card">
    <div class="accent-bar"></div>
    <div class="card-body">

      <!-- HERO: Amount + PAID Stamp -->
      <div class="hero">
        <div class="hero-inner">
          <div>
            <div class="amount-label">Amount Paid</div>
            <div class="amount-value">
              <span class="currency">&#8377;</span>${esc(formatIndianAmount(payment.amount))}
            </div>
            <div class="amount-time">${esc(formatTime(payment.paidAt))}</div>
          </div>
          <div style="text-align:center;">
            <div class="paid-stamp"><span>PAID</span></div>
            ${timelinessBadge ? `<div style="text-align:center;">${timelinessBadge}</div>` : ''}
          </div>
        </div>
      </div>

      <!-- PAYMENT DETAILS -->
      <div class="section-title">Payment Details</div>
      <div>
        <div class="detail-row">
          <div class="label">Rent Month</div>
          <div class="value" style="font-weight:600;">${esc(payment.rentMonthDisplay)}</div>
        </div>
        <div class="detail-row">
          <div class="label">Rent Amount</div>
          <div class="value">&#8377;${esc(formatIndianAmount(payment.amount))}</div>
        </div>
        ${payment.pgFee > 0 ? `
        <div class="detail-row">
          <div class="label">Convenience Fee</div>
          <div class="value">&#8377;${esc(formatIndianAmount(payment.pgFee))}</div>
        </div>
        <div class="detail-row">
          <div class="label" style="font-weight:600;">Total Paid</div>
          <div class="value bold">&#8377;${esc(formatIndianAmount(totalPaid))}</div>
        </div>` : ''}
        <div class="detail-row">
          <div class="label">Payment Method</div>
          <div class="value"><span class="method-pill">${esc(methodDisplay)}</span></div>
        </div>
        <div class="detail-row" style="border-bottom:none;">
          <div class="label">Transaction Ref</div>
          <div class="value mono">${esc(transactionRef)}</div>
        </div>
      </div>

      <div class="spacer"></div>

      <!-- PARTIES -->
      <div class="section-title">Parties</div>
      <div class="parties-grid">
        <div class="party-card">
          <div class="party-label">Tenant</div>
          <div class="party-name">${esc(tenant.name) || '&mdash;'}</div>
          ${tenant.phone ? `<div class="party-detail">${esc(tenant.phone)}</div>` : ''}
          ${tenant.email ? `<div class="party-detail" style="word-break:break-all;">${esc(tenant.email)}</div>` : ''}
          ${tenant.panMasked ? `<div class="pan-tag">PAN ${esc(tenant.panMasked)}</div>` : ''}
        </div>
        <div class="party-card">
          <div class="party-label">Landlord</div>
          <div class="party-name">${esc(landlord.name)}</div>
          ${landlord.panMasked ? `<div class="pan-tag">PAN ${esc(landlord.panMasked)}</div>` : ''}
        </div>
      </div>

      <div class="spacer"></div>

      <!-- PROPERTY & AGREEMENT -->
      ${propertyLine || agreement.certId ? `
      <div class="section-title">Property</div>
      <div>
        ${propertyLine ? `
        <div class="detail-row">
          <div class="label">Address</div>
          <div class="value">${propertyLine}</div>
        </div>` : ''}
        ${agreement.certId ? `
        <div class="detail-row" style="border-bottom:none;">
          <div class="label">Agreement ID</div>
          <div class="value mono">${esc(agreement.certId)}</div>
        </div>` : ''}
      </div>
      <div class="spacer-sm"></div>
      ` : ''}

    </div>

    <!-- FOOTER -->
    <div class="footer">
      <div class="footer-brand">
        <svg width="14" height="16" viewBox="0 0 34 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12.4751 40H3.72631V21.2062H0V16.0217H3.72631C1.65252 7.98576 7.50667 3.16855 10.693 1.76445C20.025 -3.16081 29.7028 3.38457 33.3751 7.27293V40H24.6263V11.6473C19.5714 3.35216 13.2312 5.27474 10.693 7.27293C7.45266 12.8463 12.0431 15.4277 14.7433 16.0217H19.2798V21.2062H12.4751V40Z" fill="${C.accent}"/>
        </svg>
        <div class="footer-brand-text"><span>Flent</span> Secured</div>
      </div>
      <div class="footer-note">
        Computer-generated receipt.<br/>Does not require a signature.
      </div>
    </div>
  </div>

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
      panMasked: null,
    },
    property: {
      address: '',
      city: null,
    },
    landlord: {
      name: params.landlordName ?? '',
      panMasked: null,
    },
    agreement: {
      certId: params.agreementId ?? null,
    },
  };
}

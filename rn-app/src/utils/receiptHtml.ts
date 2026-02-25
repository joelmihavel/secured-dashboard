/**
 * receiptHtml.ts
 *
 * Generates a complete HTML string for a rent payment receipt PDF.
 * Designed for use with expo-print (WebKit renderer).
 *
 * Design language: Flent dark theme (#131313 background, #202020 cards,
 * #FF9A6D brand accent, system sans-serif).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReceiptHtmlData {
  receiptNumber: string;
  payment: {
    amount: number;
    netAmountPaid: number;
    pgFee: number;
    cashbackApplied: number;
    cashbackEarned: number;
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
    panMasked: string | null;
  };
  agreement: {
    certId: string | null;
  };
  company: {
    name: string;
    address: string;
    gstin: string;
    supportEmail: string;
    supportPhone: string;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a number in Indian locale (e.g. 1,00,000).
 * Handles both integer and decimal amounts.
 */
function formatIndianAmount(value: number): string {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Format an ISO date string to a human-readable form: "4 Nov 2026".
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Escape HTML special characters to prevent injection.
 */
function esc(value: string | null | undefined): string {
  if (value == null) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildReceiptHtml(receipt: ReceiptHtmlData): string {
  const { payment, tenant, property, landlord, agreement, company } = receipt;

  // Determine the transaction reference to display
  const transactionRef = payment.utr
    ? payment.utr
    : payment.transactionId
      ? payment.transactionId
      : 'N/A';

  // Cashback pill content
  const cashbackPillHtml =
    payment.cashbackApplied > 0
      ? `<span class="pill-amount">${esc(`\u20B9${formatIndianAmount(payment.cashbackApplied)}`)}</span> cashback applied`
      : 'Pay by the 7th to earn cashback.';

  // Full property line
  const propertyLine = property.city
    ? `${esc(property.address)}, ${esc(property.city)}`
    : esc(property.address);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Payment Receipt</title>
<style>
  /* ------------------------------------------------------------------ */
  /* Reset & base                                                       */
  /* ------------------------------------------------------------------ */
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    background: #131313;
    color: #CBCBCB;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
      Helvetica, Arial, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    padding: 24px 20px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ------------------------------------------------------------------ */
  /* Card wrapper                                                       */
  /* ------------------------------------------------------------------ */
  .card {
    background: #202020;
    border-radius: 12px;
    padding: 28px 24px;
    max-width: 420px;
    margin: 0 auto;
    position: relative;
    overflow: visible;
  }

  /* ------------------------------------------------------------------ */
  /* Header: title + PAID stamp                                         */
  /* ------------------------------------------------------------------ */
  .header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  .header-title {
    font-size: 18px;
    font-weight: 700;
    color: #FFFFFF;
    line-height: 1.3;
  }

  .header-title .accent {
    color: #FF9A6D;
  }

  .header-subtitle {
    font-size: 12px;
    color: #878787;
    margin-top: 4px;
  }

  /* PAID stamp ------------------------------------------------------- */
  .stamp {
    width: 68px;
    height: 68px;
    border: 2px dashed #06C270;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    transform: rotate(-15deg);
    flex-shrink: 0;
    margin-left: 12px;
  }

  .stamp-stars {
    font-size: 8px;
    color: #06C270;
    letter-spacing: 2px;
  }

  .stamp-text {
    font-size: 18px;
    font-weight: 800;
    color: #06C270;
    letter-spacing: 3px;
    line-height: 1;
  }

  /* ------------------------------------------------------------------ */
  /* Dividers                                                           */
  /* ------------------------------------------------------------------ */
  .divider {
    height: 1px;
    background: #2E2E2E;
    margin: 16px 0;
  }

  /* Divider with circle cutouts (ticket-style) */
  .divider-cutout {
    position: relative;
    height: 1px;
    background: #2E2E2E;
    margin: 20px -24px;
  }

  .divider-cutout::before,
  .divider-cutout::after {
    content: '';
    position: absolute;
    top: -8px;
    width: 16px;
    height: 16px;
    background: #131313;
    border-radius: 50%;
  }

  .divider-cutout::before {
    left: -8px;
  }

  .divider-cutout::after {
    right: -8px;
  }

  /* ------------------------------------------------------------------ */
  /* Receipt rows                                                       */
  /* ------------------------------------------------------------------ */
  .row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 8px 0;
  }

  .row-label {
    font-size: 12px;
    color: #878787;
    white-space: nowrap;
  }

  .row-label .hash {
    color: #FF9A6D;
    margin-right: 4px;
    font-weight: 600;
  }

  .row-value {
    font-size: 13px;
    color: #CBCBCB;
    text-align: right;
    word-break: break-all;
    max-width: 55%;
  }

  /* ------------------------------------------------------------------ */
  /* Cashback pill                                                      */
  /* ------------------------------------------------------------------ */
  .cashback-pill {
    display: inline-block;
    background: #1A1A1A;
    color: #DDDDDD;
    border-radius: 40px;
    padding: 8px 16px;
    font-size: 12px;
    text-align: center;
    margin: 16px auto 0;
    width: 100%;
  }

  .cashback-pill .pill-amount {
    font-weight: 600;
    color: #FF9A6D;
  }

  /* ------------------------------------------------------------------ */
  /* Payable rent (bottom bold row)                                     */
  /* ------------------------------------------------------------------ */
  .payable-rent {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 16px 0 4px;
  }

  .payable-rent .label {
    font-size: 14px;
    font-weight: 600;
    color: #FFFFFF;
  }

  .payable-rent .value {
    font-size: 14px;
    font-weight: 600;
    color: #DDDDDD;
  }

  /* ------------------------------------------------------------------ */
  /* Footer                                                             */
  /* ------------------------------------------------------------------ */
  .footer {
    margin-top: 24px;
    text-align: center;
    font-size: 10px;
    color: #555555;
    line-height: 1.7;
  }

  .footer .receipt-no {
    color: #878787;
    font-size: 11px;
    margin-bottom: 8px;
  }

  .footer .company-name {
    color: #878787;
    font-weight: 600;
  }
</style>
</head>
<body>

<div class="card">

  <!-- Header -->
  <div class="header">
    <div>
      <div class="header-title">
        Payment <span class="accent">Successful</span>
      </div>
      <div class="header-subtitle">
        ${esc(payment.rentMonthDisplay)} &middot; ${esc(propertyLine)}
      </div>
    </div>
    <div class="stamp">
      <span class="stamp-stars">&#9733; &#9733; &#9733;</span>
      <span class="stamp-text">PAID</span>
      <span class="stamp-stars">&#9733; &#9733; &#9733;</span>
    </div>
  </div>

  <div class="divider"></div>

  <!-- Receipt detail rows -->

  <!-- Amount paid -->
  <div class="row">
    <span class="row-label"><span class="hash">#</span>Amount paid</span>
    <span class="row-value">\u20B9 ${esc(formatIndianAmount(payment.amount))}</span>
  </div>

  <!-- Date -->
  <div class="row">
    <span class="row-label"><span class="hash">#</span>Date</span>
    <span class="row-value">${esc(formatDate(payment.paidAt))}</span>
  </div>

  <!-- Payment method -->
  <div class="row">
    <span class="row-label"><span class="hash">#</span>Method</span>
    <span class="row-value">${esc(payment.paymentMethod ?? 'N/A')}</span>
  </div>

  <!-- Landlord -->
  <div class="row">
    <span class="row-label"><span class="hash">#</span>Landlord</span>
    <span class="row-value">${esc(landlord.name)}</span>
  </div>

  <!-- PAN Card -->
  <div class="row">
    <span class="row-label"><span class="hash">#</span>PAN Card</span>
    <span class="row-value">${esc(landlord.panMasked ?? 'Not provided')}</span>
  </div>

  <!-- Agreement ID -->
  <div class="row">
    <span class="row-label"><span class="hash">#</span>Agreement ID</span>
    <span class="row-value">${esc(agreement.certId ?? 'N/A')}</span>
  </div>

  <!-- Transaction ID -->
  <div class="row">
    <span class="row-label"><span class="hash">#</span>Transaction ID</span>
    <span class="row-value">${esc(transactionRef)}</span>
  </div>

  <!-- Cashback pill -->
  <div class="cashback-pill">
    ${cashbackPillHtml}
  </div>

  <!-- Ticket-style cutout divider -->
  <div class="divider-cutout"></div>

  <!-- Payable rent -->
  <div class="payable-rent">
    <span class="label">Payable Rent</span>
    <span class="value">\u20B9 ${esc(formatIndianAmount(payment.netAmountPaid))}</span>
  </div>

</div>

<!-- Footer (outside card) -->
<div class="footer">
  <div class="receipt-no">Receipt No. ${esc(receipt.receiptNumber)}</div>
  <div class="company-name">${esc(company.name)}</div>
  <div>${esc(company.address)}</div>
  <div>GSTIN: ${esc(company.gstin)}</div>
  <div>${esc(company.supportEmail)} &middot; ${esc(company.supportPhone)}</div>
</div>

</body>
</html>`;
}

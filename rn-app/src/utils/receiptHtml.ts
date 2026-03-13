/**
 * receiptHtml.ts
 *
 * Generates a complete HTML string for a rent payment receipt PDF.
 * Designed for use with expo-print (WebKit renderer on iOS/Android).
 *
 * Design language: Light/white background for print-friendliness,
 * Flent brand accent (#FF9A6D), professional fintech receipt layout.
 * Optimised for A4/Letter PDF output with no excessive whitespace.
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

  // Full property line
  const propertyLine = property.city
    ? `${esc(property.address)}, ${esc(property.city)}`
    : esc(property.address);

  // Payment method display
  const methodDisplay = payment.paymentMethod
    ? payment.paymentMethod.toUpperCase()
    : 'N/A';

  // Timeliness badge
  const timelinessBadge =
    payment.timeliness === 'on_time'
      ? '<span style="display:inline-block;background:#E8F9F1;color:#06C270;font-size:10px;font-weight:600;padding:2px 8px;border-radius:4px;margin-left:8px;">ON TIME</span>'
      : payment.timeliness === 'late'
        ? '<span style="display:inline-block;background:#FEF0F0;color:#D94545;font-size:10px;font-weight:600;padding:2px 8px;border-radius:4px;margin-left:8px;">LATE</span>'
        : '';

  // Cashback section HTML
  const hasCashback = payment.cashbackApplied > 0 || payment.cashbackEarned > 0;
  const cashbackSectionHtml = hasCashback ? `
    <tr><td colspan="2" style="padding-top:16px;padding-bottom:8px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFF7F3;border-radius:8px;border:1px solid #FFE8DD;">
        <tr><td style="padding:12px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size:11px;font-weight:600;color:#CC6B3A;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:8px;">Cashback</td>
            </tr>
            ${payment.cashbackApplied > 0 ? `<tr>
              <td>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size:13px;color:#555555;">Instant Discount</td>
                    <td align="right" style="font-size:13px;color:#D94545;font-weight:600;">&minus; &#8377;${esc(formatIndianAmount(payment.cashbackApplied))}</td>
                  </tr>
                </table>
              </td>
            </tr>` : ''}
            ${payment.cashbackEarned > 0 ? `<tr>
              <td style="padding-top:4px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size:13px;color:#555555;">Earned to Balance</td>
                    <td align="right" style="font-size:13px;color:#06C270;font-weight:600;">+ &#8377;${esc(formatIndianAmount(payment.cashbackEarned))}</td>
                  </tr>
                </table>
              </td>
            </tr>` : ''}
          </table>
        </td></tr>
      </table>
    </td></tr>` : '';

  // PG fee row
  const pgFeeRowHtml = payment.pgFee > 0 ? `
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#888888;">Gateway Fee</td>
              <td align="right" style="padding:6px 0;font-size:13px;color:#333333;">&#8377;${esc(formatIndianAmount(payment.pgFee))}</td>
            </tr>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Payment Receipt - ${esc(receipt.receiptNumber)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  @page {
    size: A4;
    margin: 0;
  }

  body {
    background: #F5F5F7;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
      Helvetica, Arial, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    color: #333333;
    padding: 32px 28px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .receipt-container {
    max-width: 560px;
    margin: 0 auto;
    background: #FFFFFF;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04);
  }

  .brand-strip {
    height: 4px;
    background: linear-gradient(90deg, #FF9A6D 0%, #FFB899 100%);
  }
</style>
</head>
<body>

<div class="receipt-container">
  <!-- Brand accent strip at very top -->
  <div class="brand-strip"></div>

  <!-- All content via tables for maximum WebKit compatibility -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:28px 32px 0;">

    <!-- HEADER ROW: Logo left, Receipt info right -->
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <!-- Logo + brand name -->
            <td valign="middle" style="width:50%;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right:10px;">
                    <svg width="28" height="33" viewBox="0 0 34 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12.4751 40H3.72631V21.2062H0V16.0217H3.72631C1.65252 7.98576 7.50667 3.16855 10.693 1.76445C20.025 -3.16081 29.7028 3.38457 33.3751 7.27293V40H24.6263V11.6473C19.5714 3.35216 13.2312 5.27474 10.693 7.27293C7.45266 12.8463 12.0431 15.4277 14.7433 16.0217H19.2798V21.2062H12.4751V40Z" fill="#FF9A6D"/>
                    </svg>
                  </td>
                  <td valign="middle">
                    <div style="font-size:17px;font-weight:700;color:#1A1A1A;line-height:1.2;">
                      <span style="color:#FF9A6D;">Flent</span> Secured
                    </div>
                    <div style="font-size:10px;color:#999999;text-transform:uppercase;letter-spacing:1px;margin-top:1px;">Payment Receipt</div>
                  </td>
                </tr>
              </table>
            </td>

            <!-- Receipt number + date -->
            <td valign="middle" align="right" style="width:50%;">
              <div style="font-size:12px;color:#888888;">Receipt No.</div>
              <div style="font-size:13px;font-weight:600;color:#333333;font-variant-numeric:tabular-nums;">${esc(receipt.receiptNumber)}</div>
              <div style="font-size:11px;color:#999999;margin-top:2px;">${esc(formatDate(payment.paidAt))}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Spacing -->
    <tr><td style="height:20px;"></td></tr>

    <!-- HERO SECTION: Amount + Paid badge -->
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAFAFA;border-radius:10px;border:1px solid #EEEEEE;">
          <tr>
            <td style="padding:20px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle">
                    <div style="font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Amount Paid</div>
                    <div style="font-size:32px;font-weight:700;color:#1A1A1A;line-height:1;font-variant-numeric:tabular-nums;">
                      <span style="font-size:20px;font-weight:400;color:#888888;vertical-align:top;position:relative;top:2px;">&#8377;</span>${esc(formatIndianAmount(payment.netAmountPaid))}
                    </div>
                    ${payment.cashbackApplied > 0 ? `<div style="font-size:12px;color:#999999;margin-top:4px;text-decoration:line-through;">&#8377;${esc(formatIndianAmount(payment.amount))}</div>` : ''}
                  </td>
                  <td valign="middle" align="right">
                    <!-- PAID badge -->
                    <div style="display:inline-block;border:2px solid #06C270;border-radius:8px;padding:6px 16px;transform:rotate(-3deg);-webkit-transform:rotate(-3deg);">
                      <div style="font-size:18px;font-weight:800;color:#06C270;letter-spacing:3px;line-height:1;">PAID</div>
                    </div>
                    ${timelinessBadge ? `<div style="margin-top:6px;text-align:center;">${timelinessBadge}</div>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Spacing -->
    <tr><td style="height:20px;"></td></tr>

    <!-- PAYMENT DETAILS SECTION -->
    <tr>
      <td>
        <div style="font-size:11px;font-weight:600;color:#AAAAAA;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Payment Details</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #EEEEEE;">
            <tr>
              <td style="padding:8px 0;font-size:13px;color:#888888;">Rent Month</td>
              <td align="right" style="padding:8px 0;font-size:13px;color:#333333;font-weight:500;">${esc(payment.rentMonthDisplay)}</td>
            </tr>
            <tr>
              <td colspan="2" style="border-bottom:1px solid #F3F3F3;"></td>
            </tr>
            <tr>
              <td style="padding:8px 0;font-size:13px;color:#888888;">Gross Amount</td>
              <td align="right" style="padding:8px 0;font-size:13px;color:#333333;">&#8377;${esc(formatIndianAmount(payment.amount))}</td>
            </tr>
            <tr>
              <td colspan="2" style="border-bottom:1px solid #F3F3F3;"></td>
            </tr>
            ${pgFeeRowHtml}
            ${payment.pgFee > 0 ? '<tr><td colspan="2" style="border-bottom:1px solid #F3F3F3;"></td></tr>' : ''}
            <tr>
              <td style="padding:8px 0;font-size:13px;color:#888888;">Payment Method</td>
              <td align="right" style="padding:8px 0;font-size:13px;color:#333333;">
                <span style="display:inline-block;background:#F0F0F0;padding:2px 10px;border-radius:4px;font-size:11px;font-weight:600;letter-spacing:0.5px;">${esc(methodDisplay)}</span>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="border-bottom:1px solid #F3F3F3;"></td>
            </tr>
            <tr>
              <td style="padding:8px 0;font-size:13px;color:#888888;">Transaction Ref</td>
              <td align="right" style="padding:8px 0;font-size:12px;color:#555555;font-family:'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;word-break:break-all;max-width:240px;">${esc(transactionRef)}</td>
            </tr>
        </table>
      </td>
    </tr>

    <!-- Cashback section (conditional) -->
    ${cashbackSectionHtml}

    <!-- Spacing -->
    <tr><td style="height:20px;"></td></tr>

    <!-- PARTIES SECTION -->
    <tr>
      <td>
        <div style="font-size:11px;font-weight:600;color:#AAAAAA;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Parties</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <!-- Tenant -->
            <td valign="top" style="width:50%;padding-right:12px;">
              <div style="background:#FAFAFA;border-radius:8px;border:1px solid #EEEEEE;padding:14px 16px;">
                <div style="font-size:10px;color:#AAAAAA;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Tenant</div>
                <div style="font-size:14px;font-weight:600;color:#1A1A1A;margin-bottom:2px;">${esc(tenant.name) || '&mdash;'}</div>
                ${tenant.phone ? `<div style="font-size:11px;color:#888888;">${esc(tenant.phone)}</div>` : ''}
                ${tenant.email ? `<div style="font-size:11px;color:#888888;word-break:break-all;">${esc(tenant.email)}</div>` : ''}
              </div>
            </td>
            <!-- Landlord -->
            <td valign="top" style="width:50%;padding-left:12px;">
              <div style="background:#FAFAFA;border-radius:8px;border:1px solid #EEEEEE;padding:14px 16px;">
                <div style="font-size:10px;color:#AAAAAA;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Landlord</div>
                <div style="font-size:14px;font-weight:600;color:#1A1A1A;margin-bottom:2px;">${esc(landlord.name)}</div>
                ${landlord.panMasked ? `<div style="font-size:11px;color:#888888;">PAN: ${esc(landlord.panMasked)}</div>` : ''}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Spacing -->
    <tr><td style="height:16px;"></td></tr>

    <!-- PROPERTY + AGREEMENT -->
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #EEEEEE;">
          ${propertyLine ? `<tr>
            <td style="padding:8px 0;font-size:13px;color:#888888;width:35%;">Property</td>
            <td align="right" style="padding:8px 0;font-size:13px;color:#333333;">${propertyLine}</td>
          </tr>
          <tr><td colspan="2" style="border-bottom:1px solid #F3F3F3;"></td></tr>` : ''}
          ${agreement.certId ? `<tr>
            <td style="padding:8px 0;font-size:13px;color:#888888;">Agreement ID</td>
            <td align="right" style="padding:8px 0;font-size:12px;color:#555555;font-family:'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;">${esc(agreement.certId)}</td>
          </tr>` : ''}
        </table>
      </td>
    </tr>

    <!-- Spacing -->
    <tr><td style="height:8px;"></td></tr>

  </table>

  <!-- FOOTER -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAFAFA;border-top:1px solid #EEEEEE;padding:16px 32px;">
    <tr>
      <td style="padding:16px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td valign="top" style="width:60%;">
              <div style="font-size:11px;font-weight:600;color:#555555;">${esc(company.name)}</div>
              <div style="font-size:10px;color:#999999;margin-top:2px;">${esc(company.address)}</div>
              ${company.gstin ? `<div style="font-size:10px;color:#999999;margin-top:1px;">GSTIN: ${esc(company.gstin)}</div>` : ''}
            </td>
            <td valign="top" align="right" style="width:40%;">
              <div style="font-size:10px;color:#999999;">${esc(company.supportEmail)}</div>
              <div style="font-size:10px;color:#999999;margin-top:1px;">${esc(company.supportPhone)}</div>
            </td>
          </tr>
        </table>
        <div style="text-align:center;margin-top:12px;font-size:9px;color:#CCCCCC;">
          This is a computer-generated receipt and does not require a signature.
        </div>
      </td>
    </tr>
  </table>
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
  cashback?: string;
  transactionId?: string;
  landlordName?: string;
  agreementId?: string;
  paymentId?: string;
}

export function buildFallbackReceiptData(params: FallbackReceiptParams): ReceiptHtmlData {
  const amountNum = parseFloat((params.amount ?? '0').replace(/,/g, '')) || 0;
  const cashbackNum = parseFloat((params.cashback ?? '0').replace(/,/g, '')) || 0;
  const netAmount = Math.max(amountNum - cashbackNum, 0);
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
      netAmountPaid: netAmount,
      pgFee: 0,
      cashbackApplied: cashbackNum,
      cashbackEarned: 0,
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
      panMasked: null,
    },
    agreement: {
      certId: params.agreementId ?? null,
    },
    company: {
      name: 'Flent Technologies Private Limited',
      address: 'Mumbai, Maharashtra',
      gstin: '',
      supportEmail: 'secured@flent.in',
      supportPhone: '+91 93210 93210',
    },
  };
}

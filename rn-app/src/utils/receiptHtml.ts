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
  bg: '#131313',
  card: '#202020',
  cardBorder: '#2A2A2A',
  accent: '#FF9A6D',
  accentLight: '#FFAE8A',
  textPrimary: '#DDDDDD',
  textSecondary: '#A9A9A9',
  textMuted: '#878787',
  textDim: '#555555',
  divider: '#2A2A2A',
  successGreen: '#06C270',
  successBg: 'rgba(6,194,112,0.08)',
  errorRed: '#E5484D',
  errorBg: 'rgba(229,72,77,0.08)',
  white: '#FFFFFF',
  pillBg: '#2A2A2A',
} as const;

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildReceiptHtml(receipt: ReceiptHtmlData): string {
  const { payment, tenant, property, landlord, agreement, company } = receipt;

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
      ? `<span style="display:inline-block;background:${C.successBg};color:${C.successGreen};font-size:10px;font-weight:600;padding:3px 10px;border-radius:4px;letter-spacing:0.5px;">ON TIME</span>`
      : payment.timeliness === 'late'
        ? `<span style="display:inline-block;background:${C.errorBg};color:${C.errorRed};font-size:10px;font-weight:600;padding:3px 10px;border-radius:4px;letter-spacing:0.5px;">LATE</span>`
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
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    color: ${C.textPrimary};
    padding: 32px 28px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .container {
    max-width: 560px;
    margin: 0 auto;
    background: ${C.bg};
  }
  .brand-strip {
    height: 4px;
    background: linear-gradient(90deg, ${C.accent} 0%, ${C.accentLight} 100%);
    border-radius: 2px 2px 0 0;
  }
  .card {
    background: ${C.card};
    border: 1px solid ${C.cardBorder};
    border-radius: 10px;
    overflow: hidden;
  }
</style>
</head>
<body>

<div class="container">

  <!-- ======= BRAND STRIP ======= -->
  <div class="brand-strip"></div>

  <!-- ======= MAIN RECEIPT CARD ======= -->
  <div class="card" style="border-radius:0 0 10px 10px;border-top:none;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:28px 32px 0;">

      <!-- HEADER: Logo + Receipt Info -->
      <tr>
        <td>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td valign="middle" style="width:55%;">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="middle" style="padding-right:10px;">
                      <svg width="26" height="30" viewBox="0 0 34 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12.4751 40H3.72631V21.2062H0V16.0217H3.72631C1.65252 7.98576 7.50667 3.16855 10.693 1.76445C20.025 -3.16081 29.7028 3.38457 33.3751 7.27293V40H24.6263V11.6473C19.5714 3.35216 13.2312 5.27474 10.693 7.27293C7.45266 12.8463 12.0431 15.4277 14.7433 16.0217H19.2798V21.2062H12.4751V40Z" fill="${C.accent}"/>
                      </svg>
                    </td>
                    <td valign="middle">
                      <div style="font-size:17px;font-weight:700;color:${C.white};line-height:1.2;">
                        <span style="color:${C.accent};">Flent</span> Secured
                      </div>
                      <div style="font-size:9px;color:${C.textMuted};text-transform:uppercase;letter-spacing:1.5px;margin-top:2px;">Rent Receipt</div>
                    </td>
                  </tr>
                </table>
              </td>
              <td valign="middle" align="right" style="width:45%;">
                <div style="font-size:10px;color:${C.textMuted};text-transform:uppercase;letter-spacing:0.5px;">Receipt No.</div>
                <div style="font-size:12px;font-weight:600;color:${C.textPrimary};font-variant-numeric:tabular-nums;margin-top:1px;">${esc(receipt.receiptNumber)}</div>
                <div style="font-size:11px;color:${C.textSecondary};margin-top:2px;">${esc(formatDate(payment.paidAt))}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr><td style="height:24px;"></td></tr>

      <!-- HERO: Amount + PAID Badge -->
      <tr>
        <td>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};border-radius:10px;border:1px solid ${C.cardBorder};">
            <tr>
              <td style="padding:24px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="middle">
                      <div style="font-size:10px;color:${C.textMuted};text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Amount Paid</div>
                      <div style="font-size:36px;font-weight:700;color:${C.white};line-height:1;font-variant-numeric:tabular-nums;">
                        <span style="font-size:22px;font-weight:400;color:${C.textMuted};vertical-align:top;position:relative;top:3px;">&#8377;</span>${esc(formatIndianAmount(payment.amount))}
                      </div>
                      <div style="font-size:11px;color:${C.textMuted};margin-top:6px;">${esc(formatTime(payment.paidAt))}</div>
                    </td>
                    <td valign="middle" align="right">
                      <div style="display:inline-block;border:2px solid ${C.successGreen};border-radius:8px;padding:8px 18px;transform:rotate(-3deg);-webkit-transform:rotate(-3deg);">
                        <div style="font-size:20px;font-weight:800;color:${C.successGreen};letter-spacing:4px;line-height:1;">PAID</div>
                      </div>
                      ${timelinessBadge ? `<div style="margin-top:8px;text-align:center;">${timelinessBadge}</div>` : ''}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr><td style="height:24px;"></td></tr>

      <!-- PAYMENT DETAILS -->
      <tr>
        <td>
          <div style="font-size:10px;font-weight:600;color:${C.accent};text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px;">Payment Details</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:10px 0;font-size:13px;color:${C.textMuted};">Rent Month</td>
              <td align="right" style="padding:10px 0;font-size:13px;color:${C.textPrimary};font-weight:500;">${esc(payment.rentMonthDisplay)}</td>
            </tr>
            <tr><td colspan="2" style="border-bottom:1px solid ${C.divider};"></td></tr>
            <tr>
              <td style="padding:10px 0;font-size:13px;color:${C.textMuted};">Rent Amount</td>
              <td align="right" style="padding:10px 0;font-size:13px;color:${C.textPrimary};">&#8377;${esc(formatIndianAmount(payment.amount))}</td>
            </tr>
            ${payment.pgFee > 0 ? `
            <tr><td colspan="2" style="border-bottom:1px solid ${C.divider};"></td></tr>
            <tr>
              <td style="padding:10px 0;font-size:13px;color:${C.textMuted};">Convenience Fee</td>
              <td align="right" style="padding:10px 0;font-size:13px;color:${C.textPrimary};">&#8377;${esc(formatIndianAmount(payment.pgFee))}</td>
            </tr>` : ''}
            ${payment.pgFee > 0 ? `
            <tr><td colspan="2" style="border-bottom:1px solid ${C.divider};"></td></tr>
            <tr>
              <td style="padding:10px 0;font-size:13px;color:${C.textMuted};font-weight:600;">Total Paid</td>
              <td align="right" style="padding:10px 0;font-size:14px;color:${C.white};font-weight:700;">&#8377;${esc(formatIndianAmount(totalPaid))}</td>
            </tr>` : ''}
            <tr><td colspan="2" style="border-bottom:1px solid ${C.divider};"></td></tr>
            <tr>
              <td style="padding:10px 0;font-size:13px;color:${C.textMuted};">Payment Method</td>
              <td align="right" style="padding:10px 0;font-size:13px;color:${C.textPrimary};">
                <span style="display:inline-block;background:${C.pillBg};color:${C.accent};padding:3px 12px;border-radius:4px;font-size:11px;font-weight:600;letter-spacing:0.5px;">${esc(methodDisplay)}</span>
              </td>
            </tr>
            <tr><td colspan="2" style="border-bottom:1px solid ${C.divider};"></td></tr>
            <tr>
              <td style="padding:10px 0;font-size:13px;color:${C.textMuted};">Transaction Ref</td>
              <td align="right" style="padding:10px 0;font-size:12px;color:${C.textSecondary};font-family:'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;word-break:break-all;max-width:240px;">${esc(transactionRef)}</td>
            </tr>
          </table>
        </td>
      </tr>

      <tr><td style="height:24px;"></td></tr>

      <!-- PARTIES -->
      <tr>
        <td>
          <div style="font-size:10px;font-weight:600;color:${C.accent};text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px;">Parties</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td valign="top" style="width:50%;padding-right:8px;">
                <div style="background:${C.bg};border-radius:8px;border:1px solid ${C.cardBorder};padding:14px 16px;">
                  <div style="font-size:9px;color:${C.textMuted};text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Tenant</div>
                  <div style="font-size:14px;font-weight:600;color:${C.white};margin-bottom:3px;">${esc(tenant.name) || '&mdash;'}</div>
                  ${tenant.phone ? `<div style="font-size:11px;color:${C.textSecondary};">${esc(tenant.phone)}</div>` : ''}
                  ${tenant.email ? `<div style="font-size:11px;color:${C.textSecondary};word-break:break-all;">${esc(tenant.email)}</div>` : ''}
                </div>
              </td>
              <td valign="top" style="width:50%;padding-left:8px;">
                <div style="background:${C.bg};border-radius:8px;border:1px solid ${C.cardBorder};padding:14px 16px;">
                  <div style="font-size:9px;color:${C.textMuted};text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Landlord</div>
                  <div style="font-size:14px;font-weight:600;color:${C.white};margin-bottom:3px;">${esc(landlord.name)}</div>
                  ${landlord.panMasked ? `<div style="font-size:11px;color:${C.textSecondary};">PAN: ${esc(landlord.panMasked)}</div>` : ''}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr><td style="height:20px;"></td></tr>

      <!-- PROPERTY & AGREEMENT -->
      <tr>
        <td>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${C.divider};">
            ${propertyLine ? `<tr>
              <td style="padding:10px 0;font-size:13px;color:${C.textMuted};width:35%;">Property</td>
              <td align="right" style="padding:10px 0;font-size:13px;color:${C.textPrimary};">${propertyLine}</td>
            </tr>
            <tr><td colspan="2" style="border-bottom:1px solid ${C.divider};"></td></tr>` : ''}
            ${agreement.certId ? `<tr>
              <td style="padding:10px 0;font-size:13px;color:${C.textMuted};">Agreement ID</td>
              <td align="right" style="padding:10px 0;font-size:12px;color:${C.textSecondary};font-family:'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;">${esc(agreement.certId)}</td>
            </tr>` : ''}
          </table>
        </td>
      </tr>

      <tr><td style="height:12px;"></td></tr>

    </table>

    <!-- FOOTER -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};border-top:1px solid ${C.cardBorder};">
      <tr>
        <td style="padding:16px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td valign="top" style="width:60%;">
                <div style="font-size:11px;font-weight:600;color:${C.textSecondary};">${esc(company.name)}</div>
                <div style="font-size:10px;color:${C.textMuted};margin-top:2px;">${esc(company.address)}</div>
                ${company.gstin ? `<div style="font-size:10px;color:${C.textMuted};margin-top:1px;">GSTIN: ${esc(company.gstin)}</div>` : ''}
              </td>
              <td valign="top" align="right" style="width:40%;">
                <div style="font-size:10px;color:${C.textMuted};">${esc(company.supportEmail)}</div>
                <div style="font-size:10px;color:${C.textMuted};margin-top:1px;">${esc(company.supportPhone)}</div>
              </td>
            </tr>
          </table>
          <div style="text-align:center;margin-top:14px;font-size:9px;color:${C.textDim};">
            This is a computer-generated receipt and does not require a signature.
          </div>
        </td>
      </tr>
    </table>
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

/**
 * receiptHtml.ts
 *
 * Compact receipt PDF for iPhone + WhatsApp sharing.
 * Page: 390x680 (phone-card ratio) — fills mobile screen, sharp WA thumbnail.
 * Design: App design system (#131313 bg, #202020 cards, #FF9A6D accent).
 * Content: Rent amount only, no cashback.
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

function formatINR(value: number): string {
  return value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours(), mm = String(d.getMinutes()).padStart(2,'0');
  return `${h % 12 || 12}:${mm} ${h >= 12 ? 'PM' : 'AM'}`;
}

function esc(v: string | null | undefined): string {
  if (v == null) return '';
  return v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---------------------------------------------------------------------------
// Design tokens (matches app: colors.black, colors.brand)
// ---------------------------------------------------------------------------

const T = {
  bg:       '#131313',  // colors.black[700] — app background
  card:     '#202020',  // colors.black[500] — card background
  border:   '#2A2A2A',  // card borders
  accent:   '#FF9A6D',  // colors.brand[500]
  white:    '#FFFFFF',
  text1:    '#DDDDDD',  // primary text
  text2:    '#A9A9A9',  // secondary text
  text3:    '#878787',  // labels
  muted:    '#555555',  // very dim text
  green:    '#34D399',  // success
  red:      '#F87171',  // error
} as const;

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildReceiptHtml(r: ReceiptHtmlData): string {
  const { payment: p, tenant, property, landlord } = r;
  const ref = p.utr ?? 'Pending';
  const method = p.paymentMethod ? p.paymentMethod.toUpperCase() : '—';
  const addr = property.city ? `${esc(property.address)}, ${esc(property.city)}` : esc(property.address);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=390"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
@page{size:390px 680px;margin:0}
html{width:390px;height:680px;overflow:hidden}
body{width:390px;height:680px;max-height:680px;overflow:hidden;background:${T.bg};font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;color:${T.text1};-webkit-print-color-adjust:exact;print-color-adjust:exact}
.p{padding:28px 24px 20px;height:100%;display:flex;flex-direction:column}

.top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px}
.brand-row{display:flex;align-items:center;gap:8px}
.brand{font-size:18px;font-weight:700;color:${T.accent};letter-spacing:-0.3px}
.brand-sub{font-size:8px;color:${T.text3};text-transform:uppercase;letter-spacing:1.5px;margin-top:1px}
.meta{text-align:right}
.meta-l{font-size:8px;color:${T.text3};text-transform:uppercase;letter-spacing:0.8px}
.meta-v{font-size:11px;font-weight:600;color:${T.text2};margin-top:1px}
.meta-d{font-size:10px;color:${T.text3};margin-top:1px}

.hero{background:${T.card};border:1px solid ${T.border};border-radius:14px;padding:22px 20px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center}
.amt-l{font-size:9px;color:${T.text3};text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
.amt{font-size:38px;font-weight:700;color:${T.white};line-height:1;letter-spacing:-1px}
.amt .c{font-size:18px;color:${T.text3};font-weight:400;margin-right:2px}
.amt-s{font-size:10px;color:${T.text3};margin-top:5px}
.stamp{border:2px solid ${T.green};border-radius:8px;padding:7px 16px;transform:rotate(-5deg);-webkit-transform:rotate(-5deg)}
.stamp span{font-size:18px;font-weight:800;color:${T.green};letter-spacing:4px}
.bdg{display:inline-block;font-size:8px;font-weight:700;padding:2px 7px;border-radius:4px;letter-spacing:0.5px;margin-top:6px}
.bdg-ok{background:rgba(52,211,153,.12);color:${T.green};border:1px solid rgba(52,211,153,.3)}
.bdg-late{background:rgba(248,113,113,.12);color:${T.red};border:1px solid rgba(248,113,113,.3)}

.sec{flex:1}
.rows{background:${T.card};border:1px solid ${T.border};border-radius:12px;padding:4px 16px;margin-bottom:14px}
.row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid ${T.border}}
.row:last-child{border-bottom:none}
.row-l{font-size:12px;color:${T.text3}}
.row-v{font-size:12px;color:${T.text1};font-weight:500;text-align:right;max-width:200px}
.row-v.m{font-family:'SF Mono',Menlo,monospace;font-size:11px;color:${T.text2};word-break:break-all}
.pill{display:inline-block;background:rgba(255,154,109,.1);color:${T.accent};border:1px solid rgba(255,154,109,.25);padding:2px 10px;border-radius:5px;font-size:10px;font-weight:700;letter-spacing:0.3px}

.pts{display:flex;gap:10px;margin-bottom:14px}
.pt{flex:1;background:${T.card};border:1px solid ${T.border};border-radius:10px;padding:12px 14px}
.pt-l{font-size:8px;color:${T.text3};text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
.pt-n{font-size:13px;font-weight:600;color:${T.text1};margin-bottom:2px}
.pt-d{font-size:10px;color:${T.text3};line-height:1.4}
.pan{display:inline-block;background:rgba(255,154,109,.08);border:1px solid rgba(255,154,109,.2);color:#E07A4E;font-size:9px;font-weight:600;padding:1px 6px;border-radius:3px;margin-top:4px;font-family:'SF Mono',Menlo,monospace}

.prop{background:${T.card};border:1px solid ${T.border};border-radius:10px;padding:10px 14px;margin-bottom:14px}
.prop-l{font-size:8px;color:${T.text3};text-transform:uppercase;letter-spacing:1px;margin-bottom:2px}
.prop-v{font-size:11px;color:${T.text2};line-height:1.4}

.foot{display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid ${T.border}}
.foot-b{font-size:11px;font-weight:600;color:${T.accent}}
.foot-n{font-size:8px;color:${T.muted};text-align:right;line-height:1.3}
</style>
</head>
<body>
<div class="p">

<div class="top">
  <div>
    <div class="brand-row">
      <svg width="20" height="24" viewBox="0 0 34 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.4751 40H3.72631V21.2062H0V16.0217H3.72631C1.65252 7.98576 7.50667 3.16855 10.693 1.76445C20.025 -3.16081 29.7028 3.38457 33.3751 7.27293V40H24.6263V11.6473C19.5714 3.35216 13.2312 5.27474 10.693 7.27293C7.45266 12.8463 12.0431 15.4277 14.7433 16.0217H19.2798V21.2062H12.4751V40Z" fill="${T.accent}"/></svg>
      <div class="brand">Secured</div>
    </div>
    <div class="brand-sub">by Flent &middot; Rent Receipt</div>
  </div>
  <div class="meta"><div class="meta-l">Receipt</div><div class="meta-v">${esc(r.receiptNumber)}</div><div class="meta-d">${esc(fmtDate(p.paidAt))}</div></div>
</div>

<div class="hero">
  <div>
    <div class="amt-l">Rent Paid</div>
    <div class="amt"><span class="c">&#8377;</span>${esc(formatINR(p.amount))}</div>
    <div class="amt-s">${esc(fmtDate(p.paidAt))} &middot; ${esc(fmtTime(p.paidAt))}</div>
    ${p.timeliness === 'on_time' ? '<div class="bdg bdg-ok">ON TIME</div>' : p.timeliness === 'late' ? '<div class="bdg bdg-late">LATE</div>' : ''}
  </div>
  <div class="stamp"><span>PAID</span></div>
</div>

<div class="sec">
  <div class="rows">
    <div class="row"><div class="row-l">Rent Month</div><div class="row-v" style="font-weight:600">${esc(p.rentMonthDisplay)}</div></div>
    <div class="row"><div class="row-l">Amount</div><div class="row-v">&#8377; ${esc(formatINR(p.amount))}</div></div>
    <div class="row"><div class="row-l">Method</div><div class="row-v"><span class="pill">${esc(method)}</span></div></div>
    <div class="row"><div class="row-l">Transaction Ref</div><div class="row-v m">${esc(ref)}</div></div>
  </div>

  <div class="pts">
    <div class="pt">
      <div class="pt-l">Tenant</div>
      <div class="pt-n">${esc(tenant.name) || '—'}</div>
      ${tenant.phone ? `<div class="pt-d">${esc(tenant.phone)}</div>` : ''}
      ${tenant.panMasked ? `<div class="pan">PAN ${esc(tenant.panMasked.replace(/\*/g, ''))}</div>` : ''}
    </div>
    <div class="pt">
      <div class="pt-l">Landlord</div>
      <div class="pt-n">${esc(landlord.name)}</div>
      ${landlord.panMasked ? `<div class="pan">PAN ${esc(landlord.panMasked.replace(/\*/g, ''))}</div>` : ''}
    </div>
  </div>

  ${addr ? `<div class="prop"><div class="prop-l">Property</div><div class="prop-v">${addr}</div></div>` : ''}
</div>

<div class="foot">
  <div class="foot-b">Secured by Flent</div>
  <div class="foot-n">Computer-generated receipt<br/>No signature required</div>
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
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return {
    receiptNumber,
    payment: {
      amount: amountNum,
      pgFee: 0,
      paymentMethod: params.method ?? null,
      paidAt: now.toISOString(),
      rentMonthDisplay: `${months[now.getMonth()]} ${now.getFullYear()}`,
      utr: null,
      timeliness: null,
      transactionId: params.transactionId ?? null,
    },
    tenant: { name: '', phone: null, email: null, panMasked: null },
    property: { address: '', city: null },
    landlord: { name: params.landlordName ?? '', panMasked: null },
    agreement: { certId: params.agreementId ?? null },
  };
}

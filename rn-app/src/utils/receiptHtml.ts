/**
 * receiptHtml.ts
 *
 * Clean, compact receipt PDF for iPhone sharing.
 * Single-page design — no wasted space, centered layout.
 * Design: App design system (#131313 bg, #202020 cards, #FF9A6D accent).
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
  bg:       '#131313',
  card:     '#1C1C1C',
  border:   '#2A2A2A',
  accent:   '#FF9A6D',
  white:    '#FFFFFF',
  text1:    '#E0E0E0',
  text2:    '#A9A9A9',
  text3:    '#777777',
  muted:    '#555555',
  green:    '#34D399',
  red:      '#F87171',
} as const;

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildReceiptHtml(r: ReceiptHtmlData): string {
  const { payment: p, tenant, property, landlord } = r;
  const ref = p.utr ?? 'Pending';
  const method = p.paymentMethod ? p.paymentMethod.toUpperCase() : '—';
  const addr = property.city ? `${esc(property.address)}, ${esc(property.city)}` : esc(property.address);
  const timelinessHtml = p.timeliness === 'on_time'
    ? `<span class="bdg ok">ON TIME</span>`
    : p.timeliness === 'late' ? `<span class="bdg late">LATE</span>` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Secured by Flent — Rent Receipt</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
@page{margin:0}
html,body{width:100%;height:100%;background:${T.bg};font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;color:${T.text1};-webkit-print-color-adjust:exact;print-color-adjust:exact}

.page{padding:28px 28px 22px;height:100%;display:flex;flex-direction:column}

/* ── Header ── */
.hdr{text-align:center;padding-bottom:22px;border-bottom:1px solid ${T.border}}
.hdr-title{font-size:18px;font-weight:700;color:${T.text3};letter-spacing:-0.3px}
.hdr-num{font-size:10px;color:${T.text3};margin-top:4px;letter-spacing:0.3px}

/* ── Hero amount ── */
.hero{text-align:center;padding:22px 0 20px;border-bottom:1px solid ${T.border}}
.hero-label{font-size:9px;color:${T.text3};text-transform:uppercase;letter-spacing:2px;margin-bottom:10px}
.hero-amt{font-size:44px;font-weight:700;color:${T.white};letter-spacing:-1.5px;line-height:1}
.hero-amt .cur{font-size:24px;color:${T.text3};font-weight:400;margin-right:3px}
.hero-sub{font-size:9px;color:${T.text3};margin-top:10px;display:flex;align-items:center;justify-content:center;gap:8px}
.bdg{font-size:7px;font-weight:700;padding:2px 7px;border-radius:3px;letter-spacing:0.5px}
.ok{background:rgba(52,211,153,.12);color:${T.green};border:1px solid rgba(52,211,153,.25)}
.late{background:rgba(248,113,113,.12);color:${T.red};border:1px solid rgba(248,113,113,.25)}

/* ── Details ── */
.details{flex:1;display:flex;flex-direction:column;justify-content:center;padding:8px 0}
.tbl{width:100%;border-collapse:collapse}
.tbl td{padding:10px 0;font-size:11.5px;vertical-align:top}
.tbl tr{border-bottom:1px solid ${T.border}}
.tbl tr:last-child{border-bottom:none}
.tbl .lbl{color:${T.text3};width:120px;white-space:nowrap;font-size:11px}
.tbl .val{color:${T.text1};font-weight:500;text-align:right}
.tbl .val.mono{font-family:'SF Mono',Menlo,monospace;font-size:10px;color:${T.text2};letter-spacing:0.3px;word-break:break-all}
.pill{display:inline-block;background:rgba(255,154,109,.08);color:${T.accent};border:1px solid rgba(255,154,109,.18);padding:2px 10px;border-radius:4px;font-size:9px;font-weight:700;letter-spacing:0.4px}
.sec-hdr{font-size:8px;color:${T.text3};text-transform:uppercase;letter-spacing:1.2px;padding:14px 0 6px;border-bottom:1px solid ${T.border}}
.pan{font-family:'SF Mono',Menlo,monospace;font-size:9px;color:${T.text2}}

/* ── Footer ── */
.foot{display:flex;justify-content:space-between;align-items:center;padding-top:16px;border-top:1px solid ${T.border}}
.foot-logo{display:flex;align-items:center;gap:5px}
.foot-logo-t{font-size:10px;font-weight:600;color:${T.accent};letter-spacing:-0.2px}
.foot-n{font-size:7.5px;color:${T.muted};text-align:right;line-height:1.4}
</style>
</head>
<body>
<div class="page">

<div class="hdr">
  <div class="hdr-title">Rent Receipt</div>
  <div class="hdr-num">${esc(r.receiptNumber)}</div>
</div>

<div class="hero">
  <div class="hero-label">Rent Paid</div>
  <div class="hero-amt"><span class="cur">&#8377;</span>${esc(formatINR(p.amount))}</div>
  <div class="hero-sub">
    ${esc(fmtDate(p.paidAt))} &middot; ${esc(fmtTime(p.paidAt))}
    ${timelinessHtml}
  </div>
</div>

<div class="details">
  <table class="tbl">
    <tr><td class="lbl">Rent Month</td><td class="val" style="font-weight:600">${esc(p.rentMonthDisplay)}</td></tr>
    <tr><td class="lbl">Payment Method</td><td class="val"><span class="pill">${esc(method)}</span></td></tr>
    <tr><td class="lbl">UTR / Ref</td><td class="val mono">${esc(ref)}</td></tr>
  </table>

  <div class="sec-hdr">Parties</div>
  <table class="tbl">
    <tr>
      <td class="lbl">Tenant</td>
      <td class="val">${esc(tenant.name) || '—'}${tenant.panMasked ? ` <span class="pan">${esc(tenant.panMasked.replace(/\*/g, ''))}</span>` : ''}</td>
    </tr>
    <tr>
      <td class="lbl">Landlord</td>
      <td class="val">${esc(landlord.name)}${landlord.panMasked ? ` <span class="pan">${esc(landlord.panMasked.replace(/\*/g, ''))}</span>` : ''}</td>
    </tr>
    ${addr ? `<tr><td class="lbl">Property</td><td class="val">${addr}</td></tr>` : ''}
  </table>
</div>

<div class="foot">
  <div class="foot-logo">
    <svg width="12" height="15" viewBox="0 0 34 40" fill="none"><path d="M12.4751 40H3.72631V21.2062H0V16.0217H3.72631C1.65252 7.98576 7.50667 3.16855 10.693 1.76445C20.025 -3.16081 29.7028 3.38457 33.3751 7.27293V40H24.6263V11.6473C19.5714 3.35216 13.2312 5.27474 10.693 7.27293C7.45266 12.8463 12.0431 15.4277 14.7433 16.0217H19.2798V21.2062H12.4751V40Z" fill="${T.accent}"/></svg>
    <span class="foot-logo-t">Secured by Flent</span>
  </div>
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

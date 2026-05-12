"use client";

import { formatCurrency, formatDate, maskPhone } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { UserFunnel } from "@/types/user";
import { Tip } from "@/components/ui/tip";

const DASH = "—";

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[12px] text-muted-foreground/50">{label}</span>
      <span className={`font-mono text-[12px] font-medium ${
        ok === true ? "text-success" : ok === false ? "text-destructive" : value === DASH ? "text-muted-foreground/20" : "text-foreground"
      }`}>{value}</span>
    </div>
  );
}

export function LandlordDetail({ user }: { user: UserFunnel }) {
  const landlordName = user.landlord_display_name || user.landlord_name || "Unknown Landlord";

  return (
    <div className="flex flex-1 flex-col overflow-auto p-6 gap-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <UserAvatar name={landlordName} size={44} />
        <div className="flex flex-col min-w-0">
          <h2 className="text-[18px] font-bold tracking-[-0.3px] text-foreground">{landlordName}</h2>
          <span className="font-mono text-[11px] text-muted-foreground/40">
            {user.landlord_phone ? maskPhone(user.landlord_phone, user.landlord_country_code) : "No phone"}{user.property_city ? ` · ${user.property_city}` : ""}
          </span>
        </div>
      </div>

      {/* Cards row */}
      <div className="grid grid-cols-3 gap-3">
        {/* Tenant card */}
        <div className="rounded-xl border border-[#3D5A80]/30 bg-[#3D5A80]/5 p-4">
          <Tip text="The tenant associated with this landlord's tenancy"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#3D5A80]/60">Tenant</span></Tip>
          <div className="mt-2 text-[14px] font-medium text-foreground truncate">{user.name || maskPhone(user.phone)}</div>
          <div className="font-mono text-[10px] text-muted-foreground/40 mt-0.5 uppercase">{user.user_status} · {user.risk_level || "—"}</div>
        </div>

        {/* Bank status */}
        <div className={`rounded-xl border p-4 ${user.landlord_bank_verified ? "border-success/30 bg-success/5" : "border-[#1F1F1F] bg-[#141414]"}`}>
          <Tip text="Landlord's bank account verification — required for rent settlement"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground/30">Bank</span></Tip>
          <div className={`mt-2 text-[14px] font-bold ${user.landlord_bank_verified ? "text-success" : "text-muted-foreground/30"}`}>
            {user.landlord_bank_verified ? "Verified" : "Not verified"}
          </div>
          <div className={`font-mono text-[10px] mt-0.5 ${user.landlord_bank_pan_verified ? "text-success/60" : "text-muted-foreground/20"}`}>
            PAN {user.landlord_bank_pan_verified ? "✓" : "✗"}
          </div>
        </div>

        {/* Payments */}
        <div className="rounded-xl border border-[#1F1F1F] bg-[#141414] p-4">
          <Tip text="Rent payments received for this landlord's property"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground/30">Payments</span></Tip>
          <div className="mt-2 text-[14px] font-bold text-foreground">{user.successful_payments || 0} <span className="text-[11px] font-normal text-muted-foreground/30">paid</span></div>
          <div className="font-mono text-[10px] text-muted-foreground/40 mt-0.5">{formatCurrency(user.total_paid_paise)}</div>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Verification */}
        <div className="rounded-xl border border-[#1F1F1F] bg-[#141414] p-4">
          <Tip text="Landlord identity and bank verification checks"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground/30 mb-2 block">Verification</span></Tip>
          <Row label="Bank Verified" value={user.landlord_bank_verified === true ? "Verified" : user.landlord_bank_verified === false ? "Failed" : "Not started"} ok={user.landlord_bank_verified === true ? true : user.landlord_bank_verified === false ? false : undefined} />
          <Row label="PAN Verified" value={user.landlord_bank_pan_verified === true ? "Verified" : user.landlord_bank_pan_verified === false ? "Failed" : "Not started"} ok={user.landlord_bank_pan_verified === true ? true : user.landlord_bank_pan_verified === false ? false : undefined} />
          <Row label="Approved" value={user.landlord_approved === true ? "Yes" : "No"} ok={user.landlord_approved === true} />
          <Row label="Name Match" value={user.landlord_bank_agreement_name_matched === true ? "Matched" : user.landlord_bank_agreement_name_matched === false ? "Mismatch" : "Not checked"} ok={user.landlord_bank_agreement_name_matched === true ? true : user.landlord_bank_agreement_name_matched === false ? false : undefined} />
          {user.landlord_bank_agreement_match_score != null && (
            <Row label="Match Score" value={`${user.landlord_bank_agreement_match_score}%`} ok={user.landlord_bank_agreement_match_score >= 80} />
          )}
        </div>

        {/* Identity & Stamp */}
        <div className="rounded-xl border border-[#1F1F1F] bg-[#141414] p-4">
          <Tip text="Landlord name verification via M360 and SHCIL, plus e-stamp validation of the rental agreement"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground/30 mb-2 block">Identity & Stamp</span></Tip>
          <Row label="M360 Name" value={user.landlord_m360_full_name || DASH} />
          <Row label="SHCIL Name" value={user.shcil_landlord_name || DASH} />
          {user.shcil_landlord_name_matched != null && (
            <Row label="SHCIL Match" value={user.shcil_landlord_name_matched ? "Matched" : "Mismatch"} ok={user.shcil_landlord_name_matched} />
          )}
          <Row label="Stamp" value={user.stamp_verification_status?.toUpperCase() || "NOT ATTEMPTED"} ok={user.stamp_verification_status === "verified" ? true : user.stamp_verification_status ? false : undefined} />
          {user.stamp_verified_at && <Row label="Stamp Verified" value={formatDate(user.stamp_verified_at)} />}
        </div>

        {/* Property */}
        <div className="rounded-xl border border-[#1F1F1F] bg-[#141414] p-4">
          <Tip text="Rental property details extracted from the agreement"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground/30 mb-2 block">Property</span></Tip>
          {user.property_address && (
            <div className="mb-2">
              <span className="text-[11px] text-muted-foreground/50">Address</span>
              <p className="font-mono text-[11px] text-foreground/80 mt-0.5 leading-relaxed">{user.property_address}</p>
            </div>
          )}
          <Row label="City" value={user.property_city ? `${user.property_city}${user.property_state ? `, ${user.property_state}` : ""}` : DASH} />
          <Row label="Pincode" value={user.property_pincode || DASH} />
          <Row label="BHK" value={user.property_bhk_type || DASH} />
        </div>

        {/* Financials */}
        <div className="rounded-xl border border-[#1F1F1F] bg-[#141414] p-4">
          <Tip text="Rent, deposit, and maintenance amounts from the agreement — lease dates and last payment"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground/30 mb-2 block">Financials</span></Tip>
          <Row label="Rent" value={user.monthly_rent_paise ? `${formatCurrency(user.monthly_rent_paise)}/mo` : DASH} />
          <Row label="Security Deposit" value={formatCurrency(user.security_deposit_paise) || DASH} />
          <Row label="Maintenance" value={formatCurrency(user.maintenance_paise) || DASH} />
          {user.lease_start_date && <Row label="Lease" value={`${formatDate(user.lease_start_date)} – ${formatDate(user.lease_end_date)}`} />}
          {user.last_payment_at && <Row label="Last Payment" value={formatDate(user.last_payment_at)} />}
        </div>
      </div>
    </div>
  );
}

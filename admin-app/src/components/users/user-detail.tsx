"use client";

import { useState, useCallback } from "react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatCurrencyShort, formatDate, maskPhone, formatRelativeTime, formatTAT, tatColor } from "@/lib/utils";
import { computeDecision } from "@/lib/decision";
import { callEdgeFunction, updateExtraction } from "@/lib/supabase";
import type { UserFunnel } from "@/types/user";
import { VerdictCard } from "./verdict-card";
import { CommunicationsBlock } from "./communications-block";
import { ApprovalPreflight } from "./approval-preflight";
import { RejectDialog } from "@/components/dialogs/reject-dialog";
import { Tip } from "@/components/ui/tip";

const DASH = "—";

function statusBadgeColor(status: string) {
  switch (status) {
    case "active": return "border-success text-success";
    case "approved":
    case "agreement_confirmed": return "border-success/60 text-success";
    case "waitlisted": return "border-warning text-warning";
    default: return "border-muted-foreground/30 text-muted-foreground";
  }
}

export function UserDetail({ user }: { user: UserFunnel }) {
  const [showPreflight, setShowPreflight] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvalResult, setApprovalResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showRawData, setShowRawData] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);
  const [editFields, setEditFields] = useState<Record<string, string>>({});

  const startEditing = useCallback(() => {
    setEditFields({
      monthly_rent_paise: user.monthly_rent_paise != null ? String(user.monthly_rent_paise / 100) : "",
      security_deposit_paise: user.security_deposit_paise != null ? String(user.security_deposit_paise / 100) : "",
      maintenance_paise: user.maintenance_paise != null ? String(user.maintenance_paise / 100) : "",
      rent_due_day: user.rent_due_day != null ? String(user.rent_due_day) : "",
      property_address: user.property_address || "",
      property_city: user.property_city || "",
      property_state: user.property_state || "",
      property_pincode: user.property_pincode || "",
      property_bhk_type: user.property_bhk_type || "",
      lease_start_date: user.lease_start_date || "",
      lease_end_date: user.lease_end_date || "",
      landlord_name: user.landlord_display_name || user.landlord_name || "",
      landlord_phone: user.landlord_phone || "",
      rooms_in_agreement: user.rooms_in_agreement != null ? String(user.rooms_in_agreement) : "",
    });
    setSaveResult(null);
    setEditingAgreement(true);
  }, [user]);

  const updateField = useCallback((key: string, value: string) => {
    setEditFields((prev) => ({ ...prev, [key]: value }));
  }, []);

  async function handleSaveAgreement() {
    if (!user.extraction_id) {
      setSaveResult({ success: false, message: "No extraction record to update" });
      return;
    }
    setSaving(true);
    setSaveResult(null);
    try {
      const payload: Record<string, unknown> = {};
      const ef = editFields;
      if (ef.monthly_rent_paise) payload.monthly_rent_paise = Math.round(Number(ef.monthly_rent_paise) * 100);
      if (ef.security_deposit_paise) payload.security_deposit_paise = Math.round(Number(ef.security_deposit_paise) * 100);
      if (ef.maintenance_paise) payload.maintenance_paise = Math.round(Number(ef.maintenance_paise) * 100);
      if (ef.rent_due_day) payload.rent_due_day = Number(ef.rent_due_day);
      if (ef.property_address) payload.property_address = ef.property_address;
      if (ef.property_city) payload.property_city = ef.property_city;
      if (ef.property_state) payload.property_state = ef.property_state;
      if (ef.property_pincode) payload.property_pincode = ef.property_pincode;
      if (ef.property_bhk_type) payload.property_bhk_type = ef.property_bhk_type;
      if (ef.lease_start_date) payload.lease_start_date = ef.lease_start_date;
      if (ef.lease_end_date) payload.lease_end_date = ef.lease_end_date;
      if (ef.landlord_name) payload.landlord_name = ef.landlord_name;
      if (ef.landlord_phone) payload.landlord_phone = ef.landlord_phone;
      if (ef.rooms_in_agreement) payload.rooms_in_agreement = Number(ef.rooms_in_agreement);

      await updateExtraction(user.extraction_id, payload);
      setSaveResult({ success: true, message: "Agreement updated — reload to see changes" });
      setEditingAgreement(false);
    } catch (err) {
      setSaveResult({ success: false, message: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  const decision = computeDecision(user);
  const initials = (user.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const blockers = decision.issues.filter((i) => i.severity === "blocker");
  const warnings = decision.issues.filter((i) => i.severity === "warning");

  async function handleApprove() {
    setApproving(true);
    setApprovalResult(null);
    try {
      await callEdgeFunction("admin-waitlist", { action: "approve", user_ids: [user.user_id] });
      setApprovalResult({ success: true, message: "User approved successfully" });
      setShowPreflight(false);
    } catch (err) {
      setApprovalResult({ success: false, message: err instanceof Error ? err.message : "Approval failed" });
    } finally {
      setApproving(false);
    }
  }

  const bankVerified = user.bank_verified === true;
  const utilityVerified = user.utility_verified === true;
  const landlordApproved = user.landlord_approved === true;
  const m360Status = user.m360_status || "PENDING";
  const riskLevel = user.risk_level || "PENDING";
  const identityVerified = user.m360_status === "SUCCESS";
  const nameMismatch = identityVerified && user.m360_full_name && user.name &&
    user.m360_full_name.toLowerCase() !== user.name.toLowerCase();

  return (
    <div className="flex flex-1 gap-4 overflow-auto p-6">
      {/* Main content — left/center */}
      <div className="flex flex-1 flex-col gap-4 min-w-0">
        {/* Profile header */}
        <div className="flex items-center gap-4">
          <UserAvatar name={user.name || user.phone} size={56} />
          <div className="flex flex-col gap-0.5 flex-1">
            <span className="text-[24px] font-medium tracking-[-0.5px] text-foreground">{user.name || "Unknown"}</span>
            <span className="font-mono text-[12px] text-muted-foreground/50">
              {maskPhone(user.phone)} · {user.user_status?.toUpperCase()} · {user.property_city || "—"}
              {user.waitlist_joined_at && (
                <> · <span className={tatColor(user.waitlist_joined_at)}>Waiting {formatTAT(user.waitlist_joined_at)}</span></>
              )}
              {user.admin_review === "approved" && user.status_updated_at && (
                <> · <span className="text-muted-foreground/40">TAT {formatTAT(user.status_updated_at)}</span></>
              )}
            </span>
          </div>
          <Badge variant="outline" className={`rounded-xl px-4 py-1.5 font-mono text-[12px] font-semibold ${statusBadgeColor(user.user_status)}`}>
            {user.user_status?.toUpperCase() || DASH}
          </Badge>
        </div>

        {/* Verdict card — 5-second decision strip */}
        <VerdictCard user={user} decision={decision} blockers={blockers} warnings={warnings}
          onApprove={() => setShowPreflight(true)} onReject={() => setShowRejectDialog(true)} />

        {approvalResult && (
          <div className={`rounded-xl border px-4 py-2 font-mono text-[11px] ${approvalResult.success ? "border-success/30 bg-success/5 text-success" : "border-destructive/30 bg-destructive/5 text-destructive"}`}>
            {approvalResult.message}
          </div>
        )}

        {showPreflight && (
          <ApprovalPreflight user={user} onConfirmApprove={handleApprove} onCancel={() => setShowPreflight(false)} loading={approving} />
        )}

        {/* Communications — WhatsApp reminders */}
        <CommunicationsBlock user={user} />

        {/* Agreement card */}
        <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-6">
          <div className="flex items-center justify-between mb-5">
            <Tip text="Rental agreement uploaded by tenant — extracted data used for verification and risk assessment"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Agreement</span></Tip>
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold border ${
                user.extraction_status === "completed"
                  ? "bg-success/10 text-success border-success/30"
                  : "bg-warning/10 text-warning border-warning/30"
              }`}>
                {user.extraction_status?.toUpperCase() || "PENDING"}
              </span>
              {user.extraction_confidence != null && (
                <div className="flex items-center gap-2">
                  <Progress value={user.extraction_confidence} className="h-1.5 w-[80px]" />
                  <span className={`font-mono text-[11px] font-bold ${
                    user.extraction_confidence >= 70 ? "text-success" : user.extraction_confidence >= 40 ? "text-warning" : "text-destructive"
                  }`}>{user.extraction_confidence}%</span>
                </div>
              )}
              {editingAgreement ? (
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleSaveAgreement} disabled={saving}
                    className="h-7 rounded-lg bg-success/10 border border-success/30 text-success font-mono text-[10px] font-semibold hover:bg-success/20">
                    {saving ? "Saving…" : "Save"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditingAgreement(false); setSaveResult(null); }} disabled={saving}
                    className="h-7 rounded-lg border-[#252525] font-mono text-[10px] text-muted-foreground hover:bg-[#1F1F1F]">
                    Cancel
                  </Button>
                </div>
              ) : (
                <button onClick={startEditing}
                  className="rounded-lg border border-[#252525] px-2.5 py-1 font-mono text-[10px] text-muted-foreground/50 hover:text-foreground hover:border-[#3D5A80]/30 transition-colors">
                  Edit
                </button>
              )}
            </div>
          </div>

          {saveResult && (
            <div className={`rounded-lg border px-3 py-2 mb-4 font-mono text-[10px] ${
              saveResult.success ? "border-success/30 bg-success/5 text-success" : "border-destructive/30 bg-destructive/5 text-destructive"
            }`}>{saveResult.message}</div>
          )}

          {/* Hero stat tiles */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {editingAgreement ? (
              <>
                <div className="rounded-lg bg-[#1A1A1A] border border-[#252525] px-4 py-3">
                  <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#3D5A80]">Rent (₹)</span>
                  <Input value={editFields.monthly_rent_paise} onChange={(e) => updateField("monthly_rent_paise", e.target.value)}
                    type="number" placeholder="0" className="mt-1 h-8 bg-[#0A0A0A] border-[#252525] font-mono text-[16px] font-bold px-2" />
                </div>
                <div className="rounded-lg bg-[#1A1A1A] border border-[#252525] px-4 py-3">
                  <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#3D5A80]">Deposit (₹)</span>
                  <Input value={editFields.security_deposit_paise} onChange={(e) => updateField("security_deposit_paise", e.target.value)}
                    type="number" placeholder="0" className="mt-1 h-8 bg-[#0A0A0A] border-[#252525] font-mono text-[16px] font-bold px-2" />
                </div>
                <div className="rounded-lg bg-[#1A1A1A] border border-[#252525] px-4 py-3">
                  <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#3D5A80]">Maintenance (₹)</span>
                  <Input value={editFields.maintenance_paise} onChange={(e) => updateField("maintenance_paise", e.target.value)}
                    type="number" placeholder="0" className="mt-1 h-8 bg-[#0A0A0A] border-[#252525] font-mono text-[16px] font-bold px-2" />
                </div>
                <div className="rounded-lg bg-[#1A1A1A] border border-[#252525] px-4 py-3">
                  <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#3D5A80]">Due Day</span>
                  <Input value={editFields.rent_due_day} onChange={(e) => updateField("rent_due_day", e.target.value)}
                    type="number" min={1} max={28} placeholder="1-28" className="mt-1 h-8 bg-[#0A0A0A] border-[#252525] font-mono text-[16px] font-bold px-2" />
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg bg-[#1A1A1A] border border-[#252525] px-4 py-3">
                  <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#3D5A80]">Rent</span>
                  <div className="mt-1 font-mono text-[20px] font-bold text-foreground">{formatCurrencyShort(user.monthly_rent_paise) || DASH}<span className="text-[12px] text-muted-foreground/40">/mo</span></div>
                </div>
                <div className="rounded-lg bg-[#1A1A1A] border border-[#252525] px-4 py-3">
                  <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#3D5A80]">Deposit</span>
                  <div className="mt-1 font-mono text-[16px] font-bold text-foreground">{formatCurrencyShort(user.security_deposit_paise) || DASH}</div>
                </div>
                <div className="rounded-lg bg-[#1A1A1A] border border-[#252525] px-4 py-3">
                  <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#3D5A80]">Maintenance</span>
                  <div className="mt-1 font-mono text-[16px] font-bold text-foreground">{formatCurrencyShort(user.maintenance_paise) || DASH}</div>
                </div>
                <div className="rounded-lg bg-[#1A1A1A] border border-[#252525] px-4 py-3">
                  <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#3D5A80]">Due Day</span>
                  <div className="mt-1 font-mono text-[16px] font-bold text-foreground">{user.rent_due_day ? `${user.rent_due_day}th` : DASH}</div>
                </div>
              </>
            )}
          </div>

          {/* Property section */}
          <div className="rounded-lg bg-[#111111] border border-[#1F1F1F] p-4 mb-3">
            <span className="font-mono text-[8px] uppercase tracking-[1.5px] text-[#3D5A80]">Property</span>
            {editingAgreement ? (
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2.5">
                <div className="col-span-2">
                  <span className="text-[10px] text-muted-foreground/50 mb-1 block">Address</span>
                  <Input value={editFields.property_address} onChange={(e) => updateField("property_address", e.target.value)}
                    placeholder="Property address" className="h-8 bg-[#0A0A0A] border-[#252525] font-mono text-[12px] px-2" />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground/50 mb-1 block">City</span>
                  <Input value={editFields.property_city} onChange={(e) => updateField("property_city", e.target.value)}
                    placeholder="City" className="h-8 bg-[#0A0A0A] border-[#252525] font-mono text-[12px] px-2" />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground/50 mb-1 block">State</span>
                  <Input value={editFields.property_state} onChange={(e) => updateField("property_state", e.target.value)}
                    placeholder="State" className="h-8 bg-[#0A0A0A] border-[#252525] font-mono text-[12px] px-2" />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground/50 mb-1 block">Pincode</span>
                  <Input value={editFields.property_pincode} onChange={(e) => updateField("property_pincode", e.target.value)}
                    maxLength={6} placeholder="600001" className="h-8 bg-[#0A0A0A] border-[#252525] font-mono text-[12px] px-2" />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground/50 mb-1 block">BHK</span>
                  <Input value={editFields.property_bhk_type} onChange={(e) => updateField("property_bhk_type", e.target.value)}
                    placeholder="2BHK" className="h-8 bg-[#0A0A0A] border-[#252525] font-mono text-[12px] px-2" />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground/50 mb-1 block">Rooms</span>
                  <Input value={editFields.rooms_in_agreement} onChange={(e) => updateField("rooms_in_agreement", e.target.value)}
                    type="number" min={1} placeholder="2" className="h-8 bg-[#0A0A0A] border-[#252525] font-mono text-[12px] px-2" />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground/50 mb-1 block">Lease Start</span>
                  <Input value={editFields.lease_start_date} onChange={(e) => updateField("lease_start_date", e.target.value)}
                    type="date" className="h-8 bg-[#0A0A0A] border-[#252525] font-mono text-[12px] px-2" />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground/50 mb-1 block">Lease End</span>
                  <Input value={editFields.lease_end_date} onChange={(e) => updateField("lease_end_date", e.target.value)}
                    type="date" className="h-8 bg-[#0A0A0A] border-[#252525] font-mono text-[12px] px-2" />
                </div>
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-2.5">
                {([
                  ["Address", user.property_address],
                  ["City / State", user.property_city ? `${user.property_city}, ${user.property_state || ""}` : null],
                  ["Pincode", user.property_pincode],
                  ["BHK", user.property_bhk_type],
                  ["Rooms", user.rooms_in_agreement != null ? String(user.rooms_in_agreement) : null],
                  ["Lease", user.lease_start_date ? `${formatDate(user.lease_start_date)} – ${formatDate(user.lease_end_date)}` : null],
                ] as [string, string | null | undefined][]).map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[12px] text-muted-foreground/50">{label}</span>
                    <span className={`font-mono text-[12px] text-right max-w-[60%] truncate ${value ? "text-foreground/80" : "text-muted-foreground/30"}`}>{value || DASH}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Landlord section */}
          <div className="rounded-lg bg-[#111111] border border-[#1F1F1F] p-4">
            <span className="font-mono text-[8px] uppercase tracking-[1.5px] text-[#3D5A80]">Landlord</span>
            {editingAgreement ? (
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2.5">
                <div>
                  <span className="text-[10px] text-muted-foreground/50 mb-1 block">Name</span>
                  <Input value={editFields.landlord_name} onChange={(e) => updateField("landlord_name", e.target.value)}
                    placeholder="Landlord name" className="h-8 bg-[#0A0A0A] border-[#252525] font-mono text-[12px] px-2" />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground/50 mb-1 block">Phone</span>
                  <Input value={editFields.landlord_phone} onChange={(e) => updateField("landlord_phone", e.target.value)}
                    placeholder="+919876543210" className="h-8 bg-[#0A0A0A] border-[#252525] font-mono text-[12px] px-2" />
                </div>
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-2.5">
                {([
                  ["Name", user.landlord_display_name || user.landlord_name],
                  ["Phone", maskPhone(user.landlord_phone, user.landlord_country_code)],
                ] as [string, string | null | undefined][]).map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[12px] text-muted-foreground/50">{label}</span>
                    <span className={`font-mono text-[12px] text-right max-w-[60%] truncate ${value ? "text-foreground/80" : "text-muted-foreground/30"}`}>{value || DASH}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* M360 Identity card */}
        <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-6">
          <div className="flex items-center justify-between mb-5">
            <Tip text="Identity verification via M360 — checks phone OTP, credit score, age, income, and occupation"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">M360 Identity</span></Tip>
            <span className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold border ${
              identityVerified
                ? "bg-success/10 text-success border-success/30"
                : "bg-warning/10 text-warning border-warning/30"
            }`}>
              {m360Status}
            </span>
          </div>
          {nameMismatch && (
            <div className="mb-4 rounded-lg border border-warning/30 bg-warning/5 px-4 py-2.5 font-mono text-[11px] text-warning">
              Name mismatch: M360 &quot;{user.m360_full_name}&quot; vs profile &quot;{user.name}&quot;
            </div>
          )}
          {/* Hero stat tiles */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            <div className="rounded-lg bg-[#1A1A1A] border border-[#252525] px-4 py-3">
              <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#3D5A80]">Age</span>
              <div className="mt-1 font-mono text-[20px] font-bold text-foreground">{user.m360_age || DASH}</div>
            </div>
            <div className="rounded-lg bg-[#1A1A1A] border border-[#252525] px-4 py-3">
              <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#3D5A80]">Occupation</span>
              <div className="mt-1 text-[13px] font-semibold text-foreground">{user.m360_occupation || DASH}</div>
            </div>
            <div className="rounded-lg bg-[#1A1A1A] border border-[#252525] px-4 py-3">
              <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#3D5A80]">Income</span>
              <div className="mt-1 font-mono text-[16px] font-bold text-foreground">{user.m360_total_income || DASH}</div>
            </div>
            <div className="rounded-lg bg-[#1A1A1A] border border-[#252525] px-4 py-3">
              <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#3D5A80]">Credit</span>
              <div className={`mt-1 font-mono text-[20px] font-bold ${
                (user.m360_credit_score ?? 0) >= 700 ? "text-success" :
                (user.m360_credit_score ?? 0) >= 500 ? "text-warning" :
                user.m360_credit_score != null ? "text-destructive" : "text-foreground"
              }`}>{user.m360_credit_score || DASH}</div>
            </div>
          </div>
          {/* Details in sub-sections */}
          <div className="rounded-lg bg-[#111111] border border-[#1F1F1F] p-4">
            <span className="font-mono text-[8px] uppercase tracking-[1.5px] text-[#3D5A80]">Details</span>
            <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-2.5">
              {([
                ["Full Name", user.m360_full_name],
                ["Gender", user.m360_gender],
                ["Date of Birth", user.m360_date_of_birth ? formatDate(user.m360_date_of_birth) : null],
                ["Aadhaar", user.m360_aadhaar_masked],
                ["Mobile Provider", user.m360_mobile_provider],
                ["Connection", user.m360_connection_type],
                ["Risk Level", user.m360_risk_level],
                ["Verified At", user.m360_verified_at ? formatDate(user.m360_verified_at) : null],
              ] as [string, string | null | undefined][]).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[12px] text-muted-foreground/50">{label}</span>
                  <span className={`font-mono text-[12px] ${value ? "text-foreground/80" : "text-muted-foreground/30"}`}>{value || DASH}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stamp + Waitlist side by side */}
        <div className="grid grid-cols-2 gap-4">
          {/* Stamp Verification */}
          <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
            <div className="flex items-center justify-between mb-4">
              <Tip text="E-stamp verification of the rental agreement — confirms the agreement is legally valid"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Stamp</span></Tip>
              <span className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold border ${
                user.stamp_verification_status === "verified"
                  ? "bg-success/10 text-success border-success/30"
                  : user.stamp_verification_status
                    ? "bg-warning/10 text-warning border-warning/30"
                    : "bg-[#1F1F1F] text-muted-foreground/40 border-[#252525]"
              }`}>{user.stamp_verification_status?.toUpperCase() || "NOT ATTEMPTED"}</span>
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-muted-foreground/50">Verified At</span>
                <span className={`font-mono text-[12px] ${user.stamp_verified_at ? "text-foreground/80" : "text-muted-foreground/30"}`}>{user.stamp_verified_at ? formatDate(user.stamp_verified_at) : DASH}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-muted-foreground/50">Attempt</span>
                <span className={`font-mono text-[12px] ${user.stamp_verification_attempt ? "text-foreground/80" : "text-muted-foreground/30"}`}>{user.stamp_verification_attempt?.toString() || DASH}</span>
              </div>
            </div>
          </div>

          {/* Waitlist & Admin */}
          <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
            <Tip text="Admin review status, risk scoring, and waitlist position details"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366] mb-4 block">Waitlist & Admin</span></Tip>
            <div className="flex flex-col gap-2.5">
              {([
                ["Position", user.waitlist_position ? `#${user.waitlist_position}` : null],
                ["Admin Review", user.admin_review],
                ["Risk", user.risk_level ? `${user.risk_level} · ${user.risk_phase || "pre"}` : null],
                ["Referral", user.referral_code],
                ["KYC", user.kyc_status],
                ["Joined", user.waitlist_joined_at ? formatDate(user.waitlist_joined_at) : null],
              ] as [string, string | null | undefined][]).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[12px] text-muted-foreground/50">{label}</span>
                  <span className={`font-mono text-[12px] ${value ? "text-foreground/80" : "text-muted-foreground/30"}`}>{value || DASH}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Raw Data toggle */}
        <button onClick={() => setShowRawData(!showRawData)}
          className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[1.5px] text-muted-foreground/40 hover:text-muted-foreground transition-colors">
          {showRawData ? "▼" : "▶"} Raw data
        </button>
        {showRawData && (
          <div className="rounded-xl border border-[#1F1F1F] bg-[#141414] p-4">
            <pre className="overflow-auto rounded-lg bg-[#0A0A0A] p-3 text-[11px] font-mono text-muted-foreground/60 max-h-[400px]">
              {JSON.stringify(user, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Right column — Verification + Payments + Bank details */}
      <div className="flex w-[280px] flex-shrink-0 flex-col gap-4">
        {/* Verification checklist */}
        <div className="flex flex-col rounded-xl bg-success/10 border border-success/20 p-5">
          <Tip text="Checklist of all verification gates — all must pass for the user to become fully active"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-success/60 mb-4">Verification</span></Tip>
          <div className="flex flex-col gap-3">
            {([
              ["Bank", bankVerified, null],
              ["Utility", utilityVerified, null],
              ["Landlord", landlordApproved, null],
              ["M360", identityVerified, m360Status],
              ["Risk", riskLevel === "LOW", riskLevel],
            ] as [string, boolean, string | null][]).map(([label, verified, display]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[13px] text-foreground">{label}</span>
                <span className={`font-mono text-[12px] font-semibold ${verified ? "text-success" : "text-muted-foreground/40"}`}>
                  {display || (verified ? "✓" : "—")}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Payments card */}
        <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
          <Tip text="This tenant's payment history — successful payments, total collected, and cashback balance"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366] mb-3">Payments</span></Tip>
          <div className="flex items-baseline gap-1 mb-4">
            <span className="font-mono text-[36px] font-bold leading-none tracking-[-1px] text-foreground">{user.successful_payments || 0}</span>
            <span className="font-mono text-[14px] text-muted-foreground/40">/ paid</span>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground/50">Total</span>
              <span className="font-mono text-[13px] font-medium text-foreground">{formatCurrency(user.total_paid_paise)}</span>
            </div>
            <div className="flex items-center justify-between">
              <Tip text="Total cashback given to this tenant across all payments"><span className="text-[12px] text-muted-foreground/50">Cashback Earned</span></Tip>
              <span className="font-mono text-[13px] font-medium text-success">{formatCurrency(user.total_cashback_earned_paise)}</span>
            </div>
            <div className="flex items-center justify-between">
              <Tip text="Unredeemed cashback available for this tenant to use on future payments"><span className="text-[12px] text-muted-foreground/50">CB Balance</span></Tip>
              <span className="font-mono text-[13px] font-medium text-foreground">{formatCurrency(user.cashback_balance_paise)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground/50">Last</span>
              <span className="font-mono text-[12px] text-muted-foreground">{user.last_payment_at ? formatRelativeTime(user.last_payment_at) : DASH}</span>
            </div>
          </div>
        </div>

        {/* Bank & Landlord verification details */}
        <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
          <Tip text="Bank account and landlord verification status — required before rent can be settled"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366] mb-3">Bank & Landlord</span></Tip>
          <div className="flex flex-col gap-2.5">
            {([
              ["Tenant Bank", bankVerified ? "Verified" : "Not verified", bankVerified],
              ["Landlord Bank", user.landlord_bank_verified ? "Verified" : "Not verified", !!user.landlord_bank_verified],
              ["Landlord PAN", user.landlord_bank_pan_verified ? "Verified" : "Not verified", !!user.landlord_bank_pan_verified],
              ["Utility", utilityVerified ? "Verified" : "Not verified", utilityVerified],
              ["Landlord Approved", landlordApproved ? "Yes" : "No", landlordApproved],
            ] as [string, string, boolean][]).map(([label, value, ok]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[12px] text-muted-foreground/50">{label}</span>
                <span className={`font-mono text-[12px] font-medium ${ok ? "text-success" : "text-muted-foreground/40"}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Key dates */}
        <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
          <Tip text="Key dates in this user's journey through the platform"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366] mb-3">Timeline</span></Tip>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground/50">Signed Up</span>
              <span className="font-mono text-[12px] text-muted-foreground">{formatDate(user.signed_up_at)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground/50">Agreement</span>
              <span className="font-mono text-[12px] text-muted-foreground">{user.agreement_uploaded_at ? formatDate(user.agreement_uploaded_at) : DASH}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground/50">M360 Verified</span>
              <span className="font-mono text-[12px] text-muted-foreground">{user.m360_verified_at ? formatDate(user.m360_verified_at) : DASH}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground/50">Status Updated</span>
              <span className="font-mono text-[12px] text-muted-foreground">{user.status_updated_at ? formatDate(user.status_updated_at) : DASH}</span>
            </div>
          </div>
        </div>
      </div>

      <RejectDialog
        open={showRejectDialog}
        onOpenChange={setShowRejectDialog}
        userIds={[user.user_id]}
        userName={user.name || undefined}
        onSuccess={() => setApprovalResult({ success: true, message: "User rejected successfully" })}
        onError={(error) => setApprovalResult({ success: false, message: error })}
      />
    </div>
  );
}

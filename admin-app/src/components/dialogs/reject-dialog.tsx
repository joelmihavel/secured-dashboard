"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { callEdgeFunction } from "@/lib/supabase";

const REJECTION_REASONS = [
  { id: "expired_lease", label: "Expired lease" },
  { id: "incomplete_agreement", label: "Incomplete agreement" },
  { id: "unsupported_city", label: "Unsupported city" },
  { id: "suspicious_activity", label: "Suspicious activity" },
  { id: "other", label: "Other" },
] as const;

interface RejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userIds: string[];
  userName?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function RejectDialog({
  open,
  onOpenChange,
  userIds,
  userName,
  onSuccess,
  onError,
}: RejectDialogProps) {
  const [selectedReasons, setSelectedReasons] = useState<Set<string>>(new Set());
  const [otherText, setOtherText] = useState("");
  const [cooldownHours, setCooldownHours] = useState(24);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleReason(id: string) {
    setSelectedReasons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function reset() {
    setSelectedReasons(new Set());
    setOtherText("");
    setCooldownHours(24);
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      reset();
    }
    onOpenChange(nextOpen);
  }

  async function handleConfirm() {
    if (selectedReasons.size === 0) {
      setError("Select at least one rejection reason.");
      return;
    }
    if (selectedReasons.has("other") && !otherText.trim()) {
      setError("Please describe the reason for rejection.");
      return;
    }

    const rejectionReasons = Array.from(selectedReasons).map((id) => {
      if (id === "other") return otherText.trim();
      return REJECTION_REASONS.find((r) => r.id === id)?.label ?? id;
    });

    setSubmitting(true);
    setError(null);

    try {
      await callEdgeFunction("admin-waitlist", {
        action: "reject",
        user_ids: userIds,
        rejection_reasons: rejectionReasons,
        next_application_hours: cooldownHours,
      });
      reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Rejection failed";
      setError(message);
      onError?.(message);
    } finally {
      setSubmitting(false);
    }
  }

  const isSingleUser = userIds.length === 1;
  const title = isSingleUser
    ? `Reject User${userName ? `: ${userName}` : ""}`
    : `Reject ${userIds.length} Users`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive">{title}</DialogTitle>
          <DialogDescription>
            Select one or more reasons for rejection. The user will be notified
            and may re-apply after the cooldown period.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {/* Rejection reason checkboxes */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Reasons
            </span>
            {REJECTION_REASONS.map((reason) => (
              <label
                key={reason.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border/50 px-3 py-2 hover:bg-muted/30 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedReasons.has(reason.id)}
                  onChange={() => toggleReason(reason.id)}
                  className="size-3.5 rounded border-border accent-destructive"
                />
                <span className="text-xs text-foreground">{reason.label}</span>
              </label>
            ))}
          </div>

          {/* Other reason textarea */}
          {selectedReasons.has("other") && (
            <Textarea
              placeholder="Describe the rejection reason..."
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              className="min-h-[72px] text-xs"
            />
          )}

          {/* Cooldown hours */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Cooldown period
            </span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={720}
                value={cooldownHours}
                onChange={(e) => setCooldownHours(Math.max(1, parseInt(e.target.value) || 24))}
                className="h-8 w-20 text-xs"
              />
              <span className="text-xs text-muted-foreground">hours before re-application</span>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting || selectedReasons.size === 0}
          >
            {submitting ? "Rejecting..." : "Confirm Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

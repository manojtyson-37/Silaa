"use client";

import { useState } from "react";
import { Input, Button } from "@/components/ui";

type ResolutionDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  type: "return" | "replace";
  totalAmount: string | null;
  onSubmit: (payload: any) => Promise<void>;
};

export default function ResolutionDialog({ isOpen, onClose, type, totalAmount, onSubmit }: ResolutionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [refundAmount, setRefundAmount] = useState(totalAmount || "");
  const [accountDetails, setAccountDetails] = useState("");
  const [notes, setNotes] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      const payload: any = { notes };
      
      if (type === "return") {
        if (refundAmount) {
          payload.refund_amount = parseFloat(refundAmount);
        }
        if (accountDetails) {
          payload.refund_account_details = accountDetails;
        }
      }
      
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process resolution");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl shadow-lg w-full max-w-md p-6 overflow-hidden">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            {type === "return" ? "Process Return" : "Process Replacement"}
          </h2>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {type === "return" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Refund Amount (₹)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={refundAmount}
                  onChange={(e: any) => setRefundAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Refund Account Details</label>
                <Input
                  value={accountDetails}
                  onChange={(e: any) => setAccountDetails(e.target.value)}
                  placeholder="e.g., UPI ID, Bank Account Number"
                />
              </div>
            </>
          )}
          
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Notes / Tracking</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors resize-none h-24"
              placeholder={type === "return" ? "Reason for return..." : "Replacement tracking info, reason..."}
            />
          </div>

          {error && <div className="text-red-500 text-sm">{error}</div>}

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? "Processing..." : "Confirm"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

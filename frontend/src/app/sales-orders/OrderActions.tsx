"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getClientToken } from "@/lib/clientAuth";

export default function OrderActions({ orderId, status }: { orderId: number; status: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const fulfill = async () => {
    setError(null);
    try {
      await api.post(`/sales-orders/${orderId}/fulfill?created_by=web`, undefined, getClientToken());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  };

  const cancel = async () => {
    setError(null);
    try {
      await api.post(`/sales-orders/${orderId}/cancel`, undefined, getClientToken());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this sales order? This cannot be undone.")) return;
    setError(null);
    try {
      await api.delete(`/sales-orders/${orderId}`, getClientToken());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  };

  const downloadInvoice = async () => {
    setError(null);
    try {
      const blob = await api.downloadBlob(`/sales-orders/${orderId}/invoice.pdf`, getClientToken());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-so-${orderId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-3">
        {status === "draft" && (
          <>
            <button onClick={fulfill} className="text-sm font-medium text-accent hover:text-primary cursor-pointer transition-colors duration-150">
              Fulfill
            </button>
            <button onClick={cancel} className="text-sm font-medium text-muted-foreground hover:text-destructive cursor-pointer transition-colors duration-150">
              Cancel
            </button>
          </>
        )}
        {(status === "cancelled" || status === "fulfilled") && (
          <button onClick={remove} className="text-sm font-medium text-muted-foreground hover:text-destructive cursor-pointer transition-colors duration-150">
            Delete
          </button>
        )}
        <button onClick={downloadInvoice} className="text-sm font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors duration-150">
          Invoice
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

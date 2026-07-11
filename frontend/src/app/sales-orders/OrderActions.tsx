"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { getClientToken } from "@/lib/clientAuth";

type Props = { orderId: number; status: string; onRefresh?: () => void };

export default function OrderActions({ orderId, status, onRefresh }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = () => { onRefresh ? onRefresh() : router.refresh(); };

  const fulfill = async () => {
    setError(null);
    setLoading(true);
    try {
      await api.post(`/sales-orders/${orderId}/fulfill?created_by=web`, undefined, getClientToken());
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally { setLoading(false); }
  };

  const cancel = async () => {
    setError(null);
    setLoading(true);
    try {
      await api.post(`/sales-orders/${orderId}/cancel`, undefined, getClientToken());
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally { setLoading(false); }
  };

  const remove = async () => {
    if (!window.confirm("Delete this invoice? This cannot be undone.")) return;
    setError(null);
    setLoading(true);
    try {
      await api.delete(`/sales-orders/${orderId}`, getClientToken());
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally { setLoading(false); }
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
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        {/* Print/PDF */}
        <button
          onClick={downloadInvoice}
          title="Download invoice PDF"
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
        >
          <Printer size={15} />
        </button>

        {/* Status actions */}
        {status === "draft" && (
          <>
            <button
              onClick={fulfill}
              disabled={loading}
              title="Mark as fulfilled"
              className="px-2.5 py-1 text-xs font-medium rounded text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              Fulfill
            </button>
            <button
              onClick={cancel}
              disabled={loading}
              title="Cancel invoice"
              className="px-2.5 py-1 text-xs font-medium rounded text-muted-foreground bg-muted/50 hover:bg-muted border border-border transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
          </>
        )}

        {/* Delete — for cancelled and fulfilled */}
        {(status === "cancelled" || status === "fulfilled") && (
          <button
            onClick={remove}
            disabled={loading}
            title="Delete invoice"
            className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
      {error && <p className="text-xs text-destructive max-w-40 text-right">{error}</p>}
    </div>
  );
}

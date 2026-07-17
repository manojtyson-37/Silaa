"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Printer, Eye, Trash2, MoreVertical } from "lucide-react";
import { api } from "@/lib/api";
import { getClientToken } from "@/lib/clientAuth";

type Props = {
  orderId: number;
  status: string;
  onRefresh?: () => void;
  onDelete?: () => void;
};

export default function OrderActions({ orderId, status, onRefresh, onDelete }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

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
      onDelete?.();
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally { setLoading(false); }
  };

  const returnOrder = async () => {
    setError(null);
    setLoading(true);
    try {
      await api.post(`/sales-orders/${orderId}/return?created_by=web`, undefined, getClientToken());
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally { setLoading(false); }
  };

  const replaceOrder = async () => {
    setError(null);
    setLoading(true);
    try {
      await api.post(`/sales-orders/${orderId}/replace?created_by=web`, undefined, getClientToken());
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally { setLoading(false); }
  };

  const printInvoice = () => {
    window.open(`/sales-orders/${orderId}/print`, "_blank");
  };

  const previewInvoice = () => {
    window.open(`/sales-orders/${orderId}/print?preview=true`, "_blank");
  };

  return (
    <div className="flex items-center gap-2">
      {/* Print */}
        <button
          onClick={printInvoice}
          title="Print invoice"
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
        >
          <Printer size={15} />
        </button>

        {/* Status actions menu */}
        {(status === "draft" || status === "fulfilled") && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
            >
              <MoreVertical size={15} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-32 bg-white border border-border rounded shadow-sm z-10 overflow-hidden py-1">
                {status === "draft" && (
                  <>
                    <button
                      onClick={() => { fulfill(); setMenuOpen(false); }}
                      disabled={loading}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-emerald-50 text-emerald-700 disabled:opacity-50"
                    >
                      Fulfill
                    </button>
                    <button
                      onClick={() => { cancel(); setMenuOpen(false); }}
                      disabled={loading}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted text-muted-foreground disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </>
                )}
                {status === "fulfilled" && (
                  <>
                    <button
                      onClick={() => { returnOrder(); setMenuOpen(false); }}
                      disabled={loading}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-amber-50 text-amber-700 disabled:opacity-50"
                    >
                      Return
                    </button>
                    <button
                      onClick={() => { replaceOrder(); setMenuOpen(false); }}
                      disabled={loading}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 text-blue-700 disabled:opacity-50"
                    >
                      Replace
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Delete — for cancelled, fulfilled, returned, replaced, AND draft */}
        {(status === "draft" || status === "cancelled" || status === "fulfilled" || status === "returned" || status === "replaced") && (
          <button
            onClick={remove}
            disabled={loading}
            title="Delete invoice"
            className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Trash2 size={15} />
          </button>
        )}

      {/* Preview */}
        <button
          onClick={previewInvoice}
          title="Preview invoice"
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer ml-1"
        >
          <Eye size={15} />
        </button>
      
      {error && <div className="text-xs text-red-500 font-medium absolute -bottom-5 right-0 whitespace-nowrap">{error}</div>}
    </div>
  );
}

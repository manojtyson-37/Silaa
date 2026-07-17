"use client";

import { useState, useMemo } from "react";
import { Search, Filter } from "lucide-react";
import { SalesOrder, OrderMarginTotal } from "@/lib/api";
import { StatusPill } from "@/components/ui";
import OrderActions from "./OrderActions";
import EditSOForm from "./EditSOForm";

type Props = {
  orders: SalesOrder[];
  margins: OrderMarginTotal[];
};

const STATUS_OPTIONS = ["all", "draft", "fulfilled", "cancelled", "returned", "replaced"];

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtAmount(amount: string | null) {
  if (!amount || amount === "0.00") return "—";
  return `₹${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  fulfilled: "Paid",
  cancelled: "Cancelled",
  returned: "Returned",
  replaced: "Replaced",
};

export default function SOClient({ orders, margins }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const marginByOrderId = useMemo(
    () => Object.fromEntries(margins.map((m) => [m.order_id, m])),
    [margins],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (q) {
        const inv = (o.invoice_number ?? "").toLowerCase();
        const cust = o.customer_name.toLowerCase();
        if (!inv.includes(q) && !cust.includes(q)) return false;
      }
      return true;
    });
  }, [orders, search, statusFilter, refreshKey]);

  return (
    <div>
      {/* Search + filter bar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search invoice no. or client…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
          />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-9 pr-8 py-2 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors appearance-none cursor-pointer"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All statuses" : STATUS_LABEL[s] ?? s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground text-left">
              <th className="px-5 py-3 font-medium">Invoice No.</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No invoices match your search.
                </td>
              </tr>
            ) : (
              filtered.map((order) => (
                <tr key={`${order.id}-${refreshKey}`} className="border-t border-border/60 hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs font-medium text-accent">
                      {order.invoice_number ?? `#${order.id}`}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-foreground font-medium">{order.customer_name}</span>
                      {order.status === "draft" && (
                        <EditSOForm order={order} onSaved={() => setRefreshKey((k) => k + 1)} />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground text-xs">
                    {order.category || "—"}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground text-xs">
                    {fmtDate(order.created_at)}
                  </td>
                  <td className="px-4 py-3.5 text-right tnum font-medium text-foreground">
                    {fmtAmount(order.total_amount)}
                  </td>
                  <td className="px-4 py-3.5">
                    <InvoiceStatusPill status={order.status} />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <OrderActions
                      orderId={order.id}
                      status={order.status}
                      onRefresh={() => setRefreshKey((k) => k + 1)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground text-right">
          {filtered.length} of {orders.length} invoice{orders.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

function InvoiceStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft:      { label: "Draft",      cls: "bg-slate-100 text-slate-600 border-slate-200" },
    fulfilled:  { label: "Paid",       cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    cancelled:  { label: "Cancelled",  cls: "bg-red-50 text-red-600 border-red-200" },
    returned:   { label: "Returned",   cls: "bg-amber-50 text-amber-700 border-amber-200" },
    replaced:   { label: "Replaced",   cls: "bg-blue-50 text-blue-700 border-blue-200" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {status === "fulfilled" && <span className="mr-1">✓</span>}
      {label}
    </span>
  );
}

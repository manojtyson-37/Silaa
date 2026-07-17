"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Filter } from "lucide-react";
import { SalesOrder, OrderMarginTotal } from "@/lib/api";
import { StatusPill, Card } from "@/components/ui";
import OrderActions from "./OrderActions";
import { Edit2 } from "lucide-react";

type Props = {
  orders: SalesOrder[];
  margins: OrderMarginTotal[];
  onEdit: (id: number) => void;
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

export default function SOClient({ orders, margins, onEdit }: Props) {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Optimistic UI state
  const [localOrders, setLocalOrders] = useState<SalesOrder[]>(orders);
  
  // Sync localOrders when orders prop changes (from router.refresh)
  useMemo(() => {
    setLocalOrders(orders);
  }, [orders]);

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
    router.refresh();
  };
  
  const handleDelete = (id: number) => {
    setLocalOrders(prev => prev.filter(o => o.id !== id));
  };

  const marginByOrderId = useMemo(
    () => Object.fromEntries(margins.map((m) => [m.order_id, m])),
    [margins],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return localOrders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (q) {
        const inv = (o.invoice_number ?? "").toLowerCase();
        const cust = o.customer_name.toLowerCase();
        if (!inv.includes(q) && !cust.includes(q)) return false;
      }
      return true;
    });
  }, [localOrders, search, statusFilter, refreshKey]);

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

      {/* Card List Layout */}
      <div className="flex flex-col gap-3 mt-6">
        {filtered.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground text-sm">
            No invoices match your search.
          </Card>
        ) : (
          filtered.map((order) => (
            <Card key={`${order.id}-${refreshKey}`} className="px-5 py-4 flex items-center justify-between group hover:border-accent hover:shadow-sm transition-all duration-200">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-md bg-muted border border-border flex items-center justify-center shrink-0">
                  <span className="text-xs text-muted-foreground font-medium">SO</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-foreground">
                      {order.invoice_number ?? `SO-${order.id}`}
                    </span>
                    <span className="text-muted-foreground font-normal">·</span>
                    <span className="text-sm font-medium">
                      {order.customer_name}
                    </span>
                    {order.status === "draft" && (
                      <button
                        onClick={() => onEdit(order.id)}
                        className="ml-2 text-muted-foreground hover:text-foreground p-1 transition-colors"
                        title="Edit Invoice"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                    <div className="ml-2">
                      <InvoiceStatusPill status={order.status} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-sm truncate">
                    Category: {order.category || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Date: {fmtDate(order.created_at)} · Total: <span className="font-medium text-foreground">{fmtAmount(order.total_amount)}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 relative">
                <div className="flex items-center gap-2">
                  <OrderActions
                    orderId={order.id}
                    status={order.status}
                    onRefresh={handleRefresh}
                    onDelete={() => handleDelete(order.id)}
                  />
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {filtered.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground text-right">
          {filtered.length} of {localOrders.length} invoice{localOrders.length !== 1 ? "s" : ""}
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

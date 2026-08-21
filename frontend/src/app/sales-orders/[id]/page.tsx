import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Phone, MapPin, Tag, Calendar } from "lucide-react";
import { api, SalesOrderDetail } from "@/lib/api";
import { Card } from "@/components/ui";
import { requireAuth } from "@/lib/serverAuth";
import OrderActions from "../OrderActions";
import { notFound } from "next/navigation";

export default async function SalesOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const token = await requireAuth();

  let order: SalesOrderDetail;
  try {
    order = await api.get<SalesOrderDetail>(`/sales-orders/${id}`, token);
  } catch {
    notFound();
  }

  const lines = order.lines ?? [];
  const subtotal = lines.reduce(
    (sum, l) => sum + parseFloat(l.qty) * parseFloat(l.unit_price),
    0
  );
  const gstTotal = lines.reduce(
    (sum, l) =>
      sum +
      parseFloat(l.qty) *
        parseFloat(l.unit_price) *
        (parseFloat(l.gst_percent) / 100),
    0
  );
  const grandTotal = subtotal + gstTotal;

  function fmt(n: number) {
    return n.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function fmtDate(iso: string | null | undefined) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <main className="max-w-3xl mx-auto px-8 py-10">
      <Link
        href="/sales-orders"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft size={14} /> Sales Orders
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-semibold text-foreground tracking-tight">
              {order.invoice_number ?? `SO-${order.id}`}
            </h1>
            <StatusPillLocal status={order.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Order #{order.id}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/sales-orders/${id}/print`}
            className="text-sm px-3 py-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            target="_blank"
          >
            Print Invoice
          </Link>
          <OrderActions
            orderId={order.id}
            status={order.status}
            totalAmount={order.total_amount ?? null}
          />
        </div>
      </div>

      {/* Customer + meta */}
      <Card className="p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Customer</p>
          <p className="font-medium text-foreground">{order.customer_name}</p>
          {order.customer_phone && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
              <Phone size={12} /> {order.customer_phone}
            </p>
          )}
          {order.customer_address && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
              <MapPin size={12} /> {order.customer_address}
              {order.customer_state ? `, ${order.customer_state}` : ""}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <InfoRow icon={<Calendar size={12} />} label="Date" value={fmtDate(order.created_at)} />
          {order.category && (
            <InfoRow icon={<Tag size={12} />} label="Category" value={order.category} />
          )}
        </div>
      </Card>

      {/* Order lines */}
      <Card className="mb-6 overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-sm font-medium text-foreground">Items</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-2.5 text-xs text-muted-foreground font-medium">Item</th>
                <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-medium">Qty</th>
                <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-medium">Unit Price</th>
                <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-medium">GST</th>
                <th className="text-right px-5 py-2.5 text-xs text-muted-foreground font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const lineTotal =
                  parseFloat(line.qty) *
                  parseFloat(line.unit_price) *
                  (1 + parseFloat(line.gst_percent) / 100);
                const label = [line.variant_color, line.variant_size]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <tr key={line.id} className="border-b border-border/50 last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium text-foreground">{label || `Variant ${line.variant_id}`}</p>
                      {line.variant_sku && (
                        <p className="text-xs text-muted-foreground mt-0.5">SKU: {line.variant_sku}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{parseFloat(line.qty)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">₹{fmt(parseFloat(line.unit_price))}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{line.gst_percent}%</td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium">₹{fmt(lineTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t border-border px-5 py-4 flex flex-col items-end gap-1.5">
          <TotalRow label="Subtotal" value={`₹${fmt(subtotal)}`} />
          <TotalRow label="GST" value={`₹${fmt(gstTotal)}`} />
          <div className="border-t border-border mt-1.5 pt-1.5 w-48">
            <TotalRow label="Grand Total" value={`₹${fmt(grandTotal)}`} bold />
          </div>
        </div>
      </Card>

      {/* Resolution */}
      {order.resolution && (
        <Card className="p-5 mb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Resolution</p>
          <div className="text-sm text-foreground">
            <p className="font-medium capitalize">{order.resolution.resolution_type}</p>
            <p className="text-muted-foreground mt-1">
              {fmtDate(order.resolution.resolved_at)}
            </p>
            {order.resolution.refund_amount && (
              <p className="mt-1">Refund: ₹{order.resolution.refund_amount}
                {order.resolution.refund_account_details
                  ? ` → ${order.resolution.refund_account_details}`
                  : ""}
              </p>
            )}
            {order.resolution.notes && (
              <p className="mt-1 text-muted-foreground italic">{order.resolution.notes}</p>
            )}
          </div>
        </Card>
      )}
    </main>
  );
}

function StatusPillLocal({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft:     { label: "Draft",     cls: "bg-slate-100 text-slate-600 border-slate-200" },
    fulfilled: { label: "Paid",      cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    cancelled: { label: "Cancelled", cls: "bg-red-50 text-red-600 border-red-200" },
    returned:  { label: "Returned",  cls: "bg-amber-50 text-amber-700 border-amber-200" },
    replaced:  { label: "Replaced",  cls: "bg-blue-50 text-blue-700 border-blue-200" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {status === "fulfilled" && <span className="mr-1">✓</span>}
      {label}
    </span>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}:</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function TotalRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between w-48 text-sm">
      <span className={bold ? "font-semibold text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
      <span className={bold ? "font-semibold text-foreground tabular-nums" : "tabular-nums"}>
        {value}
      </span>
    </div>
  );
}

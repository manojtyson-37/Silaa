import Link from "next/link";
import { Factory, ShoppingCart, CheckCircle2, Package, ArrowRight, Plus } from "lucide-react";
import { api, DashboardSummary } from "@/lib/api";
import { Card } from "@/components/ui";
import { requireAuth } from "@/lib/serverAuth";

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  order_created:      { label: "Order created",      color: "bg-indigo-400" },
  cutting_recorded:   { label: "Cutting recorded",   color: "bg-blue-500" },
  stitching_sent:     { label: "Sent to stitching",  color: "bg-amber-400" },
  stitching_received: { label: "Stitching received", color: "bg-amber-500" },
  qc_applied:         { label: "QC completed",       color: "bg-emerald-500" },
  rework_recorded:    { label: "Rework recorded",    color: "bg-orange-500" },
  order_closed:       { label: "Order closed",       color: "bg-emerald-600" },
};

function humanEvent(type: string) {
  return EVENT_LABELS[type] ?? { label: type.replace(/_/g, " "), color: "bg-slate-400" };
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const STATS = [
  {
    key: "open_production_orders" as const,
    label: "Open Production Orders",
    sub: "In progress",
    icon: Factory,
    border: "border-l-indigo-500",
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    href: "/production",
  },
  {
    key: "draft_sales_orders" as const,
    label: "Draft Invoices",
    sub: "Awaiting fulfillment",
    icon: ShoppingCart,
    border: "border-l-amber-400",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    href: "/sales-orders",
  },
  {
    key: "fulfilled_sales_orders" as const,
    label: "Fulfilled Invoices",
    sub: "Completed",
    icon: CheckCircle2,
    border: "border-l-emerald-500",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    href: "/sales-orders",
  },
  {
    key: "pending_purchase_orders" as const,
    label: "Pending Purchase Orders",
    sub: "Draft or approved",
    icon: Package,
    border: "border-l-violet-500",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    href: "/purchase-orders",
  },
];

const QUICK_LINKS = [
  { label: "New Invoice",          href: "/sales-orders",     desc: "Create and track a sale" },
  { label: "New Production Order", href: "/production",       desc: "Start cutting & stitching" },
  { label: "New Purchase Order",   href: "/purchase-orders",  desc: "Raise a supplier PO" },
  { label: "Log Expense",          href: "/expenses",         desc: "Salary, commission, cost" },
  { label: "Receive Fabric",       href: "/fabric",           desc: "GRN for new lot" },
  { label: "Reports",              href: "/reports",          desc: "Margins, variance, costs" },
];

export default async function Home() {
  const token = await requireAuth();
  const summary = await api.get<DashboardSummary>("/dashboard/summary", token);

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <main className="max-w-6xl mx-auto px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{today}</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {STATS.map(({ key, label, sub, icon: Icon, border, iconBg, iconColor, href }) => (
          <Link key={key} href={href}>
            <Card className={`border-l-4 ${border} p-4 hover:shadow-md transition-shadow duration-150 h-full`}>
              <div className={`inline-flex p-1.5 rounded-md ${iconBg} mb-3`}>
                <Icon size={15} className={iconColor} strokeWidth={2} />
              </div>
              <div className={`tnum text-2xl font-semibold tracking-tight text-foreground`}>
                {summary[key]}
              </div>
              <div className="mt-1 text-xs font-medium text-foreground/80">{label}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
            </Card>
          </Link>
        ))}
      </div>

      {/* 2-col body */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Recent activity — 2/3 */}
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
            <Link href="/production" className="text-xs text-muted-foreground hover:text-accent flex items-center gap-1 transition-colors">
              All production <ArrowRight size={11} />
            </Link>
          </div>

          {summary.recent_events.length === 0 ? (
            <p className="text-sm text-muted-foreground px-5 py-4">No activity yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="px-5 py-2.5 font-medium">Event</th>
                  <th className="px-3 py-2.5 font-medium">Order</th>
                  <th className="px-5 py-2.5 text-right font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {summary.recent_events.map((e, i) => {
                  const { label, color } = humanEvent(e.event_type);
                  return (
                    <tr key={i} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
                          <span className="text-foreground">{label}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Link href="/production" className="text-accent text-xs font-mono hover:underline">
                          #{e.production_order_id}
                        </Link>
                      </td>
                      <td className="tnum px-5 py-3 text-right text-xs text-muted-foreground">
                        {relativeTime(e.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        {/* Quick links — 1/3 */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Quick actions</h2>
          <ul className="space-y-1">
            {QUICK_LINKS.map(({ label, href, desc }) => (
              <li key={href + label}>
                <Link
                  href={href}
                  className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors group"
                >
                  <Plus size={14} className="mt-0.5 shrink-0 text-muted-foreground group-hover:text-accent transition-colors" />
                  <div>
                    <div className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </main>
  );
}

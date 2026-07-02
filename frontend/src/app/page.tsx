import Link from "next/link";
import { Boxes, Factory, Shirt, Receipt } from "lucide-react";
import { api, DashboardSummary } from "@/lib/api";
import { Card, PageHeader } from "@/components/ui";
import { requireAuth } from "@/lib/serverAuth";

const CARDS = [
  { href: "/styles", title: "Styles & Variants", desc: "Manage styles, SKUs, and BOM versions", icon: Shirt },
  { href: "/fabric", title: "Fabric Inventory", desc: "Lots, balances, dye-lot tracking", icon: Boxes },
  { href: "/production", title: "Production Orders", desc: "Cutting, stitching, QC, rework", icon: Factory },
  { href: "/expenses", title: "Expenses", desc: "Salaries, commissions, inventory costs", icon: Receipt },
];

export default async function Home() {
  const token = await requireAuth();
  const summary = await api.get<DashboardSummary>("/dashboard/summary", token);

  return (
    <main className="max-w-5xl mx-auto px-8 py-10">
      <PageHeader title="Overview" subtitle="Fabric, Accessories, Production — Phase 1" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Open Production Orders" value={summary.open_production_orders} />
        <StatCard label="Draft Sales Orders" value={summary.draft_sales_orders} />
        <StatCard label="Fulfilled Sales Orders" value={summary.fulfilled_sales_orders} />
        <StatCard label="Pending Purchase Orders" value={summary.pending_purchase_orders} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {CARDS.map(({ href, title, desc, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="p-5 hover:border-accent transition-colors duration-150 h-full">
              <Icon size={20} className="text-accent mb-3" strokeWidth={2} />
              <p className="font-medium text-foreground">{title}</p>
              <p className="text-sm text-muted-foreground mt-1">{desc}</p>
            </Card>
          </Link>
        ))}
      </div>

      <h2 className="font-medium text-foreground mb-2 text-sm">Recent activity</h2>
      <Card className="p-4">
        {summary.recent_events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ol className="text-sm flex flex-col gap-2">
            {summary.recent_events.map((e, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-mono text-xs text-muted-foreground shrink-0 pt-0.5">
                  {new Date(e.created_at).toLocaleString("en-US")}
                </span>
                <span className="text-foreground">
                  {e.event_type} · order #{e.production_order_id}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold text-foreground mt-1">{value}</p>
    </Card>
  );
}

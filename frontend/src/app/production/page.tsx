import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { api, ProductionOrder } from "@/lib/api";
import { Card, PageHeader, StatusPill } from "@/components/ui";

export default async function ProductionListPage() {
  const orders = await api.get<ProductionOrder[]>("/production-orders");

  return (
    <main className="max-w-5xl mx-auto px-8 py-10">
      <PageHeader title="Production Orders" subtitle={`${orders.length} order${orders.length === 1 ? "" : "s"}`} />

      <div className="flex flex-col gap-2">
        {orders.map((o) => (
          <Link key={o.id} href={`/production/${o.id}`}>
            <Card className="px-5 py-3.5 flex items-center justify-between hover:border-accent transition-colors duration-150">
              <div>
                <p className="font-medium text-foreground text-sm">Order #{o.id}</p>
                <p className="text-xs text-muted-foreground">Style {o.style_id} · {o.source}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill value={o.status} />
                <ChevronRight size={16} className="text-muted-foreground" />
              </div>
            </Card>
          </Link>
        ))}
        {orders.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground text-sm">No production orders yet.</Card>
        )}
      </div>
    </main>
  );
}

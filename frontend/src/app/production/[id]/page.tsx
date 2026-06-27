import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api, CostBreakdown, ProductionEvent, ProductionOrder } from "@/lib/api";
import { Card, PageHeader, StatusPill } from "@/components/ui";
import { requireAuth } from "@/lib/serverAuth";
import ProductionOrderDetail, {
  CuttingRecord,
  StitchingBatch,
  VariantBreakdown,
} from "./ProductionOrderDetail";

export default async function ProductionOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const token = await requireAuth();

  const [order, variants, cuttingRecords, batches, events, cost] = await Promise.all([
    api.get<ProductionOrder>(`/production-orders/${id}`, token),
    api.get<VariantBreakdown[]>(`/production-orders/${id}/variants`, token),
    api.get<CuttingRecord[]>(`/production-orders/${id}/cutting-records`, token),
    api.get<StitchingBatch[]>(`/production-orders/${id}/stitching-batches`, token),
    api.get<ProductionEvent[]>(`/production-orders/${id}/events`, token),
    api.get<CostBreakdown>(`/production-orders/${id}/cost-breakdown`, token),
  ]);

  return (
    <main className="max-w-3xl mx-auto px-8 py-10">
      <Link
        href="/production"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft size={14} /> Production Orders
      </Link>
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Order #{order.id}</h1>
        <StatusPill value={order.status} />
      </div>
      <p className="text-sm text-muted-foreground mb-8">
        Style {order.style_id} · {order.source}
      </p>

      <Card className="p-4 mb-8 grid grid-cols-2 sm:grid-cols-5 gap-4">
        <CostStat label="Fabric" value={cost.fabric_cost} />
        <CostStat label="Accessory" value={cost.accessory_cost} />
        <CostStat label="Labor" value={cost.labor_cost} />
        <CostStat label="Total" value={cost.total_cost} />
        <CostStat label="Unit cost" value={cost.unit_cost ?? "—"} />
      </Card>

      <ProductionOrderDetail
        order={order}
        variants={variants}
        initialCuttingRecords={cuttingRecords}
        initialBatches={batches}
        initialEvents={events}
      />
    </main>
  );
}

function CostStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-foreground mt-0.5">₹{value}</p>
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api, ProductionEvent, ProductionOrder } from "@/lib/api";
import { PageHeader, StatusPill } from "@/components/ui";
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

  const [order, variants, cuttingRecords, batches, events] = await Promise.all([
    api.get<ProductionOrder>(`/production-orders/${id}`),
    api.get<VariantBreakdown[]>(`/production-orders/${id}/variants`),
    api.get<CuttingRecord[]>(`/production-orders/${id}/cutting-records`),
    api.get<StitchingBatch[]>(`/production-orders/${id}/stitching-batches`),
    api.get<ProductionEvent[]>(`/production-orders/${id}/events`),
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

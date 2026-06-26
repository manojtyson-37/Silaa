import Link from "next/link";
import { api, ProductionEvent, ProductionOrder } from "@/lib/api";
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
    <main className="max-w-3xl mx-auto py-12 px-4">
      <Link href="/production" className="text-sm text-gray-500">
        &larr; Production Orders
      </Link>
      <h1 className="text-2xl font-semibold mt-2 mb-1">Order #{order.id}</h1>
      <p className="text-sm text-gray-500 mb-6">
        Style {order.style_id} · {order.status} · {order.source}
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

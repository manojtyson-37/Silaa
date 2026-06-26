import Link from "next/link";
import { api, ProductionOrder } from "@/lib/api";

export default async function ProductionListPage() {
  const orders = await api.get<ProductionOrder[]>("/production-orders");

  return (
    <main className="max-w-3xl mx-auto py-12 px-4">
      <Link href="/" className="text-sm text-gray-500">
        &larr; Home
      </Link>
      <h1 className="text-2xl font-semibold mt-2 mb-6">Production Orders</h1>

      <div className="flex flex-col gap-2">
        {orders.map((o) => (
          <Link
            key={o.id}
            href={`/production/${o.id}`}
            className="rounded border px-4 py-3 hover:bg-gray-50 flex justify-between"
          >
            <span>Order #{o.id} — style {o.style_id}</span>
            <span className="text-sm text-gray-500">{o.status} · {o.source}</span>
          </Link>
        ))}
        {orders.length === 0 && <p className="text-gray-500">No production orders yet.</p>}
      </div>
    </main>
  );
}

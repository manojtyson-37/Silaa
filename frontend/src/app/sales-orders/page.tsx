import { api, OrderMarginTotal, SalesOrder } from "@/lib/api";
import { requireAuth } from "@/lib/serverAuth";
import InvoicesPageClient from "./InvoicesPageClient";

export default async function SalesOrdersPage() {
  const token = await requireAuth();
  const [orders, margins] = await Promise.all([
    api.get<SalesOrder[]>("/sales-orders", token),
    api.get<OrderMarginTotal[]>("/sales-orders/margins", token),
  ]);

  return (
    <main className="max-w-5xl mx-auto px-8 py-10">
      <InvoicesPageClient orders={orders} margins={margins} />
    </main>
  );
}

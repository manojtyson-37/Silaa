import { api, PurchaseOrder, Supplier } from "@/lib/api";
import { Card, PageHeader } from "@/components/ui";
import NewPOForm from "./NewPOForm";
import POClient from "./POClient";
import { requireAuth } from "@/lib/serverAuth";

export default async function PurchaseOrdersPage() {
  const token = await requireAuth();
  const [orders, suppliers] = await Promise.all([
    api.get<PurchaseOrder[]>("/purchase-orders", token),
    api.get<Supplier[]>("/suppliers", token),
  ]);

  return (
    <main className="max-w-5xl mx-auto px-8 py-10">
      <PageHeader title="Purchase Orders" subtitle={`${orders.length} order${orders.length === 1 ? "" : "s"}`} />

      <NewPOForm suppliers={suppliers} />

      {orders.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">No purchase orders yet.</Card>
      ) : (
        <POClient orders={orders} suppliers={suppliers} />
      )}
    </main>
  );
}

import { api, OrderMarginTotal, SalesOrder } from "@/lib/api";
import { Card, PageHeader } from "@/components/ui";
import NewSalesOrderForm from "./NewSalesOrderForm";
import SOClient from "./SOClient";
import { requireAuth } from "@/lib/serverAuth";

export default async function SalesOrdersPage() {
  const token = await requireAuth();
  const [orders, margins] = await Promise.all([
    api.get<SalesOrder[]>("/sales-orders", token),
    api.get<OrderMarginTotal[]>("/sales-orders/margins", token),
  ]);

  return (
    <main className="max-w-5xl mx-auto px-8 py-10">
      <PageHeader title="Invoices" subtitle={`${orders.length} invoice${orders.length === 1 ? "" : "s"}`} />

      <NewSalesOrderForm />

      {orders.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">No invoices yet.</Card>
      ) : (
        <SOClient orders={orders} margins={margins} />
      )}
    </main>
  );
}

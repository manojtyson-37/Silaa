import { api, ProductionOrder, StyleWithVariants } from "@/lib/api";
import { PageHeader } from "@/components/ui";
import { requireAuth } from "@/lib/serverAuth";
import ProductionClient from "./ProductionClient";

export default async function ProductionListPage() {
  const token = await requireAuth();
  
  const [orders, styles] = await Promise.all([
    api.get<ProductionOrder[]>("/production-orders", token),
    api.get<StyleWithVariants[]>("/styles-with-variants", token),
  ]);

  return (
    <main className="max-w-5xl mx-auto px-8 py-10">
      <PageHeader title="Production Orders" subtitle={`${orders.length} order${orders.length === 1 ? "" : "s"}`} />
      <ProductionClient orders={orders} styles={styles} />
    </main>
  );
}

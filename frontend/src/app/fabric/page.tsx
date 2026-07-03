import { api, FabricItem, FabricLotWithBalance, Supplier } from "@/lib/api";
import { Card, PageHeader, Table, Td, Th } from "@/components/ui";
import NewFabricItemForm from "./NewFabricItemForm";
import FabricClient from "./FabricClient";
import { requireAuth } from "@/lib/serverAuth";

export default async function FabricPage() {
  const token = await requireAuth();
  const [lots, fabricItems, suppliers] = await Promise.all([
    api.get<FabricLotWithBalance[]>("/fabric-lots-with-balance", token),
    api.get<FabricItem[]>("/fabric-items", token),
    api.get<Supplier[]>("/suppliers", token),
  ]);

  return (
    <main className="max-w-5xl mx-auto px-8 py-10">
      <PageHeader title="Fabric Inventory" subtitle={`${lots.length} lot${lots.length === 1 ? "" : "s"}`} />
      <div className="flex gap-4 mb-5">
        <NewFabricItemForm />
      </div>

      {fabricItems.length > 0 ? (
        <FabricClient fabricItems={fabricItems} lots={lots} suppliers={suppliers} />
      ) : (
        <Card className="p-8 text-center text-muted-foreground text-sm">No fabrics in inventory.</Card>
      )}
    </main>
  );
}

import { api, FabricItem, FabricLotWithBalance, Supplier } from "@/lib/api";
import { Card, PageHeader, Table, Td, Th } from "@/components/ui";
import NewFabricItemForm from "./NewFabricItemForm";
import GRNForm from "./GRNForm";
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
      <div className="flex gap-4 mb-1">
        <NewFabricItemForm />
        {fabricItems.length > 0 && suppliers.length > 0 && (
          <GRNForm fabricItems={fabricItems} suppliers={suppliers} />
        )}
      </div>

      {fabricItems.length > 0 && <FabricClient fabricItems={fabricItems} />}

      {lots.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">No fabric lots yet.</Card>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Lot</Th>
              <Th>Dye Lot</Th>
              <Th>Cost / unit</Th>
              <Th>Balance</Th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => (
              <tr key={lot.id}>
                <Td className="font-mono text-xs">#{lot.id}</Td>
                <Td className="text-muted-foreground">{lot.dye_lot_no ?? "—"}</Td>
                <Td>₹{lot.cost_per_uom}</Td>
                <Td className="font-medium">{lot.balance}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </main>
  );
}

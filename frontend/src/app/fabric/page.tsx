import { api, FabricLot } from "@/lib/api";
import { Card, PageHeader, Table, Td, Th } from "@/components/ui";

type Balance = { fabric_lot_id: number; balance: string };

export default async function FabricPage() {
  const lots = await api.get<FabricLot[]>("/fabric-lots");
  const balances = await Promise.all(
    lots.map((l) => api.get<Balance>(`/fabric-lots/${l.id}/balance`))
  );

  return (
    <main className="max-w-5xl mx-auto px-8 py-10">
      <PageHeader title="Fabric Inventory" subtitle={`${lots.length} lot${lots.length === 1 ? "" : "s"}`} />

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
            {lots.map((lot, i) => (
              <tr key={lot.id}>
                <Td className="font-mono text-xs">#{lot.id}</Td>
                <Td className="text-muted-foreground">{lot.dye_lot_no ?? "—"}</Td>
                <Td>₹{lot.cost_per_uom}</Td>
                <Td className="font-medium">{balances[i].balance}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </main>
  );
}

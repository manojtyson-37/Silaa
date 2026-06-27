import { api, AccessoryItem, Supplier } from "@/lib/api";
import { Card, PageHeader, Table, Td, Th } from "@/components/ui";
import NewAccessoryItemForm from "./NewAccessoryItemForm";
import GRNForm from "./GRNForm";

type Balance = { accessory_item_id: number; balance: string };

export default async function AccessoriesPage() {
  const [items, suppliers] = await Promise.all([
    api.get<AccessoryItem[]>("/accessory-items"),
    api.get<Supplier[]>("/suppliers"),
  ]);
  const balances = await Promise.all(
    items.map((it) => api.get<Balance>(`/accessory-items/${it.id}/balance`))
  );

  return (
    <main className="max-w-5xl mx-auto px-8 py-10">
      <PageHeader title="Accessory Inventory" subtitle={`${items.length} item${items.length === 1 ? "" : "s"}`} />
      <div className="flex gap-4 mb-1">
        <NewAccessoryItemForm />
        {items.length > 0 && suppliers.length > 0 && <GRNForm accessoryItems={items} suppliers={suppliers} />}
      </div>

      {items.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">No accessory items yet.</Card>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Item</Th>
              <Th>Type</Th>
              <Th>Unit</Th>
              <Th>Balance</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id}>
                <Td className="font-medium">{item.name}</Td>
                <Td className="text-muted-foreground">{item.type}</Td>
                <Td className="text-muted-foreground">{item.consumption_uom}</Td>
                <Td className="font-medium">{balances[i].balance}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </main>
  );
}

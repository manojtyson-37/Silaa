import { api, PurchaseOrder, Supplier } from "@/lib/api";
import { Card, PageHeader, StatusPill, Table, Td, Th } from "@/components/ui";
import NewPOForm from "./NewPOForm";
import ApproveButton from "./ApproveButton";
import { requireAuth } from "@/lib/serverAuth";

export default async function PurchaseOrdersPage() {
  const token = await requireAuth();
  const [orders, suppliers] = await Promise.all([
    api.get<PurchaseOrder[]>("/purchase-orders", token),
    api.get<Supplier[]>("/suppliers", token),
  ]);
  const supplierName = (id: number) => suppliers.find((s) => s.id === id)?.name ?? `#${id}`;

  return (
    <main className="max-w-5xl mx-auto px-8 py-10">
      <PageHeader title="Purchase Orders" subtitle={`${orders.length} order${orders.length === 1 ? "" : "s"}`} />

      <NewPOForm suppliers={suppliers} />

      {orders.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">No purchase orders yet.</Card>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>PO</Th>
              <Th>Supplier</Th>
              <Th>Status</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {orders.map((po) => (
              <tr key={po.id}>
                <Td className="font-mono text-xs">#{po.id}</Td>
                <Td>{supplierName(po.supplier_id)}</Td>
                <Td>
                  <StatusPill value={po.status} />
                </Td>
                <Td>{po.status === "draft" && <ApproveButton poId={po.id} />}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </main>
  );
}

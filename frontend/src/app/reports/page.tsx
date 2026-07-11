import { api, FabricVarianceRow, Style, Supplier, WastageRejectionReport } from "@/lib/api";
import { fmtQty } from "@/lib/format";
import { Card, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireAuth } from "@/lib/serverAuth";

export default async function ReportsPage() {
  const token = await requireAuth();
  const [variance, wastage, styles, suppliers] = await Promise.all([
    api.get<FabricVarianceRow[]>("/reports/fabric-variance", token),
    api.get<WastageRejectionReport>("/reports/wastage", token),
    api.get<Style[]>("/styles", token),
    api.get<Supplier[]>("/suppliers", token),
  ]);

  const styleMap = new Map(styles.map((s) => [s.id, s.name]));
  const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));

  return (
    <main className="max-w-5xl mx-auto px-8 py-10">
      <PageHeader title="Reports" subtitle="Fabric variance, wastage & rejection" />

      <h2 className="font-medium text-foreground mb-2 text-sm">Fabric consumption vs BOM-planned</h2>
      {variance.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm mb-8">No cutting records yet.</Card>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Order</Th>
              <Th>Style</Th>
              <Th>Lot</Th>
              <Th>Planned</Th>
              <Th>Actual</Th>
              <Th>Variance</Th>
              <Th>Wastage</Th>
            </tr>
          </thead>
          <tbody>
            {variance.map((row) => (
              <tr key={row.cutting_record_id}>
                <Td className="font-mono text-xs">#{row.production_order_id}</Td>
                <Td>{styleMap.get(row.style_id) ?? `Style #${row.style_id}`}</Td>
                <Td className="font-mono text-xs">#{row.fabric_lot_id}</Td>
                <Td>{fmtQty(row.planned_fabric_qty)}</Td>
                <Td>{fmtQty(row.actual_fabric_qty)}</Td>
                <Td className={Number(row.variance_qty) > 0 ? "text-destructive font-medium" : ""}>
                  {fmtQty(row.variance_qty)}
                </Td>
                <Td className="text-muted-foreground">{fmtQty(row.wastage_qty)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
        <ReportCard
          title="Wastage by style"
          rows={wastage.wastage_by_style.map((r) => [styleMap.get(r.style_id) ?? `Style #${r.style_id}`, fmtQty(r.wastage_qty)])}
        />
        <ReportCard
          title="Rejection by vendor"
          rows={wastage.rejection_by_vendor.map((r) => [
            r.vendor_id ? (supplierMap.get(r.vendor_id) ?? `Vendor #${r.vendor_id}`) : "In-house",
            r.rejected_qty,
          ])}
        />
        <ReportCard
          title="Scrapped by style"
          rows={wastage.scrapped_by_style.map((r) => [styleMap.get(r.style_id) ?? `Style #${r.style_id}`, fmtQty(r.scrapped_qty)])}
        />
      </div>
    </main>
  );
}

function ReportCard({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <Card className="p-4">
      <h3 className="font-medium text-foreground mb-2 text-sm">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">None</p>
      ) : (
        <ul className="text-sm flex flex-col gap-1">
          {rows.map(([label, value]) => (
            <li key={label} className="flex justify-between">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium text-foreground">{value}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

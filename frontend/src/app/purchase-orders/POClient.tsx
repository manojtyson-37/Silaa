"use client";

import { useState } from "react";
import { PurchaseOrder, Supplier } from "@/lib/api";
import { StatusPill, Table, Td, Th } from "@/components/ui";
import ApproveButton from "./ApproveButton";
import EditPOForm from "./EditPOForm";

type Props = {
  orders: PurchaseOrder[];
  suppliers: Supplier[];
};

export default function POClient({ orders, suppliers }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const supplierName = (id: number) => suppliers.find((s) => s.id === id)?.name ?? `#${id}`;

  return (
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
          <tr key={`${po.id}-${refreshKey}`}>
            <Td className="font-mono text-xs">#{po.id}</Td>
            <Td className="flex items-center gap-2">
              {supplierName(po.supplier_id)}
              {po.status === "draft" && (
                <EditPOForm po={po} suppliers={suppliers} onSaved={() => setRefreshKey(k => k + 1)} />
              )}
            </Td>
            <Td>
              <StatusPill value={po.status} />
            </Td>
            <Td>{po.status === "draft" && <ApproveButton poId={po.id} />}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

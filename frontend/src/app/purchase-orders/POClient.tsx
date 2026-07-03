"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
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
          <Th>Dispatch</Th>
          <Th>Status</Th>
          <Th>Action</Th>
        </tr>
      </thead>
      <tbody>
        {orders.map((po) => (
          <tr key={`${po.id}-${refreshKey}`} className="group">
            <Td className="font-mono text-xs">
              <Link href={`/purchase-orders/${po.id}`} className="hover:text-accent transition-colors">
                #{po.id}
              </Link>
            </Td>
            <Td className="flex items-center gap-2">
              <Link href={`/purchase-orders/${po.id}`} className="hover:text-accent transition-colors flex-1">
                {supplierName(po.supplier_id)}
              </Link>
              {po.status === "draft" && (
                <EditPOForm po={po} suppliers={suppliers} onSaved={() => setRefreshKey(k => k + 1)} />
              )}
            </Td>
            <Td className="text-sm text-muted-foreground">
              {po.dispatch_date ?? "—"}
            </Td>
            <Td>
              <StatusPill value={po.status} />
            </Td>
            <Td className="flex items-center gap-3">
              {po.status === "draft" && <ApproveButton poId={po.id} />}
              <Link href={`/purchase-orders/${po.id}`} className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100">
                <ExternalLink size={14} />
              </Link>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

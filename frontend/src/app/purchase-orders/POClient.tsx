"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Trash2 } from "lucide-react";
import { PurchaseOrder, Supplier, api } from "@/lib/api";
import { StatusPill, Card } from "@/components/ui";
import { getClientToken } from "@/lib/clientAuth";
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
    <div className="flex flex-col gap-3 mt-6">
      {orders.map((po) => (
        <Card key={`${po.id}-${refreshKey}`} className="px-5 py-4 flex items-center justify-between group hover:border-accent hover:shadow-sm transition-all duration-200">
          <div className="flex items-center gap-5">
            {po.image_url ? (
              <div className="w-14 h-14 relative rounded-md overflow-hidden bg-muted border border-border shrink-0">
                <img src={po.image_url} alt={`PO #${po.id}`} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-md bg-muted border border-border flex items-center justify-center shrink-0">
                <span className="text-xs text-muted-foreground font-medium">No Img</span>
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link href={`/purchase-orders/${po.id}`} className="font-medium text-foreground hover:text-accent transition-colors">
                  Order #{po.id}
                </Link>
                <span className="text-muted-foreground font-normal">·</span>
                <Link href={`/purchase-orders/${po.id}`} className="text-sm font-medium hover:text-accent transition-colors">
                  {supplierName(po.supplier_id)}
                </Link>
              </div>
              <p className="text-xs text-muted-foreground max-w-sm truncate">
                {po.description || "No description provided"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Dispatch: {po.dispatch_date || "Pending"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <StatusPill value={po.status} />
            <div className="flex items-center gap-2">
              {po.status === "draft" && (
                <>
                  <ApproveButton poId={po.id} />
                  <EditPOForm po={po} suppliers={suppliers} onSaved={() => setRefreshKey(k => k + 1)} />
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete Order #${po.id}? This cannot be undone.`)) return;
                      try {
                        await api.delete(`/purchase-orders/${po.id}`, getClientToken());
                        setRefreshKey(k => k + 1);
                      } catch (err) {
                        alert(String(err));
                      }
                    }}
                    className="text-muted-foreground hover:text-destructive cursor-pointer transition-colors"
                    title="Delete order"
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              )}
              <Link href={`/purchase-orders/${po.id}`} className="text-muted-foreground hover:text-foreground transition-colors ml-2">
                <ExternalLink size={16} />
              </Link>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

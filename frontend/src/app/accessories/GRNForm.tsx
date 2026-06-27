"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { api, AccessoryItem, Supplier } from "@/lib/api";
import { Button, Card, Input, Select } from "@/components/ui";

export default function GRNForm({ accessoryItems, suppliers }: { accessoryItems: AccessoryItem[]; suppliers: Supplier[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [itemId, setItemId] = useState(accessoryItems[0]?.id?.toString() ?? "");
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id?.toString() ?? "");
  const [poLineId, setPoLineId] = useState("");
  const [receivedQty, setReceivedQty] = useState("");
  const [purchaseUom, setPurchaseUom] = useState("piece");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await api.post(`/accessory-items/${itemId}/receive`, {
        supplier_id: Number(supplierId),
        po_line_id: Number(poLineId),
        received_qty: receivedQty,
        purchase_uom: purchaseUom,
        created_by: "web",
      });
      setReceivedQty("");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-primary mb-5 cursor-pointer transition-colors duration-150"
      >
        <Plus size={14} /> Receive accessory (GRN)
      </button>
    );
  }

  return (
    <Card className="p-4 mb-5 bg-muted/30 flex flex-col gap-3 max-w-xl">
      <Select value={itemId} onChange={(e) => setItemId(e.target.value)}>
        {accessoryItems.map((it) => (
          <option key={it.id} value={it.id}>
            {it.name}
          </option>
        ))}
      </Select>
      <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.type})
          </option>
        ))}
      </Select>
      <div className="flex gap-2">
        <Input placeholder="PO line ID" className="w-28 shrink-0" value={poLineId} onChange={(e) => setPoLineId(e.target.value)} />
        <Input placeholder="Received qty" value={receivedQty} onChange={(e) => setReceivedQty(e.target.value)} />
        <Input placeholder="UOM" className="w-24 shrink-0" value={purchaseUom} onChange={(e) => setPurchaseUom(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2 pt-1">
        <Button onClick={submit} disabled={!itemId || !supplierId || !poLineId || !receivedQty}>
          Save
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

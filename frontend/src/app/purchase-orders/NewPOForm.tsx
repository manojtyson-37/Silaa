"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { api, Supplier } from "@/lib/api";
import { Button, Card, Input, Select } from "@/components/ui";

type Line = {
  component_type: string;
  component_id: string;
  ordered_qty: string;
  ordered_uom: string;
  agreed_price: string;
};

const emptyLine = (): Line => ({
  component_type: "fabric",
  component_id: "",
  ordered_qty: "",
  ordered_uom: "",
  agreed_price: "",
});

export default function NewPOForm({ suppliers }: { suppliers: Supplier[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id?.toString() ?? "");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);

  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const submit = async () => {
    setError(null);
    try {
      await api.post("/purchase-orders", {
        supplier_id: Number(supplierId),
        lines: lines.map((l) => ({
          component_type: l.component_type,
          component_id: Number(l.component_id),
          ordered_qty: l.ordered_qty,
          ordered_uom: l.ordered_uom,
          agreed_price: l.agreed_price,
        })),
      });
      setLines([emptyLine()]);
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
        <Plus size={14} /> New purchase order
      </button>
    );
  }

  return (
    <Card className="p-4 mb-5 bg-muted/30 flex flex-col gap-3 max-w-xl">
      <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.type})
          </option>
        ))}
      </Select>

      {lines.map((line, i) => (
        <div key={i} className="flex flex-wrap gap-2 items-start">
          <Select
            className="w-28 shrink-0"
            value={line.component_type}
            onChange={(e) => updateLine(i, { component_type: e.target.value })}
          >
            <option value="fabric">Fabric</option>
            <option value="accessory">Accessory</option>
          </Select>
          <Input
            placeholder="Item ID"
            className="w-20 shrink-0"
            value={line.component_id}
            onChange={(e) => updateLine(i, { component_id: e.target.value })}
          />
          <Input
            placeholder="Qty"
            className="w-20 shrink-0"
            value={line.ordered_qty}
            onChange={(e) => updateLine(i, { ordered_qty: e.target.value })}
          />
          <Input
            placeholder="UOM"
            className="w-20 shrink-0"
            value={line.ordered_uom}
            onChange={(e) => updateLine(i, { ordered_uom: e.target.value })}
          />
          <Input
            placeholder="Price"
            className="w-24 shrink-0"
            value={line.agreed_price}
            onChange={(e) => updateLine(i, { agreed_price: e.target.value })}
          />
          {lines.length > 1 && (
            <button
              onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
              className="text-muted-foreground hover:text-destructive cursor-pointer p-1.5"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}

      <button
        onClick={() => setLines((prev) => [...prev, emptyLine()])}
        className="text-sm text-accent hover:text-primary cursor-pointer self-start"
      >
        + Add line
      </button>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2 pt-1">
        <Button onClick={submit} disabled={!supplierId}>
          Save
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

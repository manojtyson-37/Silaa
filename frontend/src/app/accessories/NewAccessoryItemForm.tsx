"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button, Card, Input } from "@/components/ui";

export default function NewAccessoryItemForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [consumptionUom, setConsumptionUom] = useState("piece");
  const [defaultCost, setDefaultCost] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await api.post("/accessory-items", {
        name,
        type,
        consumption_uom: consumptionUom,
        default_cost: defaultCost || null,
      });
      setName("");
      setType("");
      setDefaultCost("");
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
        <Plus size={14} /> New accessory item
      </button>
    );
  }

  return (
    <Card className="p-4 mb-5 bg-muted/30 flex flex-col gap-3 max-w-xl">
      <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="flex gap-2">
        <Input placeholder="Type (e.g. button, zipper)" value={type} onChange={(e) => setType(e.target.value)} />
        <Input placeholder="Consumption UOM" className="w-32 shrink-0" value={consumptionUom} onChange={(e) => setConsumptionUom(e.target.value)} />
      </div>
      <Input placeholder="Default cost (optional)" value={defaultCost} onChange={(e) => setDefaultCost(e.target.value)} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2 pt-1">
        <Button onClick={submit} disabled={!name || !type}>
          Save
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

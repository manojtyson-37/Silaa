"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getClientToken } from "@/lib/clientAuth";
import { Button, Card, Input } from "@/components/ui";

export default function NewFabricItemForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [composition, setComposition] = useState("");
  const [gsm, setGsm] = useState("");
  const [width, setWidth] = useState("");
  const [consumptionUom, setConsumptionUom] = useState("meter");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await api.post("/fabric-items", {
        name,
        composition: composition || null,
        gsm: gsm ? Number(gsm) : null,
        width: width || null,
        consumption_uom: consumptionUom,
      }, getClientToken());
      setName("");
      setComposition("");
      setGsm("");
      setWidth("");
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
        <Plus size={14} /> New fabric item
      </button>
    );
  }

  return (
    <Card className="p-4 mb-5 bg-muted/30 flex flex-col gap-3 max-w-xl">
      <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="flex gap-2">
        <Input placeholder="Composition (e.g. 100% Cotton)" value={composition} onChange={(e) => setComposition(e.target.value)} />
        <Input placeholder="GSM" className="w-24 shrink-0" value={gsm} onChange={(e) => setGsm(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Input placeholder="Width" className="w-24 shrink-0" value={width} onChange={(e) => setWidth(e.target.value)} />
        <Input placeholder="Consumption UOM" value={consumptionUom} onChange={(e) => setConsumptionUom(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2 pt-1">
        <Button onClick={submit} disabled={!name}>
          Save
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getClientToken } from "@/lib/clientAuth";
import { Button, Input } from "@/components/ui";
import { FabricItem } from "@/lib/api";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "28", "30", "32", "34", "36", "38", "40", "42"];

export default function NewVariantForm({ styleId, fabrics }: { styleId: number; fabrics: FabricItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ sku_code: "", color: "", size: "", qty: "", fabric_item_id: "", fabric_consumption: "", cost_price: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.sku_code || !form.color || !form.size) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/styles/${styleId}/variants`, {
        ...form,
        qty: form.qty ? parseInt(form.qty, 10) : 0,
        fabric_item_id: form.fabric_item_id ? parseInt(form.fabric_item_id, 10) : null,
        fabric_consumption: form.fabric_consumption ? parseFloat(form.fabric_consumption) : null,
        cost_price: form.cost_price ? parseFloat(form.cost_price) : null,
      }, getClientToken());
      setForm({ sku_code: "", color: "", size: "", qty: "", fabric_item_id: "", fabric_consumption: "", cost_price: "" });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-primary cursor-pointer transition-colors duration-150 mt-2"
      >
        <Plus size={12} /> Add variant
      </button>
    );
  }

  return (
    <div className="mt-3 p-3 rounded-lg bg-muted/40 border border-border">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">SKU Code</label>
          <Input
            placeholder="e.g. OXF-WHT-M"
            value={form.sku_code}
            onChange={(e) => setForm({ ...form, sku_code: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Color</label>
          <Input
            placeholder="e.g. White"
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Size</label>
          <select
            value={form.size}
            onChange={(e) => setForm({ ...form, size: e.target.value })}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select size</option>
            {SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Qty</label>
          <Input
            type="number"
            min="0"
            placeholder="0"
            value={form.qty}
            onChange={(e) => setForm({ ...form, qty: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Fabric</label>
          <select
            value={form.fabric_item_id}
            onChange={(e) => setForm({ ...form, fabric_item_id: e.target.value })}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select fabric</option>
            {fabrics?.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Consumption</label>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 1.5"
            value={form.fabric_consumption}
            onChange={(e) => setForm({ ...form, fabric_consumption: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Cost Price</label>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 500"
            value={form.cost_price}
            onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={submit} disabled={saving || !form.sku_code || !form.color || !form.size}>
          {saving ? "Saving…" : "Save variant"}
        </Button>
        <Button variant="ghost" onClick={() => { setOpen(false); setError(null); }}>Cancel</Button>
        {error && <p className="text-xs text-destructive self-center">{error}</p>}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { api, decodeToken, FabricLotWithBalance, StyleWithVariants } from "@/lib/api";
import { Button, Input, Select } from "@/components/ui";
import { getClientToken } from "@/lib/clientAuth";
import { Package } from "lucide-react";

type Props = {
  fabricItemId: number;
  lots: FabricLotWithBalance[];
  onDone: () => void;
};

export default function LogReadyStockForm({ fabricItemId, lots, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [styles, setStyles] = useState<StyleWithVariants[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [lotId, setLotId] = useState("");
  const [qtyPieces, setQtyPieces] = useState("");
  const [fabricQty, setFabricQty] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const itemLots = lots.filter(l => l.fabric_item_id === fabricItemId);

  async function handleOpen() {
    if (!open) {
      try {
        const data = await api.get<StyleWithVariants[]>("/styles-with-variants", getClientToken());
        setStyles(data);
        if (itemLots[0]) setLotId(itemLots[0].id.toString());
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Unknown error");
      }
    }
    setOpen(o => !o);
  }

  const selectedStyle = styles.find(s => s.id === Number(selectedStyleId));
  const variants = selectedStyle?.variants ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!variantId || !lotId || !qtyPieces || !fabricQty) {
      setErr("All fields required");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const token = getClientToken();
      const createdBy = token ? (decodeToken(token).sub ?? "unknown") : "unknown";
      await api.post(`/fabric-lots/${lotId}/log-ready-stock`, {
        fabric_item_id: fabricItemId,
        variant_id: Number(variantId),
        qty_pieces: parseFloat(qtyPieces),
        fabric_qty_used: parseFloat(fabricQty),
        created_by: createdBy,
      }, token);
      setOpen(false);
      setQtyPieces("");
      setFabricQty("");
      setVariantId("");
      setSelectedStyleId("");
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  if (itemLots.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={handleOpen}
        className="text-sm text-accent hover:underline flex items-center gap-1"
      >
        <Package size={14} />
        {open ? "Cancel" : "+ Log ready stock"}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-3 p-4 bg-muted/30 rounded-lg border border-border flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Log existing / ready stock</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Fabric Lot</label>
              <Select value={lotId} onChange={e => setLotId(e.target.value)}>
                {itemLots.map(l => (
                  <option key={l.id} value={l.id}>
                    Lot #{l.id} — {l.balance} m available
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Fabric used (meters)</label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g. 12.5"
                value={fabricQty}
                onChange={e => setFabricQty(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Style</label>
              <Select value={selectedStyleId} onChange={e => { setSelectedStyleId(e.target.value); setVariantId(""); }}>
                <option value="">Select style…</option>
                {styles.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Variant (colour / size)</label>
              <Select value={variantId} onChange={e => setVariantId(e.target.value)} disabled={!selectedStyleId}>
                <option value="">Select variant…</option>
                {variants.map(v => (
                  <option key={v.id} value={v.id}>{v.color} / {v.size} ({v.sku_code})</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Pieces produced</label>
              <Input
                type="number"
                step="1"
                placeholder="e.g. 20"
                value={qtyPieces}
                onChange={e => setQtyPieces(e.target.value)}
              />
            </div>
          </div>

          {err && <p className="text-xs text-destructive">{err}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Log stock"}</Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}

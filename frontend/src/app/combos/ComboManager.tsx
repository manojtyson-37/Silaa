"use client";

import { useState } from "react";
import { Pencil, Trash2, Plus, X, Check, PackagePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { api, StyleVariantCombo, StyleWithVariants } from "@/lib/api";
import { getClientToken } from "@/lib/clientAuth";
import { Button, Input, PageHeader, Card } from "@/components/ui";

type ComboItemDraft = { variant_id: number; qty: number };

type ComboDraft = {
  name: string;
  description: string;
  selling_price: string;
  image_url: string;
  is_active: boolean;
  items: ComboItemDraft[];
};

const emptyDraft = (): ComboDraft => ({
  name: "",
  description: "",
  selling_price: "",
  image_url: "",
  is_active: true,
  items: [],
});

function ComboForm({
  initial,
  styles,
  onSave,
  onCancel,
  saving,
}: {
  initial: ComboDraft;
  styles: StyleWithVariants[];
  onSave: (d: ComboDraft) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<ComboDraft>(initial);

  const allVariants = styles.flatMap((s) =>
    s.variants.map((v) => ({ ...v, style_name: s.name }))
  );

  const addVariant = (variant_id: number) => {
    if (draft.items.find((i) => i.variant_id === variant_id)) return;
    setDraft({ ...draft, items: [...draft.items, { variant_id, qty: 1 }] });
  };

  const removeItem = (variant_id: number) =>
    setDraft({ ...draft, items: draft.items.filter((i) => i.variant_id !== variant_id) });

  const updateQty = (variant_id: number, qty: number) =>
    setDraft({
      ...draft,
      items: draft.items.map((i) => (i.variant_id === variant_id ? { ...i, qty } : i)),
    });

  return (
    <Card className="p-5 flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Combo Name *</label>
          <Input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="e.g. Festival Pack"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Selling Price (₹) *</label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={draft.selling_price}
            onChange={(e) => setDraft({ ...draft, selling_price: e.target.value })}
            placeholder="0.00"
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Description</label>
          <Input
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="Optional description shown on website"
          />
        </div>
      </div>

      {/* Variant picker */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-muted-foreground">Add Variants to Combo</label>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring w-full"
          value=""
          onChange={(e) => e.target.value && addVariant(Number(e.target.value))}
        >
          <option value="">— Pick a variant to add —</option>
          {allVariants.map((v) => (
            <option key={v.id} value={v.id} disabled={!!draft.items.find((i) => i.variant_id === v.id)}>
              {v.style_name} · {v.color} · {v.size} ({v.sku_code}) — stock: {v.qty}
            </option>
          ))}
        </select>
      </div>

      {draft.items.length > 0 && (
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Variant</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-28">Qty in combo</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {draft.items.map((item) => {
                const v = allVariants.find((av) => av.id === item.variant_id);
                return (
                  <tr key={item.variant_id} className="border-t border-border">
                    <td className="px-3 py-2 text-foreground">
                      {v ? `${v.style_name} · ${v.color} · ${v.size}` : `Variant #${item.variant_id}`}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => updateQty(item.variant_id, Number(e.target.value) || 1)}
                        className="h-7 w-20 text-sm tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => removeItem(item.variant_id)}
                        className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"
                      >
                        <X size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={draft.is_active}
            onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
            className="rounded"
          />
          Active (visible on website)
        </label>
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button
          onClick={() => onSave(draft)}
          disabled={saving || !draft.name || !draft.selling_price || draft.items.length === 0}
        >
          <Check size={14} />
          {saving ? "Saving…" : "Save Combo"}
        </Button>
      </div>
    </Card>
  );
}

export default function ComboManager({
  initialCombos,
  styles,
}: {
  initialCombos: StyleVariantCombo[];
  styles: StyleWithVariants[];
}) {
  const router = useRouter();
  const [combos, setCombos] = useState<StyleVariantCombo[]>(initialCombos);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const allVariants = styles.flatMap((s) =>
    s.variants.map((v) => ({ ...v, style_name: s.name }))
  );

  const refresh = () => router.refresh();

  const handleCreate = async (draft: ComboDraft) => {
    setSaving(true);
    try {
      const created = await api.post("/combos", {
        ...draft,
        selling_price: parseFloat(draft.selling_price),
      }, getClientToken()) as StyleVariantCombo;
      setCombos([created, ...combos]);
      setCreating(false);
    } catch (err) {
      alert(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: number, draft: ComboDraft) => {
    setSaving(true);
    try {
      const updated = await api.patch(`/combos/${id}`, {
        ...draft,
        selling_price: parseFloat(draft.selling_price),
      }, getClientToken()) as StyleVariantCombo;
      setCombos(combos.map((c) => (c.id === id ? updated : c)));
      setEditingId(null);
    } catch (err) {
      alert(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete combo "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/combos/${id}`, getClientToken());
      setCombos(combos.filter((c) => c.id !== id));
    } catch (err) {
      alert(String(err));
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-8 py-10 flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <PageHeader
          title="Combos"
          subtitle="Bundle existing variants into combo products for the website"
        />
        {!creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus size={14} />
            New Combo
          </Button>
        )}
      </div>

      {creating && (
        <ComboForm
          initial={emptyDraft()}
          styles={styles}
          onSave={handleCreate}
          onCancel={() => setCreating(false)}
          saving={saving}
        />
      )}

      {combos.length === 0 && !creating && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <PackagePlus size={36} strokeWidth={1.5} />
          <p className="text-sm">No combos yet. Create one to bundle variants for the website.</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {combos.map((combo) =>
          editingId === combo.id ? (
            <ComboForm
              key={combo.id}
              initial={{
                name: combo.name,
                description: combo.description ?? "",
                selling_price: combo.selling_price,
                image_url: combo.image_url ?? "",
                is_active: combo.is_active,
                items: combo.items.map((i) => ({ variant_id: i.variant_id, qty: i.qty })),
              }}
              styles={styles}
              onSave={(d) => handleUpdate(combo.id, d)}
              onCancel={() => setEditingId(null)}
              saving={saving}
            />
          ) : (
            <Card key={combo.id} className="p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{combo.name}</span>
                    {!combo.is_active && (
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Inactive</span>
                    )}
                  </div>
                  {combo.description && (
                    <p className="text-xs text-muted-foreground">{combo.description}</p>
                  )}
                  <p className="text-sm font-medium text-foreground mt-1">₹{Number(combo.selling_price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => setEditingId(combo.id)}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                    title="Edit combo"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(combo.id, combo.name)}
                    className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"
                    title="Delete combo"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {combo.items.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {combo.items.map((item) => {
                    const v = allVariants.find((av) => av.id === item.variant_id);
                    return (
                      <span
                        key={item.id}
                        className="text-xs bg-muted rounded-md px-2 py-1 text-foreground"
                      >
                        {v ? `${v.style_name} · ${v.color} · ${v.size}` : `Variant #${item.variant_id}`}
                        {item.qty > 1 && <span className="text-muted-foreground ml-1">×{item.qty}</span>}
                      </span>
                    );
                  })}
                </div>
              )}
            </Card>
          )
        )}
      </div>
    </main>
  );
}

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, StyleWithVariants } from "@/lib/api";
import { Button, Input, Select } from "@/components/ui";

type Props = {
  styles: StyleWithVariants[];
  onClose: () => void;
  onCreated: () => void;
};

export default function NewProductionOrderForm({ styles, onClose, onCreated }: Props) {
  const router = useRouter();
  const [styleId, setStyleId] = useState<number | "">("");
  const [source, setSource] = useState("internal");
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedStyle = styles.find((s) => s.id === styleId);

  const handleQtyChange = (variantId: number, val: string) => {
    setQuantities((prev) => ({ ...prev, [variantId]: val }));
  };

  const handleSave = async () => {
    if (!styleId) {
      setError("Please select a style.");
      return;
    }
    
    const variantsPayload = Object.entries(quantities)
      .filter(([, qty]) => qty && parseFloat(qty) > 0)
      .map(([vId, qty]) => ({ variant_id: parseInt(vId, 10), planned_qty: parseFloat(qty) }));
      
    if (variantsPayload.length === 0) {
      setError("Please enter planned quantities for at least one variant.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await api.post("/production-orders", {
        style_id: styleId,
        variants: variantsPayload,
        source: source || "internal",
        created_by: "system", // Normally derived from auth
      });
      router.refresh();
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border shadow-lg rounded-xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
          <h2 className="text-lg font-semibold text-foreground tracking-tight">New Production Order</h2>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-4">
          {error && <div className="text-destructive text-sm font-medium">{error}</div>}
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Style</label>
            <Select
              value={styleId}
              onChange={(e) => {
                setStyleId(e.target.value ? parseInt(e.target.value, 10) : "");
                setQuantities({});
              }}
            >
              <option value="">Select a style...</option>
              {styles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.category || "Uncategorized"})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Source (e.g. Sales Order ID or &apos;internal&apos;)</label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="internal" />
          </div>

          {selectedStyle && (
            <div className="mt-4 pt-4 border-t border-border">
              <label className="block text-sm font-medium text-foreground mb-3">Planned Quantities by Variant</label>
              {selectedStyle.variants.length === 0 ? (
                <p className="text-sm text-muted-foreground">This style has no variants configured.</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {selectedStyle.variants.map((v) => (
                    <div key={v.id} className="flex items-center justify-between gap-4 p-2 rounded-md hover:bg-muted/50 transition-colors">
                      <span className="text-sm font-medium text-foreground">
                        {v.color} - {v.size} <span className="text-muted-foreground text-xs ml-1 font-normal">({v.sku_code})</span>
                      </span>
                      <Input
                        type="number"
                        min="0"
                        className="w-24 text-right"
                        placeholder="0"
                        value={quantities[v.id] || ""}
                        onChange={(e) => handleQtyChange(v.id, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-muted/30 border-t border-border flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !styleId}>
            {saving ? "Creating..." : "Create Order"}
          </Button>
        </div>
      </div>
    </div>
  );
}

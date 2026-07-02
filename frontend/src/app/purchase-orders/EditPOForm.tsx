"use client";

import { useState } from "react";
import { Edit2, X } from "lucide-react";
import { api, PurchaseOrder, Supplier } from "@/lib/api";
import { getClientToken } from "@/lib/clientAuth";
import { Button, Card, Select } from "@/components/ui";

type Props = {
  po: PurchaseOrder;
  suppliers: Supplier[];
  onSaved: () => void;
};

export default function EditPOForm({ po, suppliers, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [supplier_id, setSupplier_id] = useState(String(po.supplier_id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      await api.patch(`/purchase-orders/${po.id}`, { supplier_id: parseInt(supplier_id, 10) }, getClientToken());
      setEditing(false);
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-muted-foreground hover:text-foreground p-1 transition-colors"
        title="Edit PO"
      >
        <Edit2 size={16} />
      </button>
    );
  }

  return (
    <Card className="p-4 bg-muted/30 flex flex-col gap-2.5 mb-3">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-medium text-sm">Edit PO supplier</h3>
        <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground p-1">
          <X size={14} />
        </button>
      </div>

      <Select value={supplier_id} onChange={(e) => setSupplier_id(e.target.value)}>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2 mt-2">
        <Button
          onClick={submit}
          disabled={saving}
          className="text-xs flex-1"
        >
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button
          onClick={() => setEditing(false)}
          variant="secondary"
          className="text-xs flex-1"
        >
          Cancel
        </Button>
      </div>
    </Card>
  );
}

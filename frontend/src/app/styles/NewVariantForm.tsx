"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getClientToken } from "@/lib/clientAuth";
import { Button, Input } from "@/components/ui";

export default function NewVariantForm({ styleId }: { styleId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ sku_code: "", color: "", size: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.sku_code || !form.color || !form.size) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/styles/${styleId}/variants`, form, getClientToken());
      setForm({ sku_code: "", color: "", size: "" });
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
    <div className="mt-2 flex flex-wrap gap-2 items-end">
      <Input
        placeholder="SKU code"
        value={form.sku_code}
        onChange={(e) => setForm({ ...form, sku_code: e.target.value })}
        className="w-36"
      />
      <Input
        placeholder="Color"
        value={form.color}
        onChange={(e) => setForm({ ...form, color: e.target.value })}
        className="w-28"
      />
      <Input
        placeholder="Size"
        value={form.size}
        onChange={(e) => setForm({ ...form, size: e.target.value })}
        className="w-20"
      />
      <Button onClick={submit} disabled={saving || !form.sku_code || !form.color || !form.size}>
        {saving ? "Saving…" : "Save"}
      </Button>
      <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      {error && <p className="w-full text-xs text-destructive">{error}</p>}
    </div>
  );
}

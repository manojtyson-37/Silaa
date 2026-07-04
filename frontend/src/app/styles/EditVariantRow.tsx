"use client";

import { useState } from "react";
import { Pencil, Check, X, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { api, StyleVariant } from "@/lib/api";
import { getClientToken } from "@/lib/clientAuth";
import { Input, StatusPill } from "@/components/ui";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "28", "30", "32", "34", "36", "38", "40", "42"];

export default function EditVariantRow({ v }: { v: StyleVariant }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ color: v.color, size: v.size, sku_code: v.sku_code, qty: String(v.qty ?? 0) });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/variants/${v.id}`, {
        color: form.color,
        size: form.size,
        sku_code: form.sku_code,
        qty: parseInt(form.qty, 10) || 0,
      }, getClientToken());
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <tr className="group border-b border-border last:border-0">
        <td className="py-3 px-4 font-mono text-xs text-foreground">{v.sku_code}</td>
        <td className="py-3 px-4 text-sm text-foreground">{v.color}</td>
        <td className="py-3 px-4 text-sm text-foreground">{v.size}</td>
        <td className="py-3 px-4 text-sm text-foreground tabular-nums">{v.qty ?? 0}</td>
        <td className="py-3 px-4"><StatusPill value={v.status} /></td>
        <td className="py-3 px-4 text-right">
          <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setEditing(true)}
              className="p-1 rounded hover:bg-muted text-muted-foreground"
              title="Edit variant"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={async () => {
                if (!confirm(`Delete variant ${v.sku_code}? This cannot be undone.`)) return;
                try {
                  await api.delete(`/variants/${v.id}`, getClientToken());
                  router.refresh();
                } catch (err) {
                  alert(String(err));
                }
              }}
              className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"
              title="Delete variant"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border bg-muted/30">
      <td className="py-2 px-4">
        <Input
          value={form.sku_code}
          onChange={(e) => setForm({ ...form, sku_code: e.target.value })}
          className="h-7 text-xs font-mono w-32"
        />
      </td>
      <td className="py-2 px-4">
        <Input
          value={form.color}
          onChange={(e) => setForm({ ...form, color: e.target.value })}
          className="h-7 text-sm w-24"
        />
      </td>
      <td className="py-2 px-4">
        <select
          value={form.size}
          onChange={(e) => setForm({ ...form, size: e.target.value })}
          className="h-7 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring w-20"
        >
          {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      <td className="py-2 px-4">
        <Input
          type="number"
          min="0"
          value={form.qty}
          onChange={(e) => setForm({ ...form, qty: e.target.value })}
          className="h-7 text-sm w-20 tabular-nums"
        />
      </td>
      <td className="py-2 px-4"><StatusPill value={v.status} /></td>
      <td className="py-2 px-4 text-right">
        <div className="flex gap-1 justify-end">
          <button
            onClick={save}
            disabled={saving}
            className="p-1 rounded hover:bg-green-100 text-green-600 disabled:opacity-50"
          >
            <Check size={13} />
          </button>
          <button
            onClick={() => { setEditing(false); setForm({ color: v.color, size: v.size, sku_code: v.sku_code, qty: String(v.qty ?? 0) }); }}
            className="p-1 rounded hover:bg-muted text-muted-foreground"
          >
            <X size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

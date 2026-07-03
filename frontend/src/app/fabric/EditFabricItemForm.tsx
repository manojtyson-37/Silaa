"use client";

import { useRef, useState } from "react";
import { api, FabricItem } from "@/lib/api";
import { getClientToken } from "@/lib/clientAuth";
import { Button, Input } from "@/components/ui";

type Props = {
  item: FabricItem;
  onSaved: () => void;
  onCancel: () => void;
};

export default function EditFabricItemForm({ item, onSaved, onCancel }: Props) {
  const [form, setForm] = useState({
    name: item.name,
    composition: item.composition || "",
    gsm: item.gsm ? String(item.gsm) : "",
    width: item.width ? String(item.width) : "",
  });
  const [imageUrl, setImageUrl] = useState<string | null>(item.image_url || null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await api.upload(file, getClientToken());
      setImageUrl(url);
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { name: form.name, image_url: imageUrl };
      if (form.composition) payload.composition = form.composition;
      if (form.gsm) payload.gsm = parseInt(form.gsm, 10);
      if (form.width) payload.width = parseFloat(form.width);
      await api.patch(`/fabric-items/${item.id}`, payload, getClientToken());
      onSaved();
    } catch {
      setError("Failed to update. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Name</label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Composition</label>
        <Input placeholder="e.g. 60% Cotton 40% Poly" value={form.composition} onChange={(e) => setForm({ ...form, composition: e.target.value })} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">GSM</label>
        <Input type="number" value={form.gsm} onChange={(e) => setForm({ ...form, gsm: e.target.value })} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Width (m)</label>
        <Input type="number" step="0.01" value={form.width} onChange={(e) => setForm({ ...form, width: e.target.value })} />
      </div>

      <div className="col-span-full flex items-center gap-4">
        {imageUrl && (
          <img src={imageUrl} alt="preview" className="w-14 h-14 object-cover rounded border border-border" />
        )}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="text-sm text-accent hover:text-primary cursor-pointer disabled:opacity-50"
        >
          {uploading ? "Uploading..." : imageUrl ? "Change image" : "Add image"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>

      {error && <p className="col-span-full text-xs text-destructive">{error}</p>}

      <div className="col-span-full flex gap-2">
        <Button onClick={submit} disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

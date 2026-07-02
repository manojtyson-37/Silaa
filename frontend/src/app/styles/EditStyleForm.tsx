"use client";

import { useRef, useState } from "react";
import { Edit2, X } from "lucide-react";
import { api, Style } from "@/lib/api";
import { getClientToken } from "@/lib/clientAuth";
import { Button, Card, Input } from "@/components/ui";

type Props = {
  style: Style;
  onSaved: () => void;
};

export default function EditStyleForm({ style, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: style.name, category: style.category, collection: style.collection });
  const [imageUrl, setImageUrl] = useState<string | null>(style.image_url || null);
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
      await api.patch(`/styles/${style.id}`, { ...form, image_url: imageUrl }, getClientToken());
      setEditing(false);
      onSaved();
    } catch (e) {
      setError("Failed to update. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-muted-foreground hover:text-foreground p-1 transition-colors"
        title="Edit style"
      >
        <Edit2 size={16} />
      </button>
    );
  }

  return (
    <Card className="p-4 bg-muted/30 flex flex-col gap-2.5 mb-3">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-medium text-sm">Edit style</h3>
        <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground p-1">
          <X size={14} />
        </button>
      </div>

      <Input
        placeholder="Style name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <Input
        placeholder="Category"
        value={form.category}
        onChange={(e) => setForm({ ...form, category: e.target.value })}
      />
      <Input
        placeholder="Collection"
        value={form.collection}
        onChange={(e) => setForm({ ...form, collection: e.target.value })}
      />

      <div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="text-sm text-accent hover:text-primary cursor-pointer disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Change image"}
        </button>
      </div>

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

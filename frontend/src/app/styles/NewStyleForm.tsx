"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getClientToken } from "@/lib/clientAuth";
import { Button, Card, Input } from "@/components/ui";

export default function NewStyleForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", collection: "" });
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
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
    try {
      await api.post("/styles", { ...form, image_url: imageUrl }, getClientToken());
      setForm({ name: "", category: "", collection: "" });
      setImageUrl(null);
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
        <Plus size={14} /> New style
      </button>
    );
  }

  return (
    <Card className="p-4 mb-5 bg-muted/30 flex flex-col gap-2.5 max-w-sm">
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
          className="text-sm text-accent hover:text-primary cursor-pointer"
        >
          {uploading ? "Uploading…" : imageUrl ? "Change image" : "Add outfit photo (optional)"}
        </button>
        {imageUrl && (
          <img src={imageUrl} alt="preview" className="mt-2 w-24 h-24 object-cover rounded-lg border border-border" />
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={submit} disabled={!form.name || uploading}>
          Save
        </Button>
        <Button variant="ghost" onClick={() => { setOpen(false); setImageUrl(null); }}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

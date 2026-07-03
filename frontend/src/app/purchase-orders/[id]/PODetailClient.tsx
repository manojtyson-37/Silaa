"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Printer, Upload } from "lucide-react";
import { api, PurchaseOrderDetail, Supplier } from "@/lib/api";
import { getClientToken } from "@/lib/clientAuth";
import { Button, Card, Input, StatusPill, Table, Td, Th } from "@/components/ui";

const PAYMENT_TERMS = [
  "Net 30", "Net 60", "Net 90", "50% Advance / 50% on Delivery",
  "100% Advance", "COD", "LC at Sight",
];

type Props = {
  po: PurchaseOrderDetail;
  suppliers: Supplier[];
};

export default function PODetailClient({ po, suppliers }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    description: po.description ?? "",
    dispatch_date: po.dispatch_date ?? "",
    tax_rate: po.tax_rate ?? "0",
    payment_terms: po.payment_terms ?? "",
  });
  const [imageUrl, setImageUrl] = useState<string | null>(po.image_url);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supplierName = suppliers.find((s) => s.id === po.supplier_id)?.name ?? `#${po.supplier_id}`;

  const isDraft = po.status === "draft";

  const subtotal = po.lines.reduce((sum, l) => sum + parseFloat(l.ordered_qty) * parseFloat(l.agreed_price), 0);
  const taxAmt = subtotal * (parseFloat(form.tax_rate || "0") / 100);
  const total = subtotal + taxAmt;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await api.upload(file, getClientToken());
      setImageUrl(url);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/purchase-orders/${po.id}`, {
        description: form.description || null,
        dispatch_date: form.dispatch_date || null,
        tax_rate: parseFloat(form.tax_rate) || 0,
        payment_terms: form.payment_terms || null,
        image_url: imageUrl,
      }, getClientToken());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-8 py-10 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-1">
            <Link href="/purchase-orders" className="hover:text-accent">Purchase Orders</Link> / PO #{po.id}
          </p>
          <h1 className="text-2xl font-semibold text-foreground">{supplierName}</h1>
          <div className="mt-1"><StatusPill value={po.status} /></div>
        </div>
        <Link href={`/purchase-orders/${po.id}/print`} target="_blank">
          <Button variant="ghost" className="flex items-center gap-2 text-sm">
            <Printer size={15} /> Download Sales Order
          </Button>
        </Link>
      </div>

      {/* Details card */}
      <Card className="p-5 flex flex-col gap-4">
        <h2 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Order Details</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Dispatch / Due Date</label>
            <Input
              type="date"
              value={form.dispatch_date}
              onChange={(e) => setForm({ ...form, dispatch_date: e.target.value })}
              disabled={!isDraft}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Tax Rate (%)</label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="0"
              value={form.tax_rate}
              onChange={(e) => setForm({ ...form, tax_rate: e.target.value })}
              disabled={!isDraft}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Payment Terms</label>
          <select
            value={form.payment_terms}
            onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
            disabled={!isDraft}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            <option value="">Select payment terms</option>
            {PAYMENT_TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Description / Notes</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            disabled={!isDraft}
            placeholder="Order notes, special instructions..."
            rows={3}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 resize-none"
          />
        </div>

        {/* Photo */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Reference Photo</label>
          {imageUrl ? (
            <div className="flex items-start gap-3">
              <img src={imageUrl} alt="PO reference" className="w-24 h-24 object-cover rounded border border-border" />
              {isDraft && (
                <button onClick={() => fileRef.current?.click()} className="text-xs text-accent hover:text-primary">
                  Change
                </button>
              )}
            </div>
          ) : isDraft ? (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md p-3 w-fit transition-colors disabled:opacity-50"
            >
              <Upload size={14} /> {uploading ? "Uploading…" : "Add photo"}
            </button>
          ) : null}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>

        {isDraft && (
          <div className="flex gap-2 pt-1">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save details"}
            </Button>
            {error && <p className="text-xs text-destructive self-center">{error}</p>}
          </div>
        )}
      </Card>

      {/* Lines table */}
      <Card className="p-5">
        <h2 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-3">Order Lines</h2>
        <Table>
          <thead>
            <tr>
              <Th>Component</Th>
              <Th>Qty</Th>
              <Th>UOM</Th>
              <Th>Price</Th>
              <Th>Amount</Th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((l) => {
              const amt = parseFloat(l.ordered_qty) * parseFloat(l.agreed_price);
              return (
                <tr key={l.id}>
                  <Td className="text-sm">{l.component_type} #{l.component_id}</Td>
                  <Td className="tabular-nums">{l.ordered_qty}</Td>
                  <Td>{l.ordered_uom}</Td>
                  <Td className="tabular-nums">₹{parseFloat(l.agreed_price).toFixed(2)}</Td>
                  <Td className="tabular-nums font-medium">₹{amt.toFixed(2)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>

        {/* Totals */}
        <div className="mt-4 border-t border-border pt-3 flex flex-col items-end gap-1 text-sm">
          <div className="flex gap-8 text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums w-24 text-right">₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex gap-8 text-muted-foreground">
            <span>Tax ({form.tax_rate || 0}%)</span>
            <span className="tabular-nums w-24 text-right">₹{taxAmt.toFixed(2)}</span>
          </div>
          <div className="flex gap-8 font-semibold text-foreground border-t border-border pt-1 mt-1">
            <span>Total</span>
            <span className="tabular-nums w-24 text-right">₹{total.toFixed(2)}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

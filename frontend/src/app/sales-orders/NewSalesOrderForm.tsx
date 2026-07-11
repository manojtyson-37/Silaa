"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { api, decodeToken, INDIAN_STATES, StyleWithVariants } from "@/lib/api";
import { getClientToken } from "@/lib/clientAuth";
import { Button, Input, Select } from "@/components/ui";

type Line = { style_id: string; variant_id: string; qty: string; unit_price: string; gst_percent: string };

const emptyLine = (): Line => ({ style_id: "", variant_id: "", qty: "1", unit_price: "", gst_percent: "5" });

function lineAmount(l: Line) {
  const qty = parseFloat(l.qty) || 0;
  const price = parseFloat(l.unit_price) || 0;
  const gst = parseFloat(l.gst_percent) || 0;
  const taxable = qty * price;
  const tax = taxable * gst / 100;
  return { taxable, tax, total: taxable + tax };
}

type Props = { onClose?: () => void };

export default function NewSalesOrderForm({ onClose }: Props = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [styles, setStyles] = useState<StyleWithVariants[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerState, setCustomerState] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && styles.length === 0) {
      api.get<StyleWithVariants[]>("/styles-with-variants", getClientToken())
        .then(setStyles)
        .catch(() => {});
    }
  }, [open]);

  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));

  const totals = lines.reduce(
    (acc, l) => {
      const { taxable, tax, total } = lineAmount(l);
      return { taxable: acc.taxable + taxable, tax: acc.tax + tax, total: acc.total + total };
    },
    { taxable: 0, tax: 0, total: 0 },
  );

  const submit = async () => {
    if (!customerName.trim()) { setError("Customer name is required"); return; }
    const validLines = lines.filter(l => l.variant_id && parseFloat(l.qty) > 0 && parseFloat(l.unit_price) > 0);
    if (validLines.length === 0) { setError("Add at least one complete line item"); return; }

    setSaving(true);
    setError(null);
    try {
      const token = getClientToken();
      const createdBy = token ? (decodeToken(token).sub ?? "web") : "web";
      await api.post("/sales-orders", {
        customer_name: customerName.trim(),
        customer_phone: customerPhone || null,
        customer_address: customerAddress || null,
        customer_state: customerState || null,
        lines: validLines.map((l) => ({
          variant_id: Number(l.variant_id),
          qty: l.qty,
          unit_price: l.unit_price,
          gst_percent: l.gst_percent || "5",
        })),
        created_by: createdBy,
      }, token);
      setCustomerName(""); setCustomerPhone(""); setCustomerAddress(""); setCustomerState("");
      setLines([emptyLine()]);
      setOpen(false);
      onClose?.();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="mb-6 border border-border rounded-xl bg-surface shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-accent" />
          <span className="text-sm font-semibold text-foreground">New Invoice</span>
        </div>
        <button onClick={() => { setOpen(false); onClose?.(); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Cancel
        </button>
      </div>

      <div className="p-6 flex flex-col gap-6">
        {/* Customer */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Bill To</p>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Customer name *" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            <Input placeholder="Phone (optional)" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            <Input placeholder="Address (for invoice)" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
            <Select value={customerState} onChange={(e) => setCustomerState(e.target.value)}>
              <option value="">State (for GST)</option>
              {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
        </div>

        {/* Line items */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Items</p>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-xs text-muted-foreground text-left">
                  <th className="px-3 py-2.5 font-medium">Style</th>
                  <th className="px-3 py-2.5 font-medium">Variant</th>
                  <th className="px-3 py-2.5 font-medium w-20">Qty</th>
                  <th className="px-3 py-2.5 font-medium w-28">Unit Price (₹)</th>
                  <th className="px-3 py-2.5 font-medium w-20">GST %</th>
                  <th className="px-3 py-2.5 text-right font-medium w-28">Amount</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => {
                  const styleVariants = styles.find(s => s.id === Number(line.style_id))?.variants ?? [];
                  const { taxable, tax } = lineAmount(line);
                  return (
                    <tr key={i} className="border-t border-border/50">
                      <td className="px-2 py-2">
                        <Select value={line.style_id} onChange={(e) => updateLine(i, { style_id: e.target.value, variant_id: "" })} className="text-xs">
                          <option value="">Pick style…</option>
                          {styles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </Select>
                      </td>
                      <td className="px-2 py-2">
                        <Select value={line.variant_id} onChange={(e) => updateLine(i, { variant_id: e.target.value })} disabled={!line.style_id} className="text-xs">
                          <option value="">Pick variant…</option>
                          {styleVariants.map(v => (
                            <option key={v.id} value={v.id}>{v.color} / {v.size}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-2 py-2">
                        <Input type="number" min="1" step="1" value={line.qty} onChange={(e) => updateLine(i, { qty: e.target.value })} className="text-xs" />
                      </td>
                      <td className="px-2 py-2">
                        <Input type="number" min="0" step="0.01" placeholder="0.00" value={line.unit_price} onChange={(e) => updateLine(i, { unit_price: e.target.value })} className="text-xs" />
                      </td>
                      <td className="px-2 py-2">
                        <Select value={line.gst_percent} onChange={(e) => updateLine(i, { gst_percent: e.target.value })} className="text-xs">
                          {["0","5","12","18","28"].map(r => <option key={r} value={r}>{r}%</option>)}
                        </Select>
                      </td>
                      <td className="tnum px-3 py-2 text-right text-xs font-medium text-foreground">
                        {taxable > 0 ? (
                          <span title={`Taxable ₹${taxable.toFixed(2)} + GST ₹${tax.toFixed(2)}`}>
                            ₹{(taxable + tax).toFixed(2)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-1 py-2">
                        {lines.length > 1 && (
                          <button onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive cursor-pointer p-1">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-3 py-2 border-t border-border/50">
              <button onClick={() => setLines(prev => [...prev, emptyLine()])} className="text-xs text-accent hover:text-accent/80 cursor-pointer flex items-center gap-1 transition-colors">
                <Plus size={12} /> Add line
              </button>
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 text-sm space-y-1.5">
            <div className="flex justify-between text-muted-foreground">
              <span>Taxable value</span><span className="tnum">₹{totals.taxable.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>GST</span><span className="tnum">₹{totals.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1.5">
              <span>Grand Total</span><span className="tnum">₹{totals.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2 border-t border-border pt-4">
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save as Draft"}</Button>
          <Button variant="ghost" onClick={() => { setOpen(false); onClose?.(); }}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

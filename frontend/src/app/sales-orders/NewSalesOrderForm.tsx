"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { api, INDIAN_STATES } from "@/lib/api";
import { getClientToken } from "@/lib/clientAuth";
import { Button, Card, Input, Select } from "@/components/ui";

type Line = { variant_id: string; qty: string; unit_price: string; gst_percent: string };

const emptyLine = (): Line => ({ variant_id: "", qty: "", unit_price: "", gst_percent: "5" });

export default function NewSalesOrderForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerState, setCustomerState] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);

  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const submit = async () => {
    setError(null);
    try {
      await api.post("/sales-orders", {
        customer_name: customerName,
        customer_phone: customerPhone || null,
        customer_address: customerAddress || null,
        customer_state: customerState || null,
        lines: lines.map((l) => ({
          variant_id: Number(l.variant_id),
          qty: l.qty,
          unit_price: l.unit_price,
          gst_percent: l.gst_percent || "5",
        })),
        created_by: "web",
      }, getClientToken());
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setCustomerState("");
      setLines([emptyLine()]);
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
        <Plus size={14} /> New sales order
      </button>
    );
  }

  return (
    <Card className="p-4 mb-5 bg-muted/30 flex flex-col gap-3 max-w-xl">
      <Input placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
      <Input placeholder="Customer phone (for invoice)" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
      <Input placeholder="Customer address (for invoice)" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
      <Select value={customerState} onChange={(e) => setCustomerState(e.target.value)}>
        <option value="">Customer state (for GST)</option>
        {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
      </Select>

      {lines.map((line, i) => (
        <div key={i} className="flex flex-wrap gap-2 items-start">
          <Input
            placeholder="Variant ID"
            className="w-24 shrink-0"
            value={line.variant_id}
            onChange={(e) => updateLine(i, { variant_id: e.target.value })}
          />
          <Input
            placeholder="Qty"
            className="w-20 shrink-0"
            value={line.qty}
            onChange={(e) => updateLine(i, { qty: e.target.value })}
          />
          <Input
            placeholder="Unit price"
            className="w-28 shrink-0"
            value={line.unit_price}
            onChange={(e) => updateLine(i, { unit_price: e.target.value })}
          />
          <Input
            placeholder="GST %"
            className="w-20 shrink-0"
            value={line.gst_percent}
            onChange={(e) => updateLine(i, { gst_percent: e.target.value })}
          />
          {lines.length > 1 && (
            <button
              onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
              className="text-muted-foreground hover:text-destructive cursor-pointer p-1.5"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}

      <button
        onClick={() => setLines((prev) => [...prev, emptyLine()])}
        className="text-sm text-accent hover:text-primary cursor-pointer self-start"
      >
        + Add line
      </button>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2 pt-1">
        <Button onClick={submit} disabled={!customerName}>
          Save
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

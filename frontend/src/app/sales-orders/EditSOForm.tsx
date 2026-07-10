"use client";

import { useState } from "react";
import { Edit2, X } from "lucide-react";
import { api, SalesOrder } from "@/lib/api";
import { getClientToken } from "@/lib/clientAuth";
import { Button, Card, Input } from "@/components/ui";

type Props = {
  order: SalesOrder;
  onSaved: () => void;
};

export default function EditSOForm({ order, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [customer_name, setCustomer_name] = useState(order.customer_name);
  const [customer_phone, setCustomerPhone] = useState(order.customer_phone ?? "");
  const [customer_address, setCustomerAddress] = useState(order.customer_address ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      await api.patch(`/sales-orders/${order.id}`, {
        customer_name,
        customer_phone: customer_phone || null,
        customer_address: customer_address || null,
      }, getClientToken());
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
        title="Edit SO"
      >
        <Edit2 size={16} />
      </button>
    );
  }

  return (
    <Card className="p-4 bg-muted/30 flex flex-col gap-2.5 mb-3">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-medium text-sm">Edit customer name</h3>
        <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground p-1">
          <X size={14} />
        </button>
      </div>

      <Input
        placeholder="Customer name"
        value={customer_name}
        onChange={(e) => setCustomer_name(e.target.value)}
      />
      <Input
        placeholder="Customer phone (for invoice)"
        value={customer_phone}
        onChange={(e) => setCustomerPhone(e.target.value)}
      />
      <Input
        placeholder="Customer address (for invoice)"
        value={customer_address}
        onChange={(e) => setCustomerAddress(e.target.value)}
      />

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
          variant="ghost"
          className="text-xs flex-1"
        >
          Cancel
        </Button>
      </div>
    </Card>
  );
}

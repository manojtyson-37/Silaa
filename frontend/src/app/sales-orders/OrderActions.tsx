"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function OrderActions({ orderId }: { orderId: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const fulfill = async () => {
    setError(null);
    try {
      await api.post(`/sales-orders/${orderId}/fulfill?created_by=web`);
      router.refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const cancel = async () => {
    setError(null);
    try {
      await api.post(`/sales-orders/${orderId}/cancel`);
      router.refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-3">
        <button onClick={fulfill} className="text-sm font-medium text-accent hover:text-primary cursor-pointer transition-colors duration-150">
          Fulfill
        </button>
        <button onClick={cancel} className="text-sm font-medium text-muted-foreground hover:text-destructive cursor-pointer transition-colors duration-150">
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { SalesOrder, OrderMarginTotal } from "@/lib/api";
import SOClient from "./SOClient";
import NewInvoiceForm from "./NewSalesOrderForm";

type Props = {
  orders: SalesOrder[];
  margins: OrderMarginTotal[];
};

export default function InvoicesPageClient({ orders, margins }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editOrderId, setEditOrderId] = useState<number | null>(null);

  return (
    <>
      {/* Header - hide when form is open */}
      {!showForm && !editOrderId && (
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Invoices</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Create, track and print GST invoices</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 text-sm font-semibold bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors cursor-pointer shrink-0"
          >
            <Plus size={14} /> New Invoice
          </button>
        </div>
      )}

      {/* Inline new/edit invoice form */}
      {(showForm || editOrderId) && (
        <NewInvoiceForm 
          initialOrderId={editOrderId || undefined} 
          onClose={() => { setShowForm(false); setEditOrderId(null); }} 
        />
      )}

      {/* Table - hide when form is open */}
      {!showForm && !editOrderId && (
        <SOClient orders={orders} margins={margins} onEdit={(id) => setEditOrderId(id)} />
      )}
    </>
  );
}

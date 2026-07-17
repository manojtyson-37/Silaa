"use client";

import { useEffect } from "react";

type SalesOrderOut = {
  id: number;
  customer_name: string;
  customer_phone?: string;
  customer_address?: string;
  customer_state?: string;
  invoice_number?: string;
  status: string;
  category?: string;
  created_at: string;
  total_amount: string | number;
  lines: {
    id: number;
    variant_id: number;
    qty: string | number;
    unit_price: string | number;
    gst_percent: string | number;
    variant_color: string;
    variant_size: string;
    variant_sku: string;
  }[];
};

type Props = {
  order: SalesOrderOut;
};

export default function PrintClient({ order }: Props) {
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const orderDate = new Date(order.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  useEffect(() => {
    window.print();
  }, []);

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
        }
        body { font-family: 'Inter', system-ui, sans-serif; color: #111; background: white; margin: 0; }
        .page { max-width: 780px; margin: 0 auto; padding: 48px 48px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f4f4f5; text-align: left; padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #71717a; }
        td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #e4e4e7; }
        .label { font-size: 11px; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
        .value { font-size: 14px; color: #111; }
      `}</style>

      <div className="page">
        {/* Print / close bar */}
        <div className="no-print flex justify-between items-center mb-8 pb-4 border-b border-gray-200">
          <span className="text-sm text-gray-500">Preview — print or save as PDF</span>
          <button
            onClick={() => window.print()}
            className="bg-black text-white text-sm px-4 py-2 rounded hover:bg-gray-800"
          >
            Download PDF
          </button>
        </div>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 36 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>Silaa Collective</div>
            <div style={{ fontSize: 12, color: "#71717a", marginTop: 4 }}>Sales Invoice</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{order.invoice_number || `SO-${String(order.id).padStart(4, "0")}`}</div>
            <div style={{ fontSize: 12, color: "#71717a", marginTop: 4 }}>Date: {orderDate}</div>
          </div>
        </div>

        {/* Meta grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, marginBottom: 32, padding: "20px 0", borderTop: "1px solid #e4e4e7", borderBottom: "1px solid #e4e4e7" }}>
          <div>
            <div className="label">Bill To</div>
            <div className="value" style={{ fontWeight: 600 }}>{order.customer_name}</div>
            {order.customer_phone && <div className="value" style={{ fontSize: 12, color: "#71717a", marginTop: 2 }}>{order.customer_phone}</div>}
          </div>
          <div>
            <div className="label">Address</div>
            <div className="value" style={{ fontSize: 12 }}>{order.customer_address || "—"}</div>
            {order.customer_state && <div className="value" style={{ fontSize: 12, color: "#71717a" }}>{order.customer_state}</div>}
          </div>
          <div>
            <div className="label">Category</div>
            <div className="value">{order.category || "—"}</div>
          </div>
        </div>

        {/* Lines table */}
        <table style={{ marginBottom: 0 }}>
          <thead>
            <tr>
              <th>#</th>
              <th>Item / Variant</th>
              <th style={{ textAlign: "right" }}>Qty</th>
              <th style={{ textAlign: "right" }}>Unit Price</th>
              <th style={{ textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((l, i) => {
              const qty = Number(l.qty) || 0;
              const unitPrice = Number(l.unit_price) || 0;
              const amt = qty * unitPrice;
              return (
                <tr key={l.id}>
                  <td style={{ color: "#71717a" }}>{i + 1}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{l.variant_sku || `Variant #${l.variant_id}`}</div>
                    <div style={{ fontSize: 11, color: "#71717a" }}>{l.variant_color} {l.variant_size}</div>
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{qty}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>₹{unitPrice.toFixed(2)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>₹{amt.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <div style={{ minWidth: 260 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", fontSize: 15, fontWeight: 700, borderTop: "2px solid #111", marginTop: 4 }}>
              <span>Total Amount</span>
              <span>₹{(Number(order.total_amount) || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 48, paddingTop: 16, borderTop: "1px solid #e4e4e7", fontSize: 11, color: "#71717a", textAlign: "center" }}>
          Thank you for your business! Generated on {today}.
        </div>
      </div>
    </>
  );
}

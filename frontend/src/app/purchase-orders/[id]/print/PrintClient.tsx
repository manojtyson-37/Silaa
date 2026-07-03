"use client";

import { useEffect } from "react";
import { PurchaseOrderDetail, Supplier } from "@/lib/api";

type Props = {
  po: PurchaseOrderDetail;
  suppliers: Supplier[];
};

export default function PrintClient({ po, suppliers }: Props) {
  const supplierName = suppliers.find((s) => s.id === po.supplier_id)?.name ?? `Supplier #${po.supplier_id}`;
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const dispatchDate = po.dispatch_date
    ? new Date(po.dispatch_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  const taxRate = parseFloat(po.tax_rate ?? "0");
  const subtotal = po.lines.reduce((sum, l) => sum + parseFloat(l.ordered_qty) * parseFloat(l.agreed_price), 0);
  const taxAmt = subtotal * (taxRate / 100);
  const total = subtotal + taxAmt;

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
            <div style={{ fontSize: 12, color: "#71717a", marginTop: 4 }}>Sales Order</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 600 }}>SO-{String(po.id).padStart(4, "0")}</div>
            <div style={{ fontSize: 12, color: "#71717a", marginTop: 4 }}>Date: {today}</div>
          </div>
        </div>

        {/* Meta grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, marginBottom: 32, padding: "20px 0", borderTop: "1px solid #e4e4e7", borderBottom: "1px solid #e4e4e7" }}>
          <div>
            <div className="label">Bill To</div>
            <div className="value" style={{ fontWeight: 600 }}>{supplierName}</div>
          </div>
          <div>
            <div className="label">Dispatch Date</div>
            <div className="value">{dispatchDate}</div>
          </div>
          <div>
            <div className="label">Payment Terms</div>
            <div className="value">{po.payment_terms || "—"}</div>
          </div>
        </div>

        {/* Reference image */}
        {po.image_url && (
          <div style={{ marginBottom: 24 }}>
            <div className="label" style={{ marginBottom: 8 }}>Reference</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={po.image_url} alt="Reference" style={{ maxHeight: 160, borderRadius: 8, border: "1px solid #e4e4e7" }} />
          </div>
        )}

        {/* Description */}
        {po.description && (
          <div style={{ marginBottom: 24, padding: 16, background: "#fafafa", borderRadius: 8, border: "1px solid #e4e4e7" }}>
            <div className="label" style={{ marginBottom: 6 }}>Notes</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: "#444" }}>{po.description}</div>
          </div>
        )}

        {/* Lines table */}
        <table style={{ marginBottom: 0 }}>
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th style={{ textAlign: "right" }}>Qty</th>
              <th>UOM</th>
              <th style={{ textAlign: "right" }}>Unit Price</th>
              <th style={{ textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((l, i) => {
              const amt = parseFloat(l.ordered_qty) * parseFloat(l.agreed_price);
              return (
                <tr key={l.id}>
                  <td style={{ color: "#71717a" }}>{i + 1}</td>
                  <td>{l.component_type} #{l.component_id}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{l.ordered_qty}</td>
                  <td>{l.ordered_uom}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>₹{parseFloat(l.agreed_price).toFixed(2)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>₹{amt.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <div style={{ minWidth: 260 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", fontSize: 13, color: "#71717a" }}>
              <span>Subtotal</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            {taxRate > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", fontSize: 13, color: "#71717a" }}>
                <span>Tax ({taxRate}%)</span>
                <span>₹{taxAmt.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", fontSize: 15, fontWeight: 700, borderTop: "2px solid #111", marginTop: 4 }}>
              <span>Total</span>
              <span>₹{total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 48, paddingTop: 16, borderTop: "1px solid #e4e4e7", fontSize: 11, color: "#71717a", textAlign: "center" }}>
          Silaa Collective · This document serves as a confirmed Sales Order
        </div>
      </div>
    </>
  );
}

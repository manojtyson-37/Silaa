"use client";

import { useState } from "react";
import { api, ProductionEvent, ProductionOrder } from "@/lib/api";

export type VariantBreakdown = { variant_id: number; planned_qty: string };
export type CuttingRecord = {
  id: number;
  fabric_lot_id: number;
  actual_fabric_qty: string;
  cut_pieces_qty: string;
  wastage_qty: string;
};
export type StitchingBatch = {
  id: number;
  vendor_id: number | null;
  in_house: boolean;
  sent_qty: string;
  received_qty: string;
  rejected_qty: string;
  qc_state: string | null;
};

type Props = {
  order: ProductionOrder;
  variants: VariantBreakdown[];
  initialCuttingRecords: CuttingRecord[];
  initialBatches: StitchingBatch[];
  initialEvents: ProductionEvent[];
};

/**
 * Every action here opens its form inline, anchored directly under the row
 * it acts on -- no modal, no route change, no scroll-to-top. This is the
 * pattern flagged as missing on the earlier tags-edit UI: the edit surface
 * appears where the user is already looking, not somewhere else on the page.
 */
export default function ProductionOrderDetail({
  order,
  variants,
  initialCuttingRecords,
  initialBatches,
  initialEvents,
}: Props) {
  const [cuttingRecords, setCuttingRecords] = useState(initialCuttingRecords);
  const [batches, setBatches] = useState(initialBatches);
  const [events, setEvents] = useState(initialEvents);

  const refreshEvents = async () => {
    setEvents(await api.get<ProductionEvent[]>(`/production-orders/${order.id}/events`));
  };

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="font-medium mb-2">Variant breakdown</h2>
        <ul className="text-sm text-gray-700">
          {variants.map((v) => (
            <li key={v.variant_id}>
              Variant #{v.variant_id} — planned {v.planned_qty}
            </li>
          ))}
        </ul>
      </section>

      <CuttingSection
        orderId={order.id}
        records={cuttingRecords}
        onAdded={(r) => {
          setCuttingRecords((prev) => [...prev, r]);
          refreshEvents();
        }}
      />

      <StitchingSection
        orderId={order.id}
        batches={batches}
        onBatchAdded={(b) => {
          setBatches((prev) => [...prev, b]);
          refreshEvents();
        }}
        onBatchUpdated={(b) => {
          setBatches((prev) => prev.map((x) => (x.id === b.id ? b : x)));
          refreshEvents();
        }}
      />

      <section>
        <h2 className="font-medium mb-2">Event log</h2>
        <ol className="text-sm text-gray-600 flex flex-col gap-1">
          {events.map((e, i) => (
            <li key={i}>
              <span className="font-mono text-xs text-gray-400">{e.created_at}</span>{" "}
              {e.event_type}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function CuttingSection({
  orderId,
  records,
  onAdded,
}: {
  orderId: number;
  records: CuttingRecord[];
  onAdded: (r: CuttingRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    fabric_lot_id: "",
    planned_fabric_qty: "",
    actual_fabric_qty: "",
    cut_pieces_qty: "",
    wastage_qty: "0",
  });
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      const result = await api.post<{ id: number; actual_fabric_qty: string }>(
        `/production-orders/${orderId}/cutting-records`,
        { ...form, fabric_lot_id: Number(form.fabric_lot_id), created_by: "ui" }
      );
      onAdded({ id: result.id, ...form, fabric_lot_id: Number(form.fabric_lot_id) });
      setOpen(false);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <section>
      <h2 className="font-medium mb-2">Cutting</h2>
      <table className="w-full text-sm border rounded mb-2">
        <thead className="text-left text-gray-500 bg-gray-50">
          <tr>
            <th className="py-1 px-2">Lot</th>
            <th>Actual qty</th>
            <th>Cut pieces</th>
            <th>Wastage</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="py-1 px-2">#{r.fabric_lot_id}</td>
              <td>{r.actual_fabric_qty}</td>
              <td>{r.cut_pieces_qty}</td>
              <td>{r.wastage_qty}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {!open && (
        <button className="text-sm text-blue-600" onClick={() => setOpen(true)}>
          + Record cutting
        </button>
      )}

      {open && (
        <div className="rounded border bg-gray-50 p-3 flex flex-col gap-2">
          <input
            className="border rounded px-2 py-1 text-sm text-gray-900 bg-white placeholder:text-gray-400"
            placeholder="Fabric lot ID"
            value={form.fabric_lot_id}
            onChange={(e) => setForm({ ...form, fabric_lot_id: e.target.value })}
          />
          <input
            className="border rounded px-2 py-1 text-sm text-gray-900 bg-white placeholder:text-gray-400"
            placeholder="Planned fabric qty"
            value={form.planned_fabric_qty}
            onChange={(e) => setForm({ ...form, planned_fabric_qty: e.target.value })}
          />
          <input
            className="border rounded px-2 py-1 text-sm text-gray-900 bg-white placeholder:text-gray-400"
            placeholder="Actual fabric qty"
            value={form.actual_fabric_qty}
            onChange={(e) => setForm({ ...form, actual_fabric_qty: e.target.value })}
          />
          <input
            className="border rounded px-2 py-1 text-sm text-gray-900 bg-white placeholder:text-gray-400"
            placeholder="Cut pieces"
            value={form.cut_pieces_qty}
            onChange={(e) => setForm({ ...form, cut_pieces_qty: e.target.value })}
          />
          <input
            className="border rounded px-2 py-1 text-sm text-gray-900 bg-white placeholder:text-gray-400"
            placeholder="Wastage"
            value={form.wastage_qty}
            onChange={(e) => setForm({ ...form, wastage_qty: e.target.value })}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button className="text-sm bg-black text-white rounded px-3 py-1" onClick={submit}>
              Save
            </button>
            <button className="text-sm text-gray-500" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function StitchingSection({
  orderId,
  batches,
  onBatchAdded,
  onBatchUpdated,
}: {
  orderId: number;
  batches: StitchingBatch[];
  onBatchAdded: (b: StitchingBatch) => void;
  onBatchUpdated: (b: StitchingBatch) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ sent_qty: "", in_house: true });

  const submitNewBatch = async () => {
    const result = await api.post<{ id: number; sent_qty: string }>(
      `/production-orders/${orderId}/stitching-batches`,
      { sent_qty: form.sent_qty, in_house: form.in_house, created_by: "ui" }
    );
    onBatchAdded({
      id: result.id,
      vendor_id: null,
      in_house: form.in_house,
      sent_qty: form.sent_qty,
      received_qty: "0",
      rejected_qty: "0",
      qc_state: null,
    });
    setOpen(false);
  };

  return (
    <section>
      <h2 className="font-medium mb-2">Stitching &amp; QC</h2>
      <div className="flex flex-col gap-3">
        {batches.map((b) => (
          <BatchRow key={b.id} orderId={orderId} batch={b} onUpdated={onBatchUpdated} />
        ))}
      </div>

      {!open && (
        <button className="text-sm text-blue-600 mt-2" onClick={() => setOpen(true)}>
          + Send to stitching
        </button>
      )}
      {open && (
        <div className="rounded border bg-gray-50 p-3 flex flex-col gap-2 mt-2">
          <input
            className="border rounded px-2 py-1 text-sm text-gray-900 bg-white placeholder:text-gray-400"
            placeholder="Sent qty"
            value={form.sent_qty}
            onChange={(e) => setForm({ ...form, sent_qty: e.target.value })}
          />
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.in_house}
              onChange={(e) => setForm({ ...form, in_house: e.target.checked })}
            />
            In-house
          </label>
          <div className="flex gap-2">
            <button className="text-sm bg-black text-white rounded px-3 py-1" onClick={submitNewBatch}>
              Save
            </button>
            <button className="text-sm text-gray-500" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function BatchRow({
  orderId,
  batch,
  onUpdated,
}: {
  orderId: number;
  batch: StitchingBatch;
  onUpdated: (b: StitchingBatch) => void;
}) {
  const [panel, setPanel] = useState<"none" | "receive" | "qc">("none");
  const [receiveForm, setReceiveForm] = useState({ received_qty: "", rejected_qty: "0" });
  const [qcForm, setQcForm] = useState({ qc_state: "PASS", qty: "", variant_id: "" });

  const submitReceive = async () => {
    await api.post(`/stitching-batches/${batch.id}/receive`, { ...receiveForm, created_by: "ui" });
    onUpdated({ ...batch, received_qty: receiveForm.received_qty, rejected_qty: receiveForm.rejected_qty });
    setPanel("none");
  };

  const submitQc = async () => {
    await api.post(`/stitching-batches/${batch.id}/qc`, {
      qc_state: qcForm.qc_state,
      qty: qcForm.qty,
      variant_id: Number(qcForm.variant_id),
      created_by: "ui",
    });
    onUpdated({ ...batch, qc_state: qcForm.qc_state });
    setPanel("none");
  };

  return (
    <div className="rounded border p-3">
      <div className="flex justify-between text-sm">
        <span>
          Batch #{batch.id} — {batch.in_house ? "in-house" : `vendor ${batch.vendor_id}`}
        </span>
        <span className="text-gray-500">
          sent {batch.sent_qty} · received {batch.received_qty} · rejected {batch.rejected_qty} ·{" "}
          {batch.qc_state ?? "no QC yet"}
        </span>
      </div>

      <div className="flex gap-3 mt-2 text-sm text-blue-600">
        {batch.qc_state === null && (
          <>
            <button onClick={() => setPanel(panel === "receive" ? "none" : "receive")}>
              + Receive
            </button>
            <button onClick={() => setPanel(panel === "qc" ? "none" : "qc")}>+ Apply QC</button>
          </>
        )}
      </div>

      {panel === "receive" && (
        <div className="rounded border bg-gray-50 p-3 flex flex-col gap-2 mt-2">
          <input
            className="border rounded px-2 py-1 text-sm text-gray-900 bg-white placeholder:text-gray-400"
            placeholder="Received qty"
            value={receiveForm.received_qty}
            onChange={(e) => setReceiveForm({ ...receiveForm, received_qty: e.target.value })}
          />
          <input
            className="border rounded px-2 py-1 text-sm text-gray-900 bg-white placeholder:text-gray-400"
            placeholder="Rejected qty"
            value={receiveForm.rejected_qty}
            onChange={(e) => setReceiveForm({ ...receiveForm, rejected_qty: e.target.value })}
          />
          <button className="text-sm bg-black text-white rounded px-3 py-1 w-fit" onClick={submitReceive}>
            Save
          </button>
        </div>
      )}

      {panel === "qc" && (
        <div className="rounded border bg-gray-50 p-3 flex flex-col gap-2 mt-2">
          <select
            className="border rounded px-2 py-1 text-sm text-gray-900 bg-white placeholder:text-gray-400"
            value={qcForm.qc_state}
            onChange={(e) => setQcForm({ ...qcForm, qc_state: e.target.value })}
          >
            {["PASS", "REWORK", "SECOND_SALE", "SCRAP", "HOLD"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            className="border rounded px-2 py-1 text-sm text-gray-900 bg-white placeholder:text-gray-400"
            placeholder="Qty"
            value={qcForm.qty}
            onChange={(e) => setQcForm({ ...qcForm, qty: e.target.value })}
          />
          <input
            className="border rounded px-2 py-1 text-sm text-gray-900 bg-white placeholder:text-gray-400"
            placeholder="Variant ID"
            value={qcForm.variant_id}
            onChange={(e) => setQcForm({ ...qcForm, variant_id: e.target.value })}
          />
          <button className="text-sm bg-black text-white rounded px-3 py-1 w-fit" onClick={submitQc}>
            Save
          </button>
        </div>
      )}
    </div>
  );
}

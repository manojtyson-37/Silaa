"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { api, ProductionEvent, ProductionOrder } from "@/lib/api";
import { Button, Card, Input, Select, StatusPill, Table, Td, Th } from "@/components/ui";

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
        <SectionTitle>Variant breakdown</SectionTitle>
        <Card className="p-4">
          <ul className="text-sm text-foreground flex flex-col gap-1">
            {variants.map((v) => (
              <li key={v.variant_id} className="flex justify-between">
                <span className="text-muted-foreground">Variant #{v.variant_id}</span>
                <span className="font-medium">planned {v.planned_qty}</span>
              </li>
            ))}
          </ul>
        </Card>
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
        <SectionTitle>Event log</SectionTitle>
        <Card className="p-4">
          <ol className="text-sm flex flex-col gap-2">
            {events.map((e, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-mono text-xs text-muted-foreground shrink-0 pt-0.5">
                  {new Date(e.created_at).toLocaleString("en-US")}
                </span>
                <span className="text-foreground">{e.event_type}</span>
              </li>
            ))}
          </ol>
        </Card>
      </section>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-medium text-foreground mb-2 text-sm">{children}</h2>;
}

function InlineForm({ children }: { children: React.ReactNode }) {
  return <Card className="p-4 mt-3 flex flex-col gap-2.5 bg-muted/30">{children}</Card>;
}

function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-primary mt-3 cursor-pointer transition-colors duration-150"
    >
      <Plus size={14} /> {children}
    </button>
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
      <SectionTitle>Cutting</SectionTitle>
      {records.length > 0 && (
        <Table>
          <thead>
            <tr>
              <Th>Lot</Th>
              <Th>Actual qty</Th>
              <Th>Cut pieces</Th>
              <Th>Wastage</Th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <Td className="font-mono text-xs">#{r.fabric_lot_id}</Td>
                <Td>{r.actual_fabric_qty}</Td>
                <Td>{r.cut_pieces_qty}</Td>
                <Td className="text-muted-foreground">{r.wastage_qty}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {!open && <AddButton onClick={() => setOpen(true)}>Record cutting</AddButton>}

      {open && (
        <InlineForm>
          <Input
            placeholder="Fabric lot ID"
            value={form.fabric_lot_id}
            onChange={(e) => setForm({ ...form, fabric_lot_id: e.target.value })}
          />
          <Input
            placeholder="Planned fabric qty"
            value={form.planned_fabric_qty}
            onChange={(e) => setForm({ ...form, planned_fabric_qty: e.target.value })}
          />
          <Input
            placeholder="Actual fabric qty"
            value={form.actual_fabric_qty}
            onChange={(e) => setForm({ ...form, actual_fabric_qty: e.target.value })}
          />
          <Input
            placeholder="Cut pieces"
            value={form.cut_pieces_qty}
            onChange={(e) => setForm({ ...form, cut_pieces_qty: e.target.value })}
          />
          <Input
            placeholder="Wastage"
            value={form.wastage_qty}
            onChange={(e) => setForm({ ...form, wastage_qty: e.target.value })}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button onClick={submit}>Save</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </InlineForm>
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
      <SectionTitle>Stitching &amp; QC</SectionTitle>
      <div className="flex flex-col gap-3">
        {batches.map((b) => (
          <BatchRow key={b.id} orderId={orderId} batch={b} onUpdated={onBatchUpdated} />
        ))}
      </div>

      {!open && <AddButton onClick={() => setOpen(true)}>Send to stitching</AddButton>}
      {open && (
        <InlineForm>
          <Input
            placeholder="Sent qty"
            value={form.sent_qty}
            onChange={(e) => setForm({ ...form, sent_qty: e.target.value })}
          />
          <label className="text-sm flex items-center gap-2 text-foreground">
            <input
              type="checkbox"
              checked={form.in_house}
              onChange={(e) => setForm({ ...form, in_house: e.target.checked })}
              className="rounded border-border"
            />
            In-house
          </label>
          <div className="flex gap-2 pt-1">
            <Button onClick={submitNewBatch}>Save</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </InlineForm>
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
    <Card className="p-4">
      <div className="flex justify-between items-center text-sm">
        <span className="font-medium text-foreground">
          Batch #{batch.id} — {batch.in_house ? "in-house" : `vendor ${batch.vendor_id}`}
        </span>
        {batch.qc_state && <StatusPill value={batch.qc_state} />}
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        sent {batch.sent_qty} · received {batch.received_qty} · rejected {batch.rejected_qty}
      </div>

      {batch.qc_state === null && (
        <div className="flex gap-4 mt-3">
          <button
            onClick={() => setPanel(panel === "receive" ? "none" : "receive")}
            className="text-sm font-medium text-accent hover:text-primary cursor-pointer transition-colors duration-150"
          >
            Receive
          </button>
          <button
            onClick={() => setPanel(panel === "qc" ? "none" : "qc")}
            className="text-sm font-medium text-accent hover:text-primary cursor-pointer transition-colors duration-150"
          >
            Apply QC
          </button>
        </div>
      )}

      {panel === "receive" && (
        <InlineForm>
          <Input
            placeholder="Received qty"
            value={receiveForm.received_qty}
            onChange={(e) => setReceiveForm({ ...receiveForm, received_qty: e.target.value })}
          />
          <Input
            placeholder="Rejected qty"
            value={receiveForm.rejected_qty}
            onChange={(e) => setReceiveForm({ ...receiveForm, rejected_qty: e.target.value })}
          />
          <Button className="w-fit" onClick={submitReceive}>
            Save
          </Button>
        </InlineForm>
      )}

      {panel === "qc" && (
        <InlineForm>
          <Select
            value={qcForm.qc_state}
            onChange={(e) => setQcForm({ ...qcForm, qc_state: e.target.value })}
          >
            {["PASS", "REWORK", "SECOND_SALE", "SCRAP", "HOLD"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Qty"
            value={qcForm.qty}
            onChange={(e) => setQcForm({ ...qcForm, qty: e.target.value })}
          />
          <Input
            placeholder="Variant ID"
            value={qcForm.variant_id}
            onChange={(e) => setQcForm({ ...qcForm, variant_id: e.target.value })}
          />
          <Button className="w-fit" onClick={submitQc}>
            Save
          </Button>
        </InlineForm>
      )}
    </Card>
  );
}

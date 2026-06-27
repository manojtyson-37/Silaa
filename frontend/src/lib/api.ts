const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    cache: "no-store", // this app's data changes on every action; never serve a stale fetch
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${path}: ${body}`);
  }
  return res.json();
}

export const api = {
  get: <T>(path: string, token?: string) => request<T>(path, undefined, token),
  post: <T>(path: string, body?: unknown, token?: string) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }, token),
  patch: <T>(path: string, body?: unknown, token?: string) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }, token),
};

export type FabricItem = {
  id: number;
  name: string;
  composition: string | null;
  gsm: number | null;
  width: string | null;
  consumption_uom: string;
};

export type FabricLot = {
  id: number;
  fabric_item_id: number;
  received_qty: string;
  cost_per_uom: string;
  dye_lot_no: string | null;
};

export type AccessoryItem = {
  id: number;
  name: string;
  type: string;
  consumption_uom: string;
  default_cost: string | null;
};

export type Style = { id: number; name: string; category: string | null; collection: string | null };
export type StyleVariant = {
  id: number;
  style_id: number;
  color: string;
  size: string;
  sku_code: string;
  status: string;
};

export type ProductionOrder = {
  id: number;
  style_id: number;
  bom_version_id: number;
  status: string;
  source: string;
};

export type ProductionEvent = {
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
  created_by: string;
};

export type Supplier = { id: number; name: string; type: string };
export type PurchaseOrder = { id: number; supplier_id: number; status: string };
export type PurchaseOrderLine = {
  id: number;
  component_type: string;
  component_id: number;
  ordered_qty: string;
  ordered_uom: string;
  agreed_price: string;
};
export type PurchaseOrderDetail = PurchaseOrder & { lines: PurchaseOrderLine[] };

export type SalesOrder = { id: number; customer_name: string; status: string };
export type SalesOrderLine = { id: number; variant_id: number; qty: string; unit_price: string };
export type SalesOrderDetail = SalesOrder & { lines: SalesOrderLine[] };

export type CostBreakdown = {
  fabric_cost: string;
  accessory_cost: string;
  labor_cost: string;
  total_cost: string;
  qty_passed: string;
  unit_cost: string | null;
};

export type OrderMarginLine = {
  variant_id: number;
  qty: string;
  unit_price: string;
  unit_cost: string;
  margin: string;
};
export type OrderMargin = { order_id: number; lines: OrderMarginLine[]; total_margin: string };

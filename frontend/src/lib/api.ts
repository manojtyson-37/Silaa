const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    cache: "no-store", // this app's data changes on every action; never serve a stale fetch
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${path}: ${body}`);
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
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

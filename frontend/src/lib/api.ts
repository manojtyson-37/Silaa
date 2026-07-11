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
  if (res.status === 401) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  if (!res.ok) {
    const body = await res.text();
    let msg = body;
    try { const j = JSON.parse(body); if (typeof j.detail === "string") msg = j.detail; } catch {}
    throw new Error(`${res.status} ${path}: ${msg}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function decodeToken(token: string) {
  try {
    const [b64] = token.split(".");
    const pad = "=".repeat((-b64.length % 4 + 4) % 4);
    if (typeof window === "undefined") {
      return JSON.parse(Buffer.from(b64.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString());
    } else {
      return JSON.parse(atob(b64.replace(/-/g, "+").replace(/_/g, "/") + pad));
    }
  } catch {
    return { role: "viewer" };
  }
}

export function getTokenRole(): "admin" | "editor" | "viewer" {
  if (typeof document === "undefined") return "viewer";
  const match = document.cookie.match(/(?:^|; )silaa_token=([^;]+)/);
  if (!match) return "viewer";
  const decoded = decodeToken(match[1]);
  return decoded.role || "viewer";
}

export const api = {
  get: <T>(path: string, token?: string) => request<T>(path, undefined, token),
  post: <T>(path: string, body?: unknown, token?: string) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }, token),
  patch: <T>(path: string, body?: unknown, token?: string) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }, token),
  delete: <T>(path: string, token?: string) =>
    request<T>(path, { method: "DELETE" }, token),
  upload: async (file: File, token?: string): Promise<{ url: string }> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/upload`, {
      method: "POST",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
    });
    if (!res.ok) throw new Error(`Upload failed: ${await res.text()}`);
    return res.json();
  },
  downloadBlob: async (path: string, token?: string): Promise<Blob> => {
    const res = await fetch(`${BASE}${path}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) throw new Error(`Download failed: ${await res.text()}`);
    return res.blob();
  },
};

export type FabricItem = {
  id: number;
  name: string;
  composition: string | null;
  gsm: number | null;
  width: string | null;
  consumption_uom: string;
  image_url: string | null;
};

export type FabricLot = {
  id: number;
  fabric_item_id: number;
  supplier_id: number;
  received_qty: string;
  cost_per_uom: string;
  dye_lot_no: string | null;
};
export type FabricLotWithBalance = FabricLot & { balance: string };

export type AccessoryItem = {
  id: number;
  name: string;
  type: string;
  consumption_uom: string;
  default_cost: string | null;
};

export type Style = { id: number; name: string; category: string | null; collection: string | null; image_url: string | null };
export type StyleWithVariants = Style & { variants: StyleVariant[] };
export type StyleVariant = {
  id: number;
  style_id: number;
  color: string;
  size: string;
  sku_code: string;
  qty: number;
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
export type PurchaseOrder = {
  id: number;
  supplier_id: number;
  status: string;
  description: string | null;
  image_url: string | null;
  dispatch_date: string | null;
  tax_rate: string | null;
  payment_terms: string | null;
};
export type PurchaseOrderLine = {
  id: number;
  component_type: string;
  component_id: number;
  ordered_qty: string;
  ordered_uom: string;
  agreed_price: string;
};
export type PurchaseOrderDetail = PurchaseOrder & { lines: PurchaseOrderLine[] };

export type SalesOrder = {
  id: number;
  customer_name: string;
  customer_phone: string | null;
  customer_address: string | null;
  customer_state: string | null;
  invoice_number: string | null;
  status: string;
  created_at: string | null;
  total_amount: string | null;
};
export type SalesOrderLine = { id: number; variant_id: number; qty: string; unit_price: string; gst_percent: string };
export type SalesOrderDetail = SalesOrder & { lines: SalesOrderLine[] };

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam",
  "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
  "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

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
export type OrderMarginTotal = { order_id: number; total_margin: string };

export type DashboardEvent = {
  production_order_id: number;
  event_type: string;
  created_at: string;
  created_by: string;
};
export type DashboardSummary = {
  open_production_orders: number;
  draft_sales_orders: number;
  fulfilled_sales_orders: number;
  pending_purchase_orders: number;
  recent_events: DashboardEvent[];
};

export type FabricVarianceRow = {
  cutting_record_id: number;
  production_order_id: number;
  style_id: number;
  fabric_lot_id: number;
  planned_fabric_qty: string;
  actual_fabric_qty: string;
  variance_qty: string;
  wastage_qty: string;
};

export type WastageRejectionReport = {
  wastage_by_style: { style_id: number; wastage_qty: string }[];
  rejection_by_vendor: { vendor_id: number | null; rejected_qty: string }[];
  scrapped_by_style: { style_id: number; scrapped_qty: string }[];
};

export type ExpenseCategory = { id: number; name: string; color: string | null; icon: string | null };
export type CategoryBudget = { id: number; category_id: number; monthly_limit: string };
export type CompanySetting = { key: string; value: string };

export type ProcurementItemCreate = {
  fabric_item_id?: number | null;
  new_fabric_name?: string | null;
  new_fabric_composition?: string | null;
  new_fabric_gsm?: number | null;
  new_fabric_width?: number | null;
  supplier_id?: number | null;
  new_supplier_name?: string | null;
  fabric_qty: number;
  price: number;
  image_url?: string | null;
};

export type Expense = {
  id: number;
  category_id: number;
  amount: string;
  expense_date: string;
  description: string;
  paid_to: string | null;
  tags: string[];
  receipt_urls: string[];
  is_recurring: boolean;
};

export type User = {
  id: number;
  username: string;
  role: string;
  is_active: boolean;
};

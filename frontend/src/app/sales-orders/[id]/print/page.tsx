import { api } from "@/lib/api";
import { requireAuth } from "@/lib/serverAuth";
import { notFound } from "next/navigation";
import PrintClient from "./PrintClient";

// Define locally since it might not be in api.ts yet
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
  total_amount: number;
  lines: {
    id: number;
    variant_id: number;
    qty: number;
    unit_price: number;
    gst_percent: number;
    variant_color: string;
    variant_size: string;
    variant_sku: string;
  }[];
};

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await requireAuth();

  let order: SalesOrderOut;
  try {
    order = await api.get<SalesOrderOut>(`/sales-orders/${id}`, token);
  } catch {
    notFound();
  }

  return <PrintClient order={order} />;
}

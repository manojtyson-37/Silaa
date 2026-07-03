import { api, PurchaseOrderDetail, Supplier } from "@/lib/api";
import { requireAuth } from "@/lib/serverAuth";
import { notFound } from "next/navigation";
import PrintClient from "./PrintClient";

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await requireAuth();

  let po: PurchaseOrderDetail;
  try {
    po = await api.get<PurchaseOrderDetail>(`/purchase-orders/${id}`, token);
  } catch {
    notFound();
  }

  const suppliers = await api.get<Supplier[]>("/suppliers", token);

  return <PrintClient po={po!} suppliers={suppliers} />;
}

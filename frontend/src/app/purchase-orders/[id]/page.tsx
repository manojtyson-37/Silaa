import { api, PurchaseOrderDetail, Supplier } from "@/lib/api";
import { requireAuth } from "@/lib/serverAuth";
import { notFound } from "next/navigation";
import PODetailClient from "./PODetailClient";

export default async function PODetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await requireAuth();
  const [suppliers] = await Promise.all([
    api.get<Supplier[]>("/suppliers", token),
  ]);

  let po: PurchaseOrderDetail;
  try {
    po = await api.get<PurchaseOrderDetail>(`/purchase-orders/${id}`, token);
  } catch {
    notFound();
  }

  return <PODetailClient po={po!} suppliers={suppliers} />;
}

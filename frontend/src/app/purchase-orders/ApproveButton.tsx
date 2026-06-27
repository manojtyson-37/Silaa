"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getClientToken } from "@/lib/clientAuth";

export default function ApproveButton({ poId }: { poId: number }) {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await api.patch(`/purchase-orders/${poId}/approve`, undefined, getClientToken());
        router.refresh();
      }}
      className="text-sm font-medium text-accent hover:text-primary cursor-pointer transition-colors duration-150"
    >
      Approve
    </button>
  );
}

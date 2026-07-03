"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Plus } from "lucide-react";
import { ProductionOrder, StyleWithVariants } from "@/lib/api";
import { Button, Card, StatusPill } from "@/components/ui";
import NewProductionOrderForm from "./NewProductionOrderForm";

type Props = {
  orders: ProductionOrder[];
  styles: StyleWithVariants[];
};

export default function ProductionClient({ orders, styles }: Props) {
  const [isCreating, setIsCreating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const getStyle = (styleId: number) => styles.find((s) => s.id === styleId);

  return (
    <>
      <div className="flex gap-4 mb-6">
        <Button onClick={() => setIsCreating(true)}>
          <Plus size={16} />
          New Production Order
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {orders.map((o) => {
          const style = getStyle(o.style_id);
          return (
            <Link key={`${o.id}-${refreshKey}`} href={`/production/${o.id}`}>
              <Card className="px-5 py-3.5 flex items-center justify-between hover:border-accent hover:shadow-sm transition-all duration-200">
                <div className="flex items-center gap-4">
                  {style?.image_url ? (
                    <div className="w-12 h-12 relative rounded-md overflow-hidden bg-muted border border-border shrink-0">
                      <Image
                        src={style.image_url}
                        alt={style.name || "Style image"}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-md bg-muted border border-border flex items-center justify-center shrink-0">
                      <span className="text-xs text-muted-foreground font-medium">No Img</span>
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-foreground text-sm flex items-center gap-2">
                      Order #{o.id}
                      <span className="text-muted-foreground font-normal">·</span>
                      <span className="text-accent">{style?.name || `Style #${o.style_id}`}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Source: {o.source}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <StatusPill value={o.status} />
                  <ChevronRight size={16} className="text-muted-foreground" />
                </div>
              </Card>
            </Link>
          );
        })}
        {orders.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground text-sm">No production orders yet.</Card>
        )}
      </div>

      {isCreating && (
        <NewProductionOrderForm
          styles={styles}
          onClose={() => setIsCreating(false)}
          onCreated={() => {
            setIsCreating(false);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </>
  );
}

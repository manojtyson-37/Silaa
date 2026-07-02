"use client";

import { useState } from "react";
import { FabricItem } from "@/lib/api";
import { Card } from "@/components/ui";
import EditFabricItemForm from "./EditFabricItemForm";

type Props = {
  fabricItems: FabricItem[];
};

export default function FabricClient({ fabricItems }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {fabricItems.map((item) => (
        <Card key={`${item.id}-${refreshKey}`} className="p-3 flex gap-3 items-start group">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-1 mb-1">
              <div className="flex-1 min-w-0">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-12 h-12 object-cover rounded border border-border shrink-0 mb-2" />
                ) : (
                  <div className="w-12 h-12 rounded border border-border bg-muted shrink-0 mb-2" />
                )}
                <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <EditFabricItemForm item={item} onSaved={() => setRefreshKey(k => k + 1)} />
              </div>
            </div>
            {item.width && <p className="text-xs text-muted-foreground">{item.width} m wide</p>}
          </div>
        </Card>
      ))}
    </div>
  );
}

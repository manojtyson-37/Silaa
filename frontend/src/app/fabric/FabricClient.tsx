"use client";

import { useState } from "react";
import { FabricItem } from "@/lib/api";
import { Card } from "@/components/ui";
import EditFabricItemForm from "./EditFabricItemForm";

type Props = {
  fabricItems: FabricItem[];
};

export default function FabricClient({ fabricItems }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const editingItem = fabricItems.find((f) => f.id === editingId);

  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {fabricItems.map((item) => (
          <div
            key={`${item.id}-${refreshKey}`}
            onClick={() => setEditingId(editingId === item.id ? null : item.id)}
            className={`rounded-xl border bg-card p-3 flex gap-3 items-start cursor-pointer transition-all ${
              editingId === item.id ? "ring-2 ring-accent border-accent/30" : "hover:shadow-md border-border"
            }`}
          >
            <div className="flex-1 min-w-0">
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="w-12 h-12 object-cover rounded border border-border mb-2" />
              ) : (
                <div className="w-12 h-12 rounded border border-border bg-muted mb-2" />
              )}
              <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
              {item.width && <p className="text-xs text-muted-foreground">{item.width} m wide</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Full-width edit panel below the grid */}
      {editingItem && (
        <Card className="p-5 border-accent/30">
          <p className="text-xs text-muted-foreground mb-3">Editing: <span className="font-medium text-foreground">{editingItem.name}</span></p>
          <EditFabricItemForm
            item={editingItem}
            onSaved={() => { setRefreshKey(k => k + 1); setEditingId(null); }}
            onCancel={() => setEditingId(null)}
          />
        </Card>
      )}
    </div>
  );
}

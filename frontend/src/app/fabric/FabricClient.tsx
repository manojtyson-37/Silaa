"use client";

import { useState } from "react";
import { api, FabricItem, FabricLotWithBalance, Supplier } from "@/lib/api";
import { Card, Table, Th, Td, Tr } from "@/components/ui";
import EditFabricItemForm from "./EditFabricItemForm";
import GRNForm from "./GRNForm";
import EditLotRow from "./EditLotRow";
import { Pencil, Trash2 } from "lucide-react";
import { getClientToken } from "@/lib/clientAuth";

type Props = {
  fabricItems: FabricItem[];
  lots: FabricLotWithBalance[];
  suppliers: Supplier[];
};

export default function FabricClient({ fabricItems, lots, suppliers }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingLotId, setEditingLotId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));

  return (
    <div className="flex flex-col gap-5 mb-6">
      {fabricItems.map((item) => {
        const itemLots = lots.filter(l => l.fabric_item_id === item.id);
        const totalBalance = itemLots.reduce((acc, l) => acc + Number(l.balance), 0);
        const isEditing = editingId === item.id;

        return (
          <Card key={`${item.id}-${refreshKey}`} className="p-5">
            <div className="flex gap-4 mb-4">
              <label className="relative group cursor-pointer w-20 h-20 shrink-0 block">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const { getClientToken } = await import("@/lib/clientAuth");
                      const { url } = await api.upload(file, getClientToken());
                      await api.patch(`/fabric-items/${item.id}`, { image_url: url }, getClientToken());
                      setRefreshKey(k => k + 1);
                    } catch (err) {
                      console.error("Upload failed", err);
                      alert("Failed to upload image");
                    }
                  }}
                />
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover rounded-lg border border-border group-hover:opacity-75 transition-opacity"
                  />
                ) : (
                  <div className="w-full h-full rounded-lg border border-border bg-muted flex items-center justify-center text-muted-foreground text-xs group-hover:bg-muted/80 transition-colors">
                    No Image
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-lg pointer-events-none">
                  <Pencil size={16} className="text-white" />
                </div>
              </label>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-medium text-lg text-foreground">{item.name}</h2>
                    {!isEditing && (
                      <button onClick={() => setEditingId(item.id)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                        <Pencil size={14} />
                      </button>
                    )}
                    {!isEditing && itemLots.length === 0 && (
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
                          try {
                            await api.delete(`/fabric-items/${item.id}`, getClientToken());
                            setRefreshKey(k => k + 1);
                          } catch (err) {
                            alert(String(err));
                          }
                        }}
                        className="text-muted-foreground hover:text-destructive cursor-pointer"
                        title="Delete item"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total Stock</p>
                    <p className="text-xl font-medium">{totalBalance} <span className="text-sm font-normal text-muted-foreground">{item.consumption_uom}s</span></p>
                  </div>
                </div>
                {!isEditing ? (
                  <p className="text-sm text-muted-foreground">
                    {[item.composition, item.gsm ? `${item.gsm} GSM` : null, item.width ? `${item.width}m width` : null].filter(Boolean).join(" · ") || "No additional details"}
                  </p>
                ) : (
                  <div className="mt-2">
                    <EditFabricItemForm
                      item={item}
                      onSaved={() => { setRefreshKey(k => k + 1); setEditingId(null); }}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                )}
              </div>
            </div>

            {itemLots.length > 0 ? (
              <div className="mb-4">
                <Table>
                  <thead>
                    <tr>
                      <Th>Lot #</Th>
                      <Th>Supplier</Th>
                      <Th>Dye Lot</Th>
                      <Th>Cost / {item.consumption_uom}</Th>
                      <Th>Balance</Th>
                      <Th>{null}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemLots.map((lot) => {
                      if (editingLotId === lot.id) {
                        return (
                          <EditLotRow
                            key={lot.id}
                            lot={lot}
                            suppliers={suppliers}
                            onSaved={() => {
                              setEditingLotId(null);
                              setRefreshKey((k) => k + 1);
                            }}
                            onCancel={() => setEditingLotId(null)}
                          />
                        );
                      }
                      return (
                        <Tr key={lot.id}>
                          <Td className="font-mono text-xs">#{lot.id}</Td>
                          <Td>{supplierMap.get(lot.supplier_id) || `ID: ${lot.supplier_id}`}</Td>
                          <Td className="text-muted-foreground">{lot.dye_lot_no ?? "—"}</Td>
                          <Td>₹{lot.cost_per_uom}</Td>
                          <Td className="font-medium">{lot.balance}</Td>
                          <Td className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setEditingLotId(lot.id)}
                                className="text-muted-foreground hover:text-foreground cursor-pointer"
                                title="Edit lot"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={async () => {
                                  if (!confirm(`Delete Lot #${lot.id}? This cannot be undone.`)) return;
                                  try {
                                    await api.delete(`/fabric-lots/${lot.id}`, getClientToken());
                                    setRefreshKey(k => k + 1);
                                  } catch (err) {
                                    alert(String(err));
                                  }
                                }}
                                className="text-muted-foreground hover:text-destructive cursor-pointer"
                                title="Delete lot"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground mb-4">No lots available for this fabric.</div>
            )}
            
            <div className="mt-2">
              <GRNForm fabricItems={fabricItems} suppliers={suppliers} preSelectedFabricId={item.id} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

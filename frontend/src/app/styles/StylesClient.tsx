"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Style, StyleVariant, api } from "@/lib/api";
import { getClientToken } from "@/lib/clientAuth";
import { Card, Table, Th } from "@/components/ui";
import EditStyleForm from "./EditStyleForm";
import NewVariantForm from "./NewVariantForm";
import EditVariantRow from "./EditVariantRow";

type Props = {
  styles: Style[];
  variantsByStyle: StyleVariant[][];
};

export default function StylesClient({ styles, variantsByStyle }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="flex flex-col gap-5">
      {styles.map((style, i) => (
        <Card key={`${style.id}-${refreshKey}`} className="p-5">
          <div className="flex gap-4 mb-3">
            {style.image_url && (
              <img
                src={style.image_url}
                alt={style.name}
                className="w-20 h-20 object-cover rounded-lg shrink-0 border border-border"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="font-medium text-foreground">{style.name}</h2>
                  <EditStyleForm style={style} onSaved={() => setRefreshKey(k => k + 1)} />
                </div>
                <button
                  onClick={async () => {
                    if (!confirm(`Delete style "${style.name}"? This will permanently delete all of its variants and BOMs. This cannot be undone.`)) return;
                    try {
                      await api.delete(`/styles/${style.id}`, getClientToken());
                      setRefreshKey(k => k + 1);
                    } catch (err) {
                      alert(String(err));
                    }
                  }}
                  className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                  title="Delete Style"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                {style.category} · {style.collection}
              </p>
            </div>
          </div>
          <Table>
            <thead>
              <tr>
                <Th>SKU</Th>
                <Th>Color</Th>
                <Th>Size</Th>
                <Th>Qty</Th>
                <Th>Status</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {variantsByStyle[i].map((v) => (
                <EditVariantRow key={v.id} v={v} />
              ))}
            </tbody>
          </Table>
          <NewVariantForm styleId={style.id} />
        </Card>
      ))}
    </div>
  );
}

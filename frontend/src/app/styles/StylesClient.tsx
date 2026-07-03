"use client";

import { useState } from "react";
import { Style, StyleVariant } from "@/lib/api";
import { Card, StatusPill, Table, Td, Th } from "@/components/ui";
import EditStyleForm from "./EditStyleForm";
import NewVariantForm from "./NewVariantForm";

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
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-medium text-foreground">{style.name}</h2>
                <EditStyleForm style={style} onSaved={() => setRefreshKey(k => k + 1)} />
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
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {variantsByStyle[i].map((v) => (
                <tr key={v.id}>
                  <Td className="font-mono text-xs">{v.sku_code}</Td>
                  <Td>{v.color}</Td>
                  <Td>{v.size}</Td>
                  <Td>
                    <StatusPill value={v.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <NewVariantForm styleId={style.id} />
        </Card>
      ))}
    </div>
  );
}

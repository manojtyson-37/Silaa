"use client";

import { useState } from "react";
import { api, FabricLotWithBalance, Supplier } from "@/lib/api";
import { getClientToken } from "@/lib/clientAuth";
import { Button, Input, Select, Td } from "@/components/ui";

type Props = {
  lot: FabricLotWithBalance;
  suppliers: Supplier[];
  onSaved: () => void;
  onCancel: () => void;
};

export default function EditLotRow({ lot, suppliers, onSaved, onCancel }: Props) {
  const [supplierId, setSupplierId] = useState(lot.supplier_id.toString());
  const [dyeLotNo, setDyeLotNo] = useState(lot.dye_lot_no || "");
  const [costPerUom, setCostPerUom] = useState(lot.cost_per_uom.toString());
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await api.patch(`/fabric-lots/${lot.id}`, {
        supplier_id: Number(supplierId),
        cost_per_uom: costPerUom,
        dye_lot_no: dyeLotNo || null,
      }, getClientToken());
      onSaved();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <tr className="bg-muted/40">
      <Td className="font-mono text-xs align-top pt-5">#{lot.id}</Td>
      <Td className="align-top">
        <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.type})
            </option>
          ))}
        </Select>
      </Td>
      <Td className="align-top">
        <Input placeholder="Dye lot no" value={dyeLotNo} onChange={(e) => setDyeLotNo(e.target.value)} />
      </Td>
      <Td className="align-top">
        <Input placeholder="Cost / unit" value={costPerUom} onChange={(e) => setCostPerUom(e.target.value)} />
      </Td>
      <Td className="font-medium align-top pt-5 tnum">{Number(lot.balance).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Td>
      <Td className="align-top">
        <div className="flex gap-2 items-center h-[34px]">
          <Button variant="ghost" onClick={submit} disabled={!supplierId || !costPerUom}>Save</Button>
          <Button variant="ghost" className="text-muted-foreground" onClick={onCancel}>Cancel</Button>
        </div>
        {error && <p className="text-sm text-destructive mt-1">{error}</p>}
      </Td>
    </tr>
  );
}

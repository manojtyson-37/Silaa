import Link from "next/link";
import { api, FabricLot } from "@/lib/api";

type Balance = { fabric_lot_id: number; balance: string };

export default async function FabricPage() {
  const lots = await api.get<FabricLot[]>("/fabric-lots");
  const balances = await Promise.all(
    lots.map((l) => api.get<Balance>(`/fabric-lots/${l.id}/balance`))
  );

  return (
    <main className="max-w-3xl mx-auto py-12 px-4">
      <Link href="/" className="text-sm text-gray-500">
        &larr; Home
      </Link>
      <h1 className="text-2xl font-semibold mt-2 mb-6">Fabric Inventory</h1>

      <table className="w-full text-sm border rounded">
        <thead className="text-left text-gray-500 bg-gray-50">
          <tr>
            <th className="py-2 px-3">Lot</th>
            <th className="px-3">Dye Lot</th>
            <th className="px-3">Cost / unit</th>
            <th className="px-3">Balance</th>
          </tr>
        </thead>
        <tbody>
          {lots.map((lot, i) => (
            <tr key={lot.id} className="border-t">
              <td className="py-2 px-3">#{lot.id}</td>
              <td className="px-3">{lot.dye_lot_no ?? "—"}</td>
              <td className="px-3">{lot.cost_per_uom}</td>
              <td className="px-3">{balances[i].balance}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {lots.length === 0 && <p className="text-gray-500 mt-4">No fabric lots yet.</p>}
    </main>
  );
}

import Link from "next/link";
import { api, Style, StyleVariant } from "@/lib/api";

export default async function StylesPage() {
  const styles = await api.get<Style[]>("/styles");
  const variantsByStyle = await Promise.all(
    styles.map((s) => api.get<StyleVariant[]>(`/styles/${s.id}/variants`))
  );

  return (
    <main className="max-w-3xl mx-auto py-12 px-4">
      <Link href="/" className="text-sm text-gray-500">
        &larr; Home
      </Link>
      <h1 className="text-2xl font-semibold mt-2 mb-6">Styles &amp; Variants</h1>

      {styles.length === 0 && <p className="text-gray-500">No styles yet.</p>}

      <div className="flex flex-col gap-6">
        {styles.map((style, i) => (
          <section key={style.id} className="rounded border p-4">
            <h2 className="font-medium">{style.name}</h2>
            <p className="text-sm text-gray-500 mb-3">
              {style.category} · {style.collection}
            </p>
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500">
                <tr>
                  <th className="py-1 pr-4">SKU</th>
                  <th className="pr-4">Color</th>
                  <th className="pr-4">Size</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {variantsByStyle[i].map((v) => (
                  <tr key={v.id} className="border-t">
                    <td className="py-1 pr-4">{v.sku_code}</td>
                    <td className="pr-4">{v.color}</td>
                    <td className="pr-4">{v.size}</td>
                    <td>{v.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </main>
  );
}

import { api, Style, StyleVariant } from "@/lib/api";
import { Card, PageHeader, StatusPill, Table, Td, Th } from "@/components/ui";
import NewStyleForm from "./NewStyleForm";
import { requireAuth } from "@/lib/serverAuth";

export default async function StylesPage() {
  const token = await requireAuth();
  const styles = await api.get<Style[]>("/styles", token);
  const variantsByStyle = await Promise.all(
    styles.map((s) => api.get<StyleVariant[]>(`/styles/${s.id}/variants`, token))
  );

  return (
    <main className="max-w-5xl mx-auto px-8 py-10">
      <PageHeader title="Styles & Variants" subtitle={`${styles.length} style${styles.length === 1 ? "" : "s"}`} />

      <NewStyleForm />

      {styles.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground text-sm">No styles yet.</Card>
      )}

      <div className="flex flex-col gap-5">
        {styles.map((style, i) => (
          <Card key={style.id} className="p-5">
            <div className="flex gap-4 mb-3">
              {style.image_url && (
                <img
                  src={style.image_url}
                  alt={style.name}
                  className="w-20 h-20 object-cover rounded-lg shrink-0 border border-border"
                />
              )}
              <div>
                <h2 className="font-medium text-foreground">{style.name}</h2>
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
          </Card>
        ))}
      </div>
    </main>
  );
}

import { api, Style, StyleVariant } from "@/lib/api";
import { Card, PageHeader } from "@/components/ui";
import NewStyleForm from "./NewStyleForm";
import StylesClient from "./StylesClient";
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

      <StylesClient styles={styles} variantsByStyle={variantsByStyle} />
    </main>
  );
}

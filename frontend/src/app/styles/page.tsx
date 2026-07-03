import { api, StyleWithVariants } from "@/lib/api";
import { Card, PageHeader } from "@/components/ui";
import NewStyleForm from "./NewStyleForm";
import StylesClient from "./StylesClient";
import { requireAuth } from "@/lib/serverAuth";

export default async function StylesPage() {
  const token = await requireAuth();
  const stylesWithVariants = await api.get<StyleWithVariants[]>("/styles-with-variants", token);

  return (
    <main className="max-w-5xl mx-auto px-8 py-10">
      <PageHeader title="Styles & Variants" subtitle={`${stylesWithVariants.length} style${stylesWithVariants.length === 1 ? "" : "s"}`} />

      <NewStyleForm />

      {stylesWithVariants.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground text-sm">No styles yet.</Card>
      )}

      <StylesClient styles={stylesWithVariants} variantsByStyle={stylesWithVariants.map(s => s.variants)} />
    </main>
  );
}

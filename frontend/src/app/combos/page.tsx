import { requireAuth } from "@/lib/serverAuth";
import { api, StyleVariantCombo, StyleWithVariants } from "@/lib/api";
import ComboManager from "./ComboManager";

export default async function CombosPage() {
  const token = await requireAuth();
  const [combos, styles] = await Promise.all([
    api.get("/combos", token).catch(() => []) as Promise<StyleVariantCombo[]>,
    api.get("/styles-with-variants", token).catch(() => []) as Promise<StyleWithVariants[]>,
  ]);
  return <ComboManager initialCombos={combos} styles={styles} />;
}

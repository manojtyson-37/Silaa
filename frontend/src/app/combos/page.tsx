import { requireAuth } from "@/lib/serverAuth";
import { api } from "@/lib/api";
import ComboManager from "./ComboManager";

export default async function CombosPage() {
  const { token } = await requireAuth();
  const [combos, styles] = await Promise.all([
    api.get("/combos", token).catch(() => []),
    api.get("/styles-with-variants", token).catch(() => []),
  ]);
  return <ComboManager initialCombos={combos} styles={styles} />;
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function requireAuth(): Promise<string> {
  const store = await cookies();
  const token = store.get("silaa_token")?.value;
  if (!token) redirect("/login");
  return token;
}

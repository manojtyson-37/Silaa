import { cookies } from "next/headers";
import { redirect } from "next/navigation";

function tokenExpired(token: string): boolean {
  try {
    const [b64] = token.split(".");
    const pad = "=".repeat((-b64.length % 4 + 4) % 4);
    const payload = JSON.parse(
      Buffer.from(b64.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString()
    );
    return (payload.exp ?? 0) < Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

export async function requireAuth(): Promise<string> {
  const store = await cookies();
  const token = store.get("silaa_token")?.value;
  if (!token || tokenExpired(token)) redirect("/login");
  return token;
}

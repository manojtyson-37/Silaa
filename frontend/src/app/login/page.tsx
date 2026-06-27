"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";
import { loginAction } from "./actions";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError(null);
    const err = await loginAction(username, password);
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <Card className="p-6 w-full max-w-sm flex flex-col gap-3">
        <div className="mb-2">
          <h1 className="text-lg font-semibold text-foreground">Silaa ERP</h1>
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </div>
        <Input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={submit} disabled={!username || !password || loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </Card>
    </main>
  );
}

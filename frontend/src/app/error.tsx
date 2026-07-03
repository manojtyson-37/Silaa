"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="max-w-5xl mx-auto px-8 py-20 text-center">
      <p className="text-destructive font-medium mb-1">Something went wrong</p>
      <p className="text-sm text-muted-foreground mb-6">{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}

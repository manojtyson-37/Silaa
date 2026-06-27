"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="min-h-full flex bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

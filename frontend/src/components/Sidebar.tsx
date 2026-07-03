"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Boxes, Factory, LayoutGrid, LogOut, Shirt, ClipboardList, BarChart3, Receipt, Users } from "lucide-react";
import { clearClientToken } from "@/lib/clientAuth";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/styles", label: "Styles & Variants", icon: Shirt },
  { href: "/purchase-orders", label: "Purchase Orders", icon: ClipboardList },
  { href: "/fabric", label: "Fabric Inventory", icon: Boxes },
  { href: "/production", label: "Production Orders", icon: Factory },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-surface min-h-screen px-3 py-5 flex flex-col gap-1">
      <div className="px-3 pb-4 mb-1 border-b border-border">
        <p className="font-semibold text-foreground tracking-tight">Silaa ERP</p>
        <p className="text-xs text-muted-foreground">Phase 1</p>
      </div>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
              active
                ? "bg-foreground text-surface shadow-sm"
                : "text-secondary hover:bg-muted"
            }`}
          >
            <Icon size={16} strokeWidth={active ? 2.5 : 2} />
            {label}
          </Link>
        );
      })}
      {role === "admin" && (
        <Link
          href="/users"
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
            pathname === "/users"
              ? "bg-foreground text-surface shadow-sm"
              : "text-secondary hover:bg-muted"
          }`}
        >
          <Users size={16} strokeWidth={pathname === "/users" ? 2.5 : 2} />
          Users
        </Link>
      )}
      <button
        onClick={() => {
          clearClientToken();
          router.push("/login");
          router.refresh();
        }}
        className="mt-auto flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-secondary hover:bg-muted hover:text-foreground cursor-pointer transition-colors duration-150"
      >
        <LogOut size={16} strokeWidth={2} />
        Log out
      </button>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Factory, LayoutGrid, Shirt } from "lucide-react";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/styles", label: "Styles & Variants", icon: Shirt },
  { href: "/fabric", label: "Fabric Inventory", icon: Boxes },
  { href: "/production", label: "Production Orders", icon: Factory },
];

export default function Sidebar() {
  const pathname = usePathname();

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
                ? "bg-primary text-on-primary"
                : "text-secondary hover:bg-muted"
            }`}
          >
            <Icon size={16} strokeWidth={2} />
            {label}
          </Link>
        );
      })}
    </aside>
  );
}

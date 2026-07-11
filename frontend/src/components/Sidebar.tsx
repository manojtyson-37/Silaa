"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Boxes, Factory, LayoutGrid, LogOut, Shirt, ClipboardList, BarChart3, Receipt, Users, ScrollText, Scissors } from "lucide-react";
import { clearClientToken } from "@/lib/clientAuth";

type NavItem = { href: string; label: string; icon: typeof LayoutGrid };
type NavSection = { title: string | null; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    title: null,
    items: [{ href: "/", label: "Overview", icon: LayoutGrid }],
  },
  {
    title: "Catalog",
    items: [
      { href: "/styles", label: "Styles & Variants", icon: Shirt },
    ],
  },
  {
    title: "Supply",
    items: [
      { href: "/purchase-orders", label: "Purchase Orders", icon: ClipboardList },
      { href: "/fabric", label: "Fabric Inventory", icon: Boxes },
    ],
  },
  {
    title: "Production",
    items: [
      { href: "/production", label: "Production Orders", icon: Factory },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/sales-orders", label: "Invoices", icon: ScrollText },
      { href: "/expenses", label: "Expenses", icon: Receipt },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
];

function NavLink({ href, label, icon: Icon, active }: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
        active
          ? "bg-accent/10 text-accent shadow-[inset_2px_0_0_var(--color-accent)]"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon size={16} strokeWidth={active ? 2.5 : 2} />
      {label}
    </Link>
  );
}

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-surface min-h-screen px-3 py-5 flex flex-col gap-0.5">
      <div className="flex items-center gap-2.5 px-3 pb-4 mb-2 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
          <Scissors size={15} className="text-white" strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-foreground tracking-tight leading-tight">Silaa</p>
          <p className="text-[11px] text-muted-foreground leading-tight">Garment ERP</p>
        </div>
      </div>

      {SECTIONS.map((section, si) => (
        <div key={si} className="flex flex-col gap-0.5">
          {section.title && (
            <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {section.title}
            </p>
          )}
          {section.items.map((item) => (
            <NavLink key={item.href} {...item} active={pathname === item.href} />
          ))}
        </div>
      ))}

      {role === "admin" && (
        <div className="flex flex-col gap-0.5">
          <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Admin
          </p>
          <NavLink href="/users" label="Users" icon={Users} active={pathname === "/users"} />
        </div>
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

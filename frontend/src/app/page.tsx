import Link from "next/link";
import { Boxes, Factory, Package, Shirt } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";

const CARDS = [
  { href: "/styles", title: "Styles & Variants", desc: "Manage styles, SKUs, and BOM versions", icon: Shirt },
  { href: "/fabric", title: "Fabric Inventory", desc: "Lots, balances, dye-lot tracking", icon: Boxes },
  { href: "/accessories", title: "Accessory Inventory", desc: "Buttons, zips, labels, packaging", icon: Package },
  { href: "/production", title: "Production Orders", desc: "Cutting, stitching, QC, rework", icon: Factory },
];

export default function Home() {
  return (
    <main className="max-w-5xl mx-auto px-8 py-10">
      <PageHeader title="Overview" subtitle="Fabric, Accessories, Production — Phase 1" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CARDS.map(({ href, title, desc, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="p-5 hover:border-accent transition-colors duration-150 h-full">
              <Icon size={20} className="text-accent mb-3" strokeWidth={2} />
              <p className="font-medium text-foreground">{title}</p>
              <p className="text-sm text-muted-foreground mt-1">{desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}

import Link from "next/link";

export default function Home() {
  return (
    <main className="max-w-2xl mx-auto py-16 px-4">
      <h1 className="text-2xl font-semibold mb-1">Apparel ERP — Phase 1</h1>
      <p className="text-gray-500 mb-8">Fabric, Accessories, Production</p>
      <nav className="flex flex-col gap-3">
        <Link className="rounded border px-4 py-3 hover:bg-gray-50" href="/styles">
          Styles &amp; Variants
        </Link>
        <Link className="rounded border px-4 py-3 hover:bg-gray-50" href="/fabric">
          Fabric Inventory
        </Link>
        <Link className="rounded border px-4 py-3 hover:bg-gray-50" href="/production">
          Production Orders
        </Link>
      </nav>
    </main>
  );
}

import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { decodeToken } from "@/lib/api";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Silaa ERP — Phase 1",
  description: "Fabric, Accessories, Production",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const store = await cookies();
  const token = store.get("silaa_token")?.value;
  let role = "viewer";
  if (token) {
    const decoded = decodeToken(token);
    role = decoded.role || "viewer";
  }

  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppShell role={role}>{children}</AppShell>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Fira_Code, Fira_Sans } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { decodeToken } from "@/lib/api";

const firaSans = Fira_Sans({
  variable: "--font-fira-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
    <html lang="en" className={`${firaSans.variable} ${firaCode.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppShell role={role}>{children}</AppShell>
      </body>
    </html>
  );
}

import { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-surface rounded-xl border border-border shadow-[0_1px_2px_rgba(0,0,0,0.02)] ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-semibold text-foreground tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const base =
    "inline-flex items-center gap-1.5 rounded-lg text-sm font-medium px-3.5 py-2 transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: Record<string, string> = {
    primary: "bg-primary text-on-primary hover:bg-foreground shadow-sm",
    ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
    danger: "bg-destructive text-white hover:bg-red-700 shadow-sm",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring transition-shadow duration-150 ${props.className ?? ""}`}
    />
  );
}

export function Select({
  children,
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring transition-shadow duration-150 ${className}`}
    >
      {children}
    </select>
  );
}

const PILL_STYLES: Record<string, string> = {
  active: "bg-muted text-foreground border border-border",
  open: "bg-muted text-foreground border border-border",
  PASS: "bg-success/10 text-success border border-success/20",
  SECOND_SALE: "bg-warning/10 text-warning border border-warning/20",
  REWORK: "bg-warning/10 text-warning border border-warning/20",
  SCRAP: "bg-destructive/10 text-destructive border border-destructive/20",
  HOLD: "bg-muted text-muted-foreground border border-border",
};

export function StatusPill({ value }: { value: string }) {
  const style = PILL_STYLES[value] ?? "bg-muted text-muted-foreground border border-border";
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${style}`}>
      {value}
    </span>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th className={`bg-muted/30 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground px-4 py-3 border-b border-border ${className}`}>
      {children}
    </th>
  );
}

export function Tr({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <tr className={`hover:bg-muted/50 transition-colors duration-100 ${className}`}>{children}</tr>;
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3.5 border-b border-border/50 ${className}`}>{children}</td>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted/60 ${className}`} />;
}

export function PageSkeleton() {
  return (
    <main className="max-w-5xl mx-auto px-8 py-10">
      <div className="mb-6">
        <Skeleton className="h-6 w-48 mb-1.5" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </main>
  );
}

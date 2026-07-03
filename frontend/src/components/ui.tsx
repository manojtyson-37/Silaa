import { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-surface rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow duration-200 ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-foreground tracking-tight">{title}</h1>
      {subtitle && <p className="text-base text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "outline" }) {
  const base =
    "inline-flex items-center gap-2 rounded-lg text-sm font-medium px-4 py-2 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95";
  const variants: Record<string, string> = {
    primary: "bg-accent text-white hover:bg-accent/90 shadow-sm",
    ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
    outline: "border border-border text-foreground hover:bg-muted shadow-sm",
    danger: "bg-destructive text-white hover:bg-destructive/90 shadow-sm",
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
      className={`w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-200 ${props.className ?? ""}`}
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
      className={`w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-200 ${className}`}
    >
      {children}
    </select>
  );
}

const PILL_STYLES: Record<string, string> = {
  active: "bg-accent/10 text-accent border border-accent/20",
  open: "bg-accent/10 text-accent border border-accent/20",
  PASS: "bg-success/10 text-success border border-success/20",
  SECOND_SALE: "bg-warning/10 text-warning border border-warning/20",
  REWORK: "bg-warning/10 text-warning border border-warning/20",
  SCRAP: "bg-destructive/10 text-destructive border border-destructive/20",
  HOLD: "bg-muted text-muted-foreground border border-border",
};

export function StatusPill({ value }: { value: string }) {
  const style = PILL_STYLES[value] ?? "bg-muted text-muted-foreground border border-border";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${style}`}>
      {value}
    </span>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <table className="w-full text-sm text-left">{children}</table>
    </div>
  );
}

export function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th className={`bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 border-b border-border ${className}`}>
      {children}
    </th>
  );
}

export function Tr({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <tr className={`hover:bg-muted/30 transition-colors duration-150 ${className}`}>{children}</tr>;
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3.5 border-b border-border/50 text-foreground ${className}`}>{children}</td>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
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

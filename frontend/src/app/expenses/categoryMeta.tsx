"use client";

import {
  Wallet, Receipt, Banknote, CreditCard, ShoppingBag, Truck, Package, Users,
  Scissors, Shirt, Home, Building2, Zap, Wrench, Fuel, Phone, Gift, Coffee,
  Plane, Car, Briefcase, PiggyBank, Landmark, Tag, type LucideIcon,
} from "lucide-react";

// Curated icon set for expense categories. Keys are stored in the DB (category.icon).
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  wallet: Wallet, receipt: Receipt, banknote: Banknote, "credit-card": CreditCard,
  "shopping-bag": ShoppingBag, truck: Truck, package: Package, users: Users,
  scissors: Scissors, shirt: Shirt, home: Home, building: Building2, zap: Zap,
  wrench: Wrench, fuel: Fuel, phone: Phone, gift: Gift, coffee: Coffee,
  plane: Plane, car: Car, briefcase: Briefcase, "piggy-bank": PiggyBank,
  landmark: Landmark, tag: Tag,
};

// Fixed accent palette — subtle, not saturated. `null` = no color (neutral).
export const CATEGORY_COLORS = [
  "#6366f1", "#3b82f6", "#0ea5e9", "#10b981",
  "#f59e0b", "#f43f5e", "#8b5cf6", "#64748b",
];

export const DEFAULT_ICON = "tag";

export function CategoryIcon({
  icon,
  color,
  size = 14,
}: {
  icon: string | null;
  color: string | null;
  size?: number;
}) {
  const Icon = CATEGORY_ICONS[icon ?? ""] ?? CATEGORY_ICONS[DEFAULT_ICON];
  return <Icon size={size} style={{ color: color ?? "currentColor" }} strokeWidth={2.2} />;
}

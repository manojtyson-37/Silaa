import { api, CategoryBudget, CompanySetting, Expense, ExpenseCategory, FabricItem, Supplier } from "@/lib/api";
import { PageHeader } from "@/components/ui";
import { requireAuth } from "@/lib/serverAuth";
import ExpenseClient from "./ExpenseClient";

export default async function ExpensesPage() {
  const token = await requireAuth();
  const [categories, expenses, budgets, settings, fabricItems, suppliers] = await Promise.all([
    api.get<ExpenseCategory[]>("/expense-categories", token),
    api.get<Expense[]>("/expenses", token),
    api.get<CategoryBudget[]>("/expense-category-budgets", token),
    api.get<CompanySetting[]>("/company-settings", token),
    api.get<FabricItem[]>("/fabric-items", token).catch(() => []),
    api.get<Supplier[]>("/suppliers", token).catch(() => []),
  ]);

  return (
    <main className="max-w-3xl mx-auto px-8 py-10">
      <PageHeader title="Expenses" subtitle="Salaries, commissions, inventory costs" />
      <ExpenseClient
        categories={categories}
        expenses={expenses}
        budgets={budgets}
        settings={settings}
        fabricItems={fabricItems}
        suppliers={suppliers}
      />
    </main>
  );
}

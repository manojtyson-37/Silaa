import { api, CategoryBudget, CompanySetting, Expense, ExpenseCategory } from "@/lib/api";
import { PageHeader } from "@/components/ui";
import { requireAuth } from "@/lib/serverAuth";
import ExpenseClient from "./ExpenseClient";

export default async function ExpensesPage() {
  const token = await requireAuth();
  const [categories, expenses, budgets, settings] = await Promise.all([
    api.get<ExpenseCategory[]>("/expense-categories", token),
    api.get<Expense[]>("/expenses", token),
    api.get<CategoryBudget[]>("/expense-category-budgets", token),
    api.get<CompanySetting[]>("/company-settings", token),
  ]);

  return (
    <main className="max-w-3xl mx-auto px-8 py-10">
      <PageHeader title="Expenses" subtitle="Salaries, commissions, inventory costs" />
      <ExpenseClient
        categories={categories}
        expenses={expenses}
        budgets={budgets}
        settings={settings}
      />
    </main>
  );
}

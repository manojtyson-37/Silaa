"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, Expense, ExpenseCategory } from "@/lib/api";
import { getClientToken } from "@/lib/clientAuth";
import { Button, Card, Input, Select } from "@/components/ui";

type Props = {
  categories: ExpenseCategory[];
  expenses: Expense[];
};

export default function ExpenseClient({ categories: initCats, expenses: initExp }: Props) {
  const [categories, setCategories] = useState(initCats);
  const [expenses, setExpenses] = useState(initExp);
  const [catForm, setCatForm] = useState({ name: "", color: "#6366f1" });
  const [catOpen, setCatOpen] = useState(false);
  const [expForm, setExpForm] = useState({
    category_id: "",
    amount: "",
    expense_date: new Date().toISOString().slice(0, 10),
    description: "",
    paid_to: "",
    tags: "",
  });
  const [expOpen, setExpOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addCategory = async () => {
    try {
      const cat = await api.post<ExpenseCategory>("/expense-categories", catForm, getClientToken());
      setCategories((c) => [...c, cat]);
      setCatForm({ name: "", color: "#6366f1" });
      setCatOpen(false);
    } catch (e) { setError(String(e)); }
  };

  const deleteCategory = async (id: number) => {
    await api.delete(`/expense-categories/${id}`, getClientToken());
    setCategories((c) => c.filter((x) => x.id !== id));
  };

  const addExpense = async () => {
    setError(null);
    try {
      const payload = {
        category_id: Number(expForm.category_id),
        amount: expForm.amount,
        expense_date: expForm.expense_date,
        description: expForm.description,
        paid_to: expForm.paid_to || null,
        tags: expForm.tags ? expForm.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      };
      const exp = await api.post<Expense>("/expenses", payload, getClientToken());
      setExpenses((e) => [exp, ...e]);
      setExpForm({ category_id: "", amount: "", expense_date: new Date().toISOString().slice(0, 10), description: "", paid_to: "", tags: "" });
      setExpOpen(false);
    } catch (e) { setError(String(e)); }
  };

  const deleteExpense = async (id: number) => {
    await api.delete(`/expenses/${id}`, getClientToken());
    setExpenses((e) => e.filter((x) => x.id !== id));
  };

  const catById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="flex flex-col gap-8">
      {/* Categories */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium text-foreground text-sm">Categories</h2>
          <button
            onClick={() => setCatOpen(!catOpen)}
            className="inline-flex items-center gap-1 text-xs text-accent hover:text-primary cursor-pointer"
          >
            <Plus size={12} /> Add
          </button>
        </div>
        {catOpen && (
          <Card className="p-3 mb-3 flex gap-2 items-end bg-muted/30 max-w-sm">
            <Input
              placeholder="Category name"
              value={catForm.name}
              onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
            />
            <input
              type="color"
              value={catForm.color}
              onChange={(e) => setCatForm({ ...catForm, color: e.target.value })}
              className="w-9 h-9 rounded border border-border cursor-pointer shrink-0"
              title="Pick color"
            />
            <Button onClick={addCategory} disabled={!catForm.name}>Save</Button>
          </Card>
        )}
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: c.color ?? "#6366f1" }}
            >
              {c.name}
              <button onClick={() => deleteCategory(c.id)} className="opacity-70 hover:opacity-100 cursor-pointer">
                <Trash2 size={10} />
              </button>
            </span>
          ))}
          {categories.length === 0 && <p className="text-sm text-muted-foreground">No categories yet.</p>}
        </div>
      </section>

      {/* Add expense */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium text-foreground text-sm">
            Expenses · ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </h2>
          <button
            onClick={() => setExpOpen(!expOpen)}
            className="inline-flex items-center gap-1 text-xs text-accent hover:text-primary cursor-pointer"
          >
            <Plus size={12} /> Add expense
          </button>
        </div>

        {expOpen && (
          <Card className="p-4 mb-4 bg-muted/30 flex flex-col gap-2.5 max-w-lg">
            <Select
              value={expForm.category_id}
              onChange={(e) => setExpForm({ ...expForm, category_id: e.target.value })}
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <div className="flex gap-2">
              <Input
                placeholder="Amount (₹)"
                value={expForm.amount}
                onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })}
              />
              <Input
                type="date"
                value={expForm.expense_date}
                onChange={(e) => setExpForm({ ...expForm, expense_date: e.target.value })}
              />
            </div>
            <Input
              placeholder="Description"
              value={expForm.description}
              onChange={(e) => setExpForm({ ...expForm, description: e.target.value })}
            />
            <Input
              placeholder="Paid to (optional)"
              value={expForm.paid_to}
              onChange={(e) => setExpForm({ ...expForm, paid_to: e.target.value })}
            />
            <Input
              placeholder="Tags (comma-separated, e.g. salary, june)"
              value={expForm.tags}
              onChange={(e) => setExpForm({ ...expForm, tags: e.target.value })}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button onClick={addExpense} disabled={!expForm.category_id || !expForm.amount || !expForm.description}>
                Save
              </Button>
              <Button variant="ghost" onClick={() => setExpOpen(false)}>Cancel</Button>
            </div>
          </Card>
        )}

        {/* Expense list */}
        {expenses.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground text-sm">No expenses yet.</Card>
        ) : (
          <div className="flex flex-col gap-2">
            {expenses.map((exp) => {
              const cat = catById[exp.category_id];
              return (
                <Card key={exp.id} className="p-4 flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: cat?.color ?? "#6366f1" }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-sm font-medium text-foreground">{exp.description}</p>
                      <p className="text-sm font-semibold text-foreground shrink-0">
                        ₹{Number(exp.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">{exp.expense_date}</span>
                      {cat && <span className="text-xs text-muted-foreground">· {cat.name}</span>}
                      {exp.paid_to && <span className="text-xs text-muted-foreground">· {exp.paid_to}</span>}
                      {exp.tags.map((t) => (
                        <span key={t} className="text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">{t}</span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteExpense(exp.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive cursor-pointer mt-0.5"
                  >
                    <Trash2 size={14} />
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

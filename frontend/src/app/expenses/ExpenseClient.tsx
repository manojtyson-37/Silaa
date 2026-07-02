"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { api, Expense, ExpenseCategory } from "@/lib/api";
import { getClientToken } from "@/lib/clientAuth";
import { Button, Card, Input, Select } from "@/components/ui";
import CategoryEditor, { CategoryDraft } from "./CategoryEditor";
import { CategoryIcon, DEFAULT_ICON } from "./categoryMeta";

type Props = {
  categories: ExpenseCategory[];
  expenses: Expense[];
};

export default function ExpenseClient({ categories: initCats, expenses: initExp }: Props) {
  const [categories, setCategories] = useState(initCats);
  const [expenses, setExpenses] = useState(initExp);
  const [catOpen, setCatOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
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

  const addCategory = async (draft: CategoryDraft) => {
    setError(null);
    try {
      const cat = await api.post<ExpenseCategory>("/expense-categories", draft, getClientToken());
      setCategories((c) => [...c, cat]);
      setCatOpen(false);
    } catch (e) { setError(String(e)); }
  };

  const updateCategory = async (id: number, draft: CategoryDraft) => {
    setError(null);
    try {
      const cat = await api.patch<ExpenseCategory>(`/expense-categories/${id}`, draft, getClientToken());
      setCategories((c) => c.map((x) => (x.id === id ? cat : x)));
      setEditingCatId(null);
    } catch (e) { setError(String(e)); }
  };

  const deleteCategory = async (id: number) => {
    setError(null);
    try {
      await api.delete(`/expense-categories/${id}`, getClientToken());
      setCategories((c) => c.filter((x) => x.id !== id));
    } catch (e) { setError(String(e)); }
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
    setError(null);
    try {
      await api.delete(`/expenses/${id}`, getClientToken());
      setExpenses((e) => e.filter((x) => x.id !== id));
    } catch (e) { setError(String(e)); }
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
            onClick={() => { setCatOpen((o) => !o); setEditingCatId(null); }}
            className="inline-flex items-center gap-1 text-xs text-accent hover:text-primary cursor-pointer"
          >
            <Plus size={12} /> Add
          </button>
        </div>

        {catOpen && (
          <div className="mb-3">
            <CategoryEditor
              initial={{ name: "", icon: DEFAULT_ICON, color: null }}
              onSave={addCategory}
              onCancel={() => setCatOpen(false)}
              saveLabel="Add category"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {categories.map((c) =>
            editingCatId === c.id ? (
              <CategoryEditor
                key={c.id}
                initial={{ name: c.name, icon: c.icon, color: c.color }}
                onSave={(draft) => updateCategory(c.id, draft)}
                onCancel={() => setEditingCatId(null)}
              />
            ) : (
              <span
                key={c.id}
                className="group inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground border border-border"
              >
                <CategoryIcon icon={c.icon} color={c.color} size={13} />
                {c.name}
                <button
                  onClick={() => { setEditingCatId(c.id); setCatOpen(false); }}
                  className="opacity-0 group-hover:opacity-70 hover:!opacity-100 cursor-pointer transition-opacity"
                  title="Edit"
                >
                  <Pencil size={11} />
                </button>
                <button
                  onClick={() => deleteCategory(c.id)}
                  className="opacity-0 group-hover:opacity-70 hover:!opacity-100 cursor-pointer transition-opacity"
                  title="Delete"
                >
                  <Trash2 size={11} />
                </button>
              </span>
            )
          )}
          {categories.length === 0 && !catOpen && (
            <p className="text-sm text-muted-foreground">No categories yet.</p>
          )}
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
                    <CategoryIcon icon={cat?.icon ?? null} color={cat?.color ?? null} size={16} />
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

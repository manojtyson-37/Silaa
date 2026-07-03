"use client";

import { useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, Download, Paperclip, Pencil,
  Plus, RefreshCw, Settings, Trash2, X,
} from "lucide-react";
import { api, CategoryBudget, CompanySetting, Expense, ExpenseCategory, FabricItem, Supplier, ProcurementItemCreate } from "@/lib/api";
import { getClientToken } from "@/lib/clientAuth";
import { Button, Card, Input, Select } from "@/components/ui";
import CategoryEditor, { CategoryDraft } from "./CategoryEditor";
import { CategoryIcon, DEFAULT_ICON } from "./categoryMeta";

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹", USD: "$", EUR: "€", GBP: "£", JPY: "¥",
};
const CURRENCIES = [
  { code: "INR", label: "₹ Indian Rupee" },
  { code: "USD", label: "$ US Dollar" },
  { code: "EUR", label: "€ Euro" },
  { code: "GBP", label: "£ British Pound" },
  { code: "JPY", label: "¥ Japanese Yen" },
];

type Props = {
  categories: ExpenseCategory[];
  expenses: Expense[];
  budgets: CategoryBudget[];
  settings: CompanySetting[];
  fabricItems: FabricItem[];
  suppliers: Supplier[];
};

function fmtYM(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentYM() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}

function sanitizeCSVCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function ReceiptControls({
  urls, onFile, onClear, inputRef, uploading,
}: {
  urls: string[];
  onFile: (f: File) => void;
  onClear: (index: number) => void;
  inputRef: { current: HTMLInputElement | null };
  uploading: boolean;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
      >
        <Paperclip size={11} />
        Attach receipt
      </button>
      {urls.map((url, i) => (
        <div key={i} className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-xs text-foreground">
          <span>Receipt {i + 1} ✓</span>
          <button type="button" onClick={() => onClear(i)} className="text-muted-foreground hover:text-foreground">
            <X size={11} />
          </button>
        </div>
      ))}
    </div>
  );
}

type ProcurementFormItem = {
  fabric_item_id: string;
  new_fabric_name: string;
  new_fabric_composition: string;
  new_fabric_gsm: string;
  new_fabric_width: string;
  supplier_id: string;
  new_supplier_name: string;
  fabric_qty: string;
  price: string;
};

const BLANK_FORM = () => ({
  category_id: "", amount: "",
  expense_date: new Date().toISOString().slice(0, 10),
  description: "", paid_to: "", tags: "",
  receipt_urls: [] as string[],
  is_recurring: false,
  procurement_items: [] as ProcurementFormItem[],
});

export default function ExpenseClient({
  categories: initCats,
  expenses: initExp,
  budgets: initBudgets,
  settings: initSettings,
  fabricItems,
  suppliers,
}: Props) {
  const [categories, setCategories] = useState(initCats);
  const [expenses, setExpenses] = useState(initExp);
  const [budgets, setBudgets] = useState(initBudgets);
  const [currency, setCurrency] = useState(
    () => initSettings.find(s => s.key === "currency")?.value ?? "INR"
  );
  const sym = CURRENCY_SYMBOLS[currency] ?? currency;

  const [selectedMonth, setSelectedMonth] = useState(currentYM);

  // Category UI
  const [catOpen, setCatOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<number | null>(null);

  // Budget UI
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetEdits, setBudgetEdits] = useState<Record<number, string>>({});

  // Settings UI
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Expense form
  const [expForm, setExpForm] = useState(BLANK_FORM);
  const [expOpen, setExpOpen] = useState(false);

  // Expense edit
  const [editingExpId, setEditingExpId] = useState<number | null>(null);
  const [editExpForm, setEditExpForm] = useState<ReturnType<typeof BLANK_FORM> | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const receiptRef = useRef<HTMLInputElement>(null);
  const editReceiptRef = useRef<HTMLInputElement>(null);

  // ── Derived ────────────────────────────────────────────────────────────────

  const catById = Object.fromEntries(categories.map(c => [c.id, c]));
  const budgetByCatId = Object.fromEntries(budgets.map(b => [b.category_id, b]));

  const filteredExpenses = expenses.filter(e => e.expense_date.startsWith(selectedMonth));
  const monthTotal = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0);

  const lastMonthStr = shiftMonth(selectedMonth, -1);
  const lastMonthTotal = expenses
    .filter(e => e.expense_date.startsWith(lastMonthStr))
    .reduce((s, e) => s + Number(e.amount), 0);
  const pctChange = lastMonthTotal === 0
    ? null
    : ((monthTotal - lastMonthTotal) / lastMonthTotal) * 100;

  const catSpend: Record<number, number> = {};
  filteredExpenses.forEach(e => {
    catSpend[e.category_id] = (catSpend[e.category_id] ?? 0) + Number(e.amount);
  });
  const topCatEntry = Object.entries(catSpend).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  const topCat = topCatEntry ? catById[Number(topCatEntry[0])] : null;

  // ── Category actions ───────────────────────────────────────────────────────

  const addCategory = async (draft: CategoryDraft) => {
    setError(null);
    try {
      const cat = await api.post<ExpenseCategory>("/expense-categories", draft, getClientToken());
      setCategories(c => [...c, cat]);
      setCatOpen(false);
    } catch { setError("Failed to add category."); }
  };

  const updateCategory = async (id: number, draft: CategoryDraft) => {
    setError(null);
    try {
      const cat = await api.patch<ExpenseCategory>(`/expense-categories/${id}`, draft, getClientToken());
      setCategories(c => c.map(x => x.id === id ? cat : x));
      setEditingCatId(null);
    } catch { setError("Failed to update category."); }
  };

  const deleteCategory = async (id: number) => {
    setError(null);
    try {
      await api.delete(`/expense-categories/${id}`, getClientToken());
      setCategories(c => c.filter(x => x.id !== id));
    } catch (e) {
      const msg = e instanceof Error ? e.message.split(": ").slice(1).join(": ") : "";
      if (e instanceof Error && e.message.startsWith("404")) {
        setCategories(c => c.filter(x => x.id !== id));
      } else {
        setError(msg || "Failed to delete category.");
      }
    }
  };

  // ── Budget actions ─────────────────────────────────────────────────────────

  const saveBudget = async (categoryId: number) => {
    const raw = budgetEdits[categoryId];
    if (!raw || isNaN(parseFloat(raw))) return;
    try {
      const b = await api.patch<CategoryBudget>(
        `/expense-category-budgets/${categoryId}`,
        { monthly_limit: parseFloat(raw) },
        getClientToken()
      );
      setBudgets(prev => {
        const idx = prev.findIndex(x => x.category_id === categoryId);
        return idx >= 0 ? prev.map((x, i) => i === idx ? b : x) : [...prev, b];
      });
      setBudgetEdits(prev => { const n = { ...prev }; delete n[categoryId]; return n; });
    } catch { setError("Failed to save budget."); }
  };

  const deleteBudget = async (categoryId: number) => {
    try {
      await api.delete(`/expense-category-budgets/${categoryId}`, getClientToken());
      setBudgets(prev => prev.filter(b => b.category_id !== categoryId));
    } catch { setError("Failed to delete budget."); }
  };

  // ── Settings ───────────────────────────────────────────────────────────────

  const updateCurrency = async (value: string) => {
    const prev = currency;
    setCurrency(value);
    try {
      await api.patch("/company-settings/currency", { value }, getClientToken());
    } catch {
      setCurrency(prev);
      setError("Failed to save currency setting.");
    }
  };

  // ── Receipt upload ─────────────────────────────────────────────────────────

  const uploadReceipt = async (file: File, forEdit: boolean) => {
    setUploading(true);
    try {
      const { url } = await api.upload(file, getClientToken());
      if (forEdit) setEditExpForm(f => f ? { ...f, receipt_urls: [...f.receipt_urls, url] } : f);
      else setExpForm(f => ({ ...f, receipt_urls: [...f.receipt_urls, url] }));
    } catch { setError("Failed to upload receipt."); }
    finally { setUploading(false); }
  };

  // ── Expense actions ────────────────────────────────────────────────────────

  const addExpense = async () => {
    setError(null);
    try {
      const isProcurement = catById[Number(expForm.category_id)]?.name.toLowerCase() === "procurement";
      const pItems: ProcurementItemCreate[] = isProcurement ? expForm.procurement_items.map(p => ({
        fabric_item_id: p.fabric_item_id === "new" ? null : (Number(p.fabric_item_id) || null),
        new_fabric_name: p.fabric_item_id === "new" ? p.new_fabric_name : null,
        new_fabric_composition: p.fabric_item_id === "new" ? p.new_fabric_composition || null : null,
        new_fabric_gsm: p.fabric_item_id === "new" ? (parseInt(p.new_fabric_gsm) || null) : null,
        new_fabric_width: p.fabric_item_id === "new" ? (parseFloat(p.new_fabric_width) || null) : null,
        supplier_id: p.supplier_id === "new" ? null : (Number(p.supplier_id) || null),
        new_supplier_name: p.supplier_id === "new" ? p.new_supplier_name : null,
        fabric_qty: parseFloat(p.fabric_qty) || 0,
        price: parseFloat(p.price) || 0,
      })) : [];

      const payload = {
        category_id: Number(expForm.category_id),
        amount: parseFloat(expForm.amount),
        expense_date: expForm.expense_date,
        description: expForm.description,
        paid_to: expForm.paid_to || null,
        tags: expForm.tags ? expForm.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        receipt_urls: expForm.receipt_urls,
        is_recurring: expForm.is_recurring,
        procurement_items: pItems,
      };
      const exp = await api.post<Expense>("/expenses", payload, getClientToken());
      setExpenses(e => [exp, ...e]);
      setExpForm(BLANK_FORM());
      setExpOpen(false);
    } catch { setError("Failed to add expense."); }
  };

  const deleteExpense = async (exp: Expense) => {
    if (catById[exp.category_id]?.name.toLowerCase() === "procurement") {
      if (!window.confirm("Warning: This expense includes fabric procurement. Deleting it will also permanently remove the received fabric lots from your inventory. Are you sure you want to proceed?")) {
        return;
      }
    }
    setError(null);
    try {
      await api.delete(`/expenses/${exp.id}`, getClientToken());
      setExpenses(e => e.filter(x => x.id !== exp.id));
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("409")) {
        setError("Cannot delete expense: The received fabric has already been consumed in production.");
      } else {
        setError("Failed to delete expense.");
      }
    }
  };

  const startEditExpense = (exp: Expense) => {
    setEditingExpId(exp.id);
    setEditExpForm({
      category_id: String(exp.category_id),
      amount: String(exp.amount),
      expense_date: exp.expense_date,
      description: exp.description,
      paid_to: exp.paid_to ?? "",
      tags: (exp.tags ?? []).join(", "),
      receipt_urls: exp.receipt_urls ?? [],
      is_recurring: exp.is_recurring ?? false,
      procurement_items: [],
    });
  };

  const saveEditExpense = async (id: number) => {
    if (!editExpForm) return;
    setError(null);
    try {
      const payload = {
        category_id: Number(editExpForm.category_id),
        amount: parseFloat(editExpForm.amount),
        expense_date: editExpForm.expense_date,
        description: editExpForm.description,
        paid_to: editExpForm.paid_to || null,
        tags: editExpForm.tags ? editExpForm.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        receipt_urls: editExpForm.receipt_urls,
        is_recurring: editExpForm.is_recurring,
      };
      const updated = await api.patch<Expense>(`/expenses/${id}`, payload, getClientToken());
      setExpenses(e => e.map(x => x.id === id ? updated : x));
      setEditingExpId(null);
      setEditExpForm(null);
    } catch { setError("Failed to update expense."); }
  };

  // ── CSV export ─────────────────────────────────────────────────────────────

  const exportCSV = () => {
    const header = ["Date", "Description", "Category", `Amount (${currency})`, "Paid To", "Tags", "Recurring", "Receipts"];
    const rows = filteredExpenses.map(e => [
      e.expense_date, e.description,
      catById[e.category_id]?.name ?? "",
      e.amount, e.paid_to ?? "",
      (e.tags ?? []).join("; "),
      e.is_recurring ? "Yes" : "No",
      (e.receipt_urls ?? []).join("; "),
    ]);
    const csv = [header, ...rows]
      .map(r => r.map(v => `"${sanitizeCSVCell(String(v)).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `expenses-${selectedMonth}.csv`;
    a.click();
  };

  // ── JSX ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-8">

      {/* Settings bar */}
      <div className="flex justify-end -mb-4">
        <button
          onClick={() => setSettingsOpen(o => !o)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Settings size={12} /> Settings
        </button>
      </div>
      {settingsOpen && (
        <Card className="p-4 flex flex-col gap-3 max-w-xs self-end">
          <p className="text-xs font-medium text-foreground">Display Settings</p>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground w-20 shrink-0">Currency</label>
            <Select value={currency} onChange={e => updateCurrency(e.target.value)}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </Select>
          </div>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1">This Month</p>
          <p className="text-xl font-semibold text-foreground">
            {sym}{monthTotal.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{fmtYM(selectedMonth)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Top Category</p>
          <p className="text-base font-medium text-foreground truncate">{topCat?.name ?? "—"}</p>
          {topCatEntry && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {sym}{Number(topCatEntry[1]).toLocaleString("en-IN")}
            </p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1">vs Last Month</p>
          {pctChange === null ? (
            <p className="text-xl font-semibold text-muted-foreground">—</p>
          ) : (
            <p className={`text-xl font-semibold ${pctChange > 0 ? "text-destructive" : "text-green-600"}`}>
              {pctChange > 0 ? "+" : ""}{Math.round(pctChange)}%
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">
            {sym}{lastMonthTotal.toLocaleString("en-IN")} last month
          </p>
        </Card>
      </div>

      {/* Categories */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium text-foreground text-sm">Categories</h2>
          <button
            onClick={() => { setCatOpen(o => !o); setEditingCatId(null); }}
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
          {categories.map(c =>
            editingCatId === c.id ? (
              <CategoryEditor
                key={c.id}
                initial={{ name: c.name, icon: c.icon, color: c.color }}
                onSave={draft => updateCategory(c.id, draft)}
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
                ><Pencil size={11} /></button>
                <button
                  onClick={() => deleteCategory(c.id)}
                  className="opacity-0 group-hover:opacity-70 hover:!opacity-100 cursor-pointer transition-opacity"
                  title="Delete"
                ><Trash2 size={11} /></button>
              </span>
            )
          )}
          {categories.length === 0 && !catOpen && (
            <p className="text-sm text-muted-foreground">No categories yet.</p>
          )}
        </div>
      </section>

      {/* Budget Tracking */}
      <section>
        <button
          onClick={() => setBudgetOpen(o => !o)}
          className="font-medium text-foreground text-sm flex items-center gap-1.5 hover:text-primary mb-2"
        >
          Budget Tracking
          <span className="text-muted-foreground text-xs">{budgetOpen ? "▲" : "▼"}</span>
        </button>
        {budgetOpen && (
          <div className="flex flex-col gap-3">
            {categories.length === 0 && (
              <p className="text-xs text-muted-foreground">Add categories first.</p>
            )}
            {categories.map(c => {
              const budget = budgetByCatId[c.id];
              const spent = catSpend[c.id] ?? 0;
              const limit = budget ? Number(budget.monthly_limit) : 0;
              const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
              const over = limit > 0 && spent > limit;
              const editing = c.id in budgetEdits;
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <p className="text-xs text-foreground w-24 shrink-0 truncate">{c.name}</p>
                  <div className="flex-1">
                    {editing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder={`Limit (${sym})`}
                          value={budgetEdits[c.id]}
                          onChange={e => setBudgetEdits(prev => ({ ...prev, [c.id]: e.target.value }))}
                        />
                        <Button onClick={() => saveBudget(c.id)} className="text-xs px-3">Save</Button>
                        <button
                          onClick={() => setBudgetEdits(prev => { const n = { ...prev }; delete n[c.id]; return n; })}
                          className="text-muted-foreground hover:text-foreground"
                        ><X size={12} /></button>
                      </div>
                    ) : budget ? (
                      <>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>{sym}{spent.toLocaleString("en-IN")}</span>
                          <span className={over ? "text-destructive font-medium" : ""}>
                            {sym}{limit.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${over ? "bg-destructive" : "bg-accent"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">No budget set</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!editing && (
                      <button
                        onClick={() => setBudgetEdits(prev => ({
                          ...prev,
                          [c.id]: budget ? String(budget.monthly_limit) : "",
                        }))}
                        className="text-muted-foreground hover:text-foreground"
                        title="Set budget"
                      ><Pencil size={11} /></button>
                    )}
                    {budget && !editing && (
                      <button
                        onClick={() => deleteBudget(c.id)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Remove budget"
                      ><Trash2 size={11} /></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Expenses */}
      <section>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <h2 className="font-medium text-foreground text-sm">
              Expenses · {sym}{monthTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </h2>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setSelectedMonth(m => shiftMonth(m, -1))}
                className="text-muted-foreground hover:text-foreground p-0.5"
              ><ChevronLeft size={14} /></button>
              <span className="text-xs text-muted-foreground w-28 text-center">{fmtYM(selectedMonth)}</span>
              <button
                onClick={() => setSelectedMonth(m => shiftMonth(m, 1))}
                className="text-muted-foreground hover:text-foreground p-0.5"
              ><ChevronRight size={14} /></button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              title={`Export ${fmtYM(selectedMonth)} as CSV`}
            >
              <Download size={12} /> CSV
            </button>
            <button
              onClick={() => setExpOpen(!expOpen)}
              className="inline-flex items-center gap-1 text-xs text-accent hover:text-primary cursor-pointer"
            >
              <Plus size={12} /> Add expense
            </button>
          </div>
        </div>

        {/* Add expense form */}
        {expOpen && (
          <Card className="p-4 mb-4 bg-muted/30 flex flex-col gap-2.5 max-w-lg">
            <Select
              value={expForm.category_id}
              onChange={e => setExpForm(f => ({ ...f, category_id: e.target.value }))}
            >
              <option value="">Select category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <div className="flex gap-2">
              <Input
                placeholder={`Amount (${sym})`}
                value={expForm.amount}
                onChange={e => setExpForm(f => ({ ...f, amount: e.target.value }))}
              />
              <Input
                type="date"
                value={expForm.expense_date}
                onChange={e => setExpForm(f => ({ ...f, expense_date: e.target.value }))}
              />
            </div>
            <Input
              placeholder="Description"
              value={expForm.description}
              onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))}
            />
            <Input
              placeholder="Paid to (optional)"
              value={expForm.paid_to}
              onChange={e => setExpForm(f => ({ ...f, paid_to: e.target.value }))}
            />
            <Input
              placeholder="Tags (comma-separated)"
              value={expForm.tags}
              onChange={e => setExpForm(f => ({ ...f, tags: e.target.value }))}
            />
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer text-muted-foreground">
                <input
                  type="checkbox"
                  checked={expForm.is_recurring}
                  onChange={e => setExpForm(f => ({ ...f, is_recurring: e.target.checked }))}
                />
                <RefreshCw size={11} /> Recurring monthly
              </label>
              <ReceiptControls
                urls={expForm.receipt_urls}
                onFile={f => uploadReceipt(f, false)}
                onClear={(i) => setExpForm(f => ({ ...f, receipt_urls: f.receipt_urls.filter((_, idx) => idx !== i) }))}
                inputRef={receiptRef}
                uploading={uploading}
              />
            </div>
            {catById[Number(expForm.category_id)]?.name.toLowerCase() === "procurement" && (
              <div className="mt-2 flex flex-col gap-2 border-t pt-2">
                <p className="text-xs font-medium text-foreground">Procurement Items</p>
                {expForm.procurement_items.map((item, idx) => (
                  <div key={idx} className="flex flex-col gap-2 p-2 bg-background rounded border text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-muted-foreground">Item {idx + 1}</span>
                      <button onClick={() => {
                        setExpForm(f => {
                          const newItems = f.procurement_items.filter((_, i) => i !== idx);
                          const newAmount = newItems.reduce((acc, it) => acc + (parseFloat(it.price) || 0), 0);
                          return { ...f, procurement_items: newItems, amount: String(newAmount) };
                        });
                      }} className="text-muted-foreground hover:text-destructive"><X size={12}/></button>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Select
                          value={item.fabric_item_id}
                          onChange={e => {
                            const val = e.target.value;
                            setExpForm(f => {
                              const arr = [...f.procurement_items];
                              arr[idx].fabric_item_id = val;
                              return { ...f, procurement_items: arr };
                            });
                          }}
                        >
                          <option value="">Select Fabric</option>
                          <option value="new">+ Create New Fabric</option>
                          {fabricItems.map(fi => <option key={fi.id} value={fi.id}>{fi.name}</option>)}
                        </Select>
                        {item.fabric_item_id === "new" && (
                          <div className="flex flex-col gap-2 mt-2">
                            <Input placeholder="New Fabric Name *" value={item.new_fabric_name} onChange={e => {
                              const val = e.target.value;
                              setExpForm(f => {
                                const arr = [...f.procurement_items];
                                arr[idx].new_fabric_name = val;
                                return { ...f, procurement_items: arr };
                              });
                            }} />
                            <div className="flex gap-2">
                              <Input placeholder="Composition (e.g. 100% Cotton)" value={item.new_fabric_composition} onChange={e => {
                                const val = e.target.value;
                                setExpForm(f => {
                                  const arr = [...f.procurement_items];
                                  arr[idx].new_fabric_composition = val;
                                  return { ...f, procurement_items: arr };
                                });
                              }} />
                              <Input placeholder="GSM" value={item.new_fabric_gsm} onChange={e => {
                                const val = e.target.value;
                                setExpForm(f => {
                                  const arr = [...f.procurement_items];
                                  arr[idx].new_fabric_gsm = val;
                                  return { ...f, procurement_items: arr };
                                });
                              }} />
                              <Input placeholder="Width (m)" value={item.new_fabric_width} onChange={e => {
                                const val = e.target.value;
                                setExpForm(f => {
                                  const arr = [...f.procurement_items];
                                  arr[idx].new_fabric_width = val;
                                  return { ...f, procurement_items: arr };
                                });
                              }} />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <Select
                          value={item.supplier_id}
                          onChange={e => {
                            const val = e.target.value;
                            setExpForm(f => {
                              const arr = [...f.procurement_items];
                              arr[idx].supplier_id = val;
                              return { ...f, procurement_items: arr };
                            });
                          }}
                        >
                          <option value="">Select Supplier</option>
                          <option value="new">+ Create New Supplier</option>
                          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </Select>
                        {item.supplier_id === "new" && (
                          <Input className="mt-1" placeholder="New Supplier Name" value={item.new_supplier_name} onChange={e => {
                            const val = e.target.value;
                            setExpForm(f => {
                              const arr = [...f.procurement_items];
                              arr[idx].new_supplier_name = val;
                              return { ...f, procurement_items: arr };
                            });
                          }} />
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="Quantity" value={item.fabric_qty} onChange={e => {
                        const val = e.target.value;
                        setExpForm(f => {
                          const arr = [...f.procurement_items];
                          arr[idx].fabric_qty = val;
                          return { ...f, procurement_items: arr };
                        });
                      }} />
                      <Input placeholder="Total Price" value={item.price} onChange={e => {
                        const val = e.target.value;
                        setExpForm(f => {
                          const arr = [...f.procurement_items];
                          arr[idx].price = val;
                          const newAmount = arr.reduce((acc, it) => acc + (parseFloat(it.price) || 0), 0);
                          return { ...f, procurement_items: arr, amount: String(newAmount) };
                        });
                      }} />
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setExpForm(f => ({ ...f, procurement_items: [...f.procurement_items, { fabric_item_id: "", new_fabric_name: "", new_fabric_composition: "", new_fabric_gsm: "", new_fabric_width: "", supplier_id: "", new_supplier_name: "", fabric_qty: "", price: "" }] }))}
                  className="text-xs text-accent hover:text-primary mt-1 text-left"
                >
                  + Add Item
                </button>
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button
                onClick={addExpense}
                disabled={!expForm.category_id || !expForm.amount || !expForm.description}
              >Save</Button>
              <Button variant="ghost" onClick={() => setExpOpen(false)}>Cancel</Button>
            </div>
          </Card>
        )}

        {/* Expense list */}
        {filteredExpenses.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground text-sm">
            No expenses for {fmtYM(selectedMonth)}.
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredExpenses.map(exp => {
              const cat = catById[exp.category_id];

              if (editingExpId === exp.id && editExpForm) {
                return (
                  <Card key={exp.id} className="p-4 bg-muted/30 flex flex-col gap-2.5">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-medium text-muted-foreground">Edit expense</p>
                      <button
                        onClick={() => { setEditingExpId(null); setEditExpForm(null); }}
                        className="text-muted-foreground hover:text-foreground"
                      ><X size={14} /></button>
                    </div>
                    <Select
                      value={editExpForm.category_id}
                      onChange={e => setEditExpForm(f => f ? { ...f, category_id: e.target.value } : f)}
                    >
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                    <div className="flex gap-2">
                      <Input
                        placeholder={`Amount (${sym})`}
                        value={editExpForm.amount}
                        onChange={e => setEditExpForm(f => f ? { ...f, amount: e.target.value } : f)}
                      />
                      <Input
                        type="date"
                        value={editExpForm.expense_date}
                        onChange={e => setEditExpForm(f => f ? { ...f, expense_date: e.target.value } : f)}
                      />
                    </div>
                    <Input
                      placeholder="Description"
                      value={editExpForm.description}
                      onChange={e => setEditExpForm(f => f ? { ...f, description: e.target.value } : f)}
                    />
                    <Input
                      placeholder="Paid to (optional)"
                      value={editExpForm.paid_to}
                      onChange={e => setEditExpForm(f => f ? { ...f, paid_to: e.target.value } : f)}
                    />
                    <Input
                      placeholder="Tags (comma-separated)"
                      value={editExpForm.tags}
                      onChange={e => setEditExpForm(f => f ? { ...f, tags: e.target.value } : f)}
                    />
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={editExpForm.is_recurring}
                          onChange={e => setEditExpForm(f => f ? { ...f, is_recurring: e.target.checked } : f)}
                        />
                        <RefreshCw size={11} /> Recurring monthly
                      </label>
                      <ReceiptControls
                        urls={editExpForm.receipt_urls}
                        onFile={f => uploadReceipt(f, true)}
                        onClear={(i) => setEditExpForm(f => f ? { ...f, receipt_urls: f.receipt_urls.filter((_, idx) => idx !== i) } : f)}
                        inputRef={editReceiptRef}
                        uploading={uploading}
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        onClick={() => saveEditExpense(exp.id)}
                        disabled={!editExpForm.category_id || !editExpForm.amount || !editExpForm.description}
                      >Save</Button>
                      <Button variant="ghost" onClick={() => { setEditingExpId(null); setEditExpForm(null); }}>Cancel</Button>
                    </div>
                  </Card>
                );
              }

              return (
                <Card key={exp.id} className="p-4 flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    <CategoryIcon icon={cat?.icon ?? null} color={cat?.color ?? null} size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{exp.description}</p>
                        {exp.is_recurring && (
                          <span title="Recurring monthly"><RefreshCw size={11} className="text-muted-foreground shrink-0" /></span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-foreground shrink-0">
                        {sym}{Number(exp.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">{exp.expense_date}</span>
                      {cat && <span className="text-xs text-muted-foreground">· {cat.name}</span>}
                      {exp.paid_to && <span className="text-xs text-muted-foreground">· {exp.paid_to}</span>}
                      {(exp.receipt_urls || []).map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-accent hover:text-primary flex items-center gap-0.5"
                        >
                          <Paperclip size={10} /> Receipt {i + 1}
                        </a>
                      ))}
                      {(exp.tags ?? []).map(t => (
                        <span key={t} className="text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1 mt-0.5">
                    <button
                      onClick={() => startEditExpense(exp)}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                    ><Pencil size={14} /></button>
                    <button
                      onClick={() => deleteExpense(exp)}
                      className="text-muted-foreground hover:text-destructive cursor-pointer"
                    ><Trash2 size={14} /></button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {error && <p className="text-sm text-destructive mt-2">{error}</p>}
      </section>
    </div>
  );
}

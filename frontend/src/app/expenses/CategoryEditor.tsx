"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button, Card, Input } from "@/components/ui";
import { CATEGORY_ICONS, CATEGORY_COLORS, CategoryIcon } from "./categoryMeta";

export type CategoryDraft = { name: string; icon: string | null; color: string | null };

export default function CategoryEditor({
  initial,
  onSave,
  onCancel,
  saveLabel = "Save",
}: {
  initial: CategoryDraft;
  onSave: (draft: CategoryDraft) => void | Promise<void>;
  onCancel: () => void;
  saveLabel?: string;
}) {
  const [name, setName] = useState(initial.name);
  const [icon, setIcon] = useState<string | null>(initial.icon);
  const [color, setColor] = useState<string | null>(initial.color);

  return (
    <Card className="p-4 bg-muted/30 flex flex-col gap-3 max-w-md">
      <Input placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5">Icon</p>
        <div className="grid grid-cols-8 gap-1">
          {Object.keys(CATEGORY_ICONS).map((key) => {
            const active = icon === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setIcon(key)}
                className={`flex items-center justify-center h-8 w-8 rounded-md border cursor-pointer transition-colors ${
                  active ? "border-primary bg-primary/10 text-primary" : "border-border text-secondary hover:bg-muted"
                }`}
                title={key}
              >
                <CategoryIcon icon={key} color={active ? color : null} size={15} />
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5">Color (optional)</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setColor(null)}
            className={`h-6 w-6 rounded-full border flex items-center justify-center cursor-pointer ${
              color === null ? "border-primary ring-2 ring-primary/30" : "border-border"
            }`}
            title="No color"
          >
            <X size={11} className="text-muted-foreground" />
          </button>
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`h-6 w-6 rounded-full cursor-pointer flex items-center justify-center ${
                color === c ? "ring-2 ring-offset-1 ring-primary" : ""
              }`}
              title={c}
            >
              {color === c && <Check size={12} className="text-white" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button onClick={() => onSave({ name: name.trim(), icon, color })} disabled={!name.trim()}>
          {saveLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  );
}

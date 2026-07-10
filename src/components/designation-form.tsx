"use client";

import { useState, useTransition } from "react";

type Category = {
  slug: string;
  name: string;
  icon: string | null;
};

type Props = {
  sessionId: string;
  categories: Category[];
  existing: Record<string, "core" | "flexible">;
  onSave: (
    sessionId: string,
    designations: Record<string, "core" | "flexible">,
  ) => Promise<{ error: string } | void>;
};

export function DesignationForm({
  sessionId,
  categories,
  existing,
  onSave,
}: Props) {
  const [choices, setChoices] = useState<Record<string, "core" | "flexible">>(
    existing,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allSelected = categories.every((c) => choices[c.slug]);
  const remaining = categories.filter((c) => !choices[c.slug]).length;

  function select(slug: string, value: "core" | "flexible") {
    setChoices((prev) => ({ ...prev, [slug]: value }));
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await onSave(sessionId, choices);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div>
      <ul className="mt-8 space-y-3">
        {categories.map((cat) => {
          const chosen = choices[cat.slug];
          return (
            <li
              key={cat.slug}
              className="flex items-center justify-between rounded-xl border border-ink/10 bg-white px-5 py-4"
            >
              <span className="font-medium text-ink">{cat.name}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => select(cat.slug, "core")}
                  className={[
                    "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                    chosen === "core"
                      ? "bg-ink text-white"
                      : "border border-ink/20 text-ink-soft hover:border-ink/40",
                  ].join(" ")}
                  aria-pressed={chosen === "core"}
                >
                  Core
                </button>
                <button
                  type="button"
                  onClick={() => select(cat.slug, "flexible")}
                  className={[
                    "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                    chosen === "flexible"
                      ? "bg-candle/80 text-white"
                      : "border border-ink/20 text-ink-soft hover:border-ink/40",
                  ].join(" ")}
                  aria-pressed={chosen === "flexible"}
                >
                  Flexible
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="mt-6 text-sm text-red-600">{error}</p>
      )}

      <div className="mt-8">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allSelected || isPending}
          className="w-full rounded-xl bg-ink px-6 py-3 font-medium text-white transition-opacity disabled:opacity-40"
        >
          {isPending
            ? "Saving…"
            : allSelected
              ? "Save & start answering"
              : `${remaining} categor${remaining === 1 ? "y" : "ies"} left`}
        </button>
      </div>
    </div>
  );
}

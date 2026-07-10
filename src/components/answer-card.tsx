"use client";

import { useEffect, useRef, useState, useTransition } from "react";

type Choice = "fully_on_board" | "open_to_discussing" | "dealbreaker";

type ExistingAnswer = {
  choice: Choice;
  compromiseText: string | null;
};

type SaveFn = (
  sessionId: string,
  questionId: string | null,
  customQuestionId: string | null,
  choice: Choice,
  compromiseText: string | null,
) => Promise<{ error: string } | { ok: true }>;

type Props = {
  sessionId: string;
  questionId: string | null;
  customQuestionId: string | null;
  questionText: string;
  existing: ExistingAnswer | null;
  disabled: boolean;
  onSave: SaveFn;
};

const OPTIONS: { value: Choice; label: string; emoji: string }[] = [
  { value: "fully_on_board", label: "I'm fully on board", emoji: "✅" },
  {
    value: "open_to_discussing",
    label: "I'm open to discussing this",
    emoji: "🤝",
  },
  { value: "dealbreaker", label: "This is a dealbreaker for me", emoji: "🚫" },
];

export function AnswerCard({
  sessionId,
  questionId,
  customQuestionId,
  questionText,
  existing,
  disabled,
  onSave,
}: Props) {
  const [choice, setChoice] = useState<Choice | null>(existing?.choice ?? null);
  const [compromise, setCompromise] = useState(
    existing?.compromiseText ?? "",
  );
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  function showSaved() {
    setSaveStatus("saved");
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 1500);
  }

  function doSave(
    newChoice: Choice,
    newCompromise: string | null,
  ) {
    setSaveStatus("saving");
    setErrorMsg(null);
    startTransition(async () => {
      const result = await onSave(
        sessionId,
        questionId,
        customQuestionId,
        newChoice,
        newCompromise,
      );
      if ("error" in result) {
        setSaveStatus("error");
        setErrorMsg(result.error);
      } else {
        showSaved();
      }
    });
  }

  function handleChoiceClick(value: Choice) {
    if (disabled) return;
    const prev = choice;
    setChoice(value);

    if (value === "open_to_discussing") {
      // Don't save yet — compromise text is required but not yet entered.
      // If there's already existing compromise text (pre-populated), save immediately.
      if (compromise.trim()) {
        doSave(value, compromise.trim());
      }
      return;
    }

    // Switching away from open_to_discussing: cancel any pending debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Explicitly null out compromiseText so the DB constraint is satisfied
    // (it rejects open_to_discussing iff compromiseText IS NULL, so switching
    // away with a stale non-null value would fail)
    const wasOpen = prev === "open_to_discussing";
    doSave(value, wasOpen ? null : null);
  }

  function handleCompromiseChange(text: string) {
    setCompromise(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) return;
    debounceRef.current = setTimeout(() => {
      doSave("open_to_discussing", text.trim());
    }, 600);
  }

  function handleCompromiseBlur() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (choice === "open_to_discussing" && compromise.trim()) {
      doSave("open_to_discussing", compromise.trim());
    }
  }

  const isOpen = choice === "open_to_discussing";

  return (
    <div className="rounded-2xl border border-ink/10 bg-white px-6 py-5">
      <p className="text-base leading-relaxed text-ink">{questionText}</p>

      {/* Answer options */}
      <div className="mt-4 flex flex-col gap-2">
        {OPTIONS.map((opt) => {
          const isSelected = choice === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleChoiceClick(opt.value)}
              disabled={disabled}
              aria-pressed={isSelected}
              className={[
                "flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed",
                isSelected
                  ? "bg-ink text-white"
                  : "border border-ink/15 text-ink hover:border-ink/30",
              ].join(" ")}
            >
              <span aria-hidden="true">{opt.emoji}</span>
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      {/* Compromise text — only visible when open_to_discussing is chosen */}
      {isOpen && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-ink">
            What would a compromise look like for you?{" "}
            <span className="font-normal text-ink-soft">(required)</span>
          </label>
          <textarea
            value={compromise}
            onChange={(e) => handleCompromiseChange(e.target.value)}
            onBlur={handleCompromiseBlur}
            disabled={disabled}
            rows={3}
            placeholder="If you're open to discussing this, describe what a workable middle ground might look like…"
            className="mt-2 w-full resize-none rounded-xl border border-ink/20 px-4 py-3 text-sm text-ink placeholder:text-ink-soft/50 outline-none focus:border-ink/40 disabled:bg-ink/5"
          />
        </div>
      )}

      {/* Save status */}
      {!disabled && (
        <div className="mt-3 min-h-[1.25rem] text-right text-xs">
          {saveStatus === "saving" && (
            <span className="text-ink-soft">Saving…</span>
          )}
          {saveStatus === "saved" && (
            <span className="text-green-600">Saved ✓</span>
          )}
          {saveStatus === "error" && errorMsg && (
            <span className="text-red-600">{errorMsg}</span>
          )}
        </div>
      )}
    </div>
  );
}

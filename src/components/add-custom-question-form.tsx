"use client";

import { useRef, useState, useTransition } from "react";

type AddFn = (
  sessionId: string,
  text: string,
  categorySlug: string | null,
) => Promise<{ error: string } | { ok: true }>;

type Props = {
  sessionId: string;
  onAdd: AddFn;
};

export function AddCustomQuestionForm({ sessionId, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleOpen() {
    setOpen(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await onAdd(sessionId, text, null);
      if ("error" in result) {
        setError(result.error);
      } else {
        setText("");
        setOpen(false);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-ink/25 px-5 py-3 text-sm text-ink-soft transition-colors hover:border-ink/40 hover:text-ink"
      >
        <span aria-hidden="true">+</span> Add your own question
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-ink/15 bg-white p-5">
      <p className="text-sm font-medium text-ink">
        What do you want to ask your partner?
      </p>
      <p className="mt-1 text-xs text-ink-soft">
        State it as something they can be fully on board with, open to
        discussing, or name as a dealbreaker.
      </p>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={400}
        placeholder="We will live within 30 minutes of my family after we marry."
        className="mt-3 w-full resize-none rounded-xl border border-ink/20 px-4 py-3 text-sm text-ink placeholder:text-ink-soft/50 outline-none focus:border-ink/40"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-soft">{text.length}/400</span>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!text.trim() || isPending}
          className="rounded-xl bg-ink px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {isPending ? "Adding…" : "Add question"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setText(""); setError(null); }}
          className="rounded-xl border border-ink/20 px-5 py-2 text-sm text-ink-soft"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";

type SubmitFn = (
  sessionId: string,
) => Promise<{ error: string } | void>;

type Props = {
  sessionId: string;
  remaining: number;
  onSubmit: SubmitFn;
};

export function SubmitAnswersButton({ sessionId, remaining, onSubmit }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const ready = remaining === 0;

  function handleClick() {
    if (!ready) return;
    setError(null);
    startTransition(async () => {
      const result = await onSubmit(sessionId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="mt-10">
      {error && (
        <p className="mb-3 text-sm text-red-600">{error}</p>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={!ready || isPending}
        className="w-full rounded-xl bg-ink px-6 py-4 text-base font-medium text-white transition-opacity disabled:opacity-40"
      >
        {isPending
          ? "Submitting…"
          : ready
            ? "Submit my answers"
            : `${remaining} question${remaining === 1 ? "" : "s"} remaining`}
      </button>
      {ready && (
        <p className="mt-3 text-center text-sm text-ink-soft">
          Once you submit, your answers are locked. The report unlocks when
          your partner submits too.
        </p>
      )}
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";
import { createSession } from "./actions";
import type { CreateSessionState } from "./actions";

type Context = {
  slug: string;
  name: string;
  description: string | null;
};

type Props = {
  contexts: Context[];
};

const STAGES = [
  {
    value: "early_dating",
    label: "Early dating",
    subtitle: "Is this person worth pursuing seriously?",
  },
  {
    value: "dating",
    label: "Dating",
    subtitle: "Moving towards engagement with clarity.",
  },
  {
    value: "engaged",
    label: "Engaged",
    subtitle: "Honest premarital work before the wedding.",
  },
  {
    value: "married",
    label: "Married",
    subtitle: "Re-alignment — every few years.",
  },
] as const;

export default function SessionWizard({ contexts }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [stage, setStage] = useState("");
  const [contextSlug, setContextSlug] = useState("");
  const [result, formAction, isPending] = useActionState<
    CreateSessionState,
    FormData
  >(createSession, null);

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="mb-8 text-sm uppercase tracking-[0.2em] text-candle">
        Step {step} of 3
      </p>

      {step === 1 && (
        <div>
          <h1
            className="text-3xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Where are you in your relationship?
          </h1>
          <p className="mt-3 text-ink-soft">
            This shapes which questions you'll both answer.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {STAGES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => {
                  setStage(s.value);
                  setStep(2);
                }}
                className="rounded-xl border border-ink/20 p-5 text-left transition hover:border-candle hover:bg-candle/5"
              >
                <p className="font-semibold text-ink">{s.label}</p>
                <p className="mt-1 text-sm text-ink-soft">{s.subtitle}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h1
            className="text-3xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Your cultural background
          </h1>
          <p className="mt-3 text-ink-soft">
            Questions are shaped by cultural context.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {contexts.map((ctx) => (
              <button
                key={ctx.slug}
                type="button"
                onClick={() => {
                  setContextSlug(ctx.slug);
                  setStep(3);
                }}
                className="rounded-xl border border-ink/20 p-5 text-left transition hover:border-candle hover:bg-candle/5"
              >
                <p className="font-semibold text-ink">{ctx.name}</p>
                {ctx.description && (
                  <p className="mt-1 text-sm text-ink-soft">
                    {ctx.description}
                  </p>
                )}
              </button>
            ))}
          </div>
          {contexts.length <= 1 && (
            <p className="mt-4 text-xs text-ink-soft/60">
              Yoruba, Igbo, Hausa, and more contexts are coming soon.
            </p>
          )}
          <button
            type="button"
            onClick={() => setStep(1)}
            className="mt-8 text-sm text-ink-soft underline underline-offset-2"
          >
            ← Back
          </button>
        </div>
      )}

      {step === 3 && (
        <div>
          <h1
            className="text-3xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Invite your partner
          </h1>
          <p className="mt-3 text-ink-soft">
            They'll receive an email with a link to join your session. Questions
            unlock once they accept.
          </p>
          <form action={formAction} className="mt-8 flex flex-col gap-3">
            <input type="hidden" name="stage" value={stage} />
            <input type="hidden" name="contextSlug" value={contextSlug} />
            <label className="text-sm font-medium" htmlFor="partnerEmail">
              Your partner's email
            </label>
            <input
              id="partnerEmail"
              name="partnerEmail"
              type="email"
              required
              autoComplete="email"
              placeholder="Their email address"
              className="rounded-lg border border-ink/20 bg-white px-4 py-3 outline-none focus:border-candle-deep focus:ring-2 focus:ring-candle/40"
            />
            {result?.error && (
              <p className="text-sm text-rose">{result.error}</p>
            )}
            <button
              type="submit"
              disabled={isPending}
              className="mt-2 rounded-full bg-ink px-6 py-3 font-medium text-linen transition hover:bg-ink-soft disabled:opacity-50"
            >
              {isPending ? "Sending…" : "Send invitation"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="mt-6 text-sm text-ink-soft underline underline-offset-2"
          >
            ← Back
          </button>
        </div>
      )}
    </div>
  );
}

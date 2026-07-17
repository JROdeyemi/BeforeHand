import { setDisplayName } from "./actions";

export default async function OnboardingNamePage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  const { returnTo, error } = await searchParams;

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <p className="text-sm uppercase tracking-[0.2em] text-candle">
        Welcome
      </p>
      <h1
        className="mt-2 text-3xl"
        style={{ fontFamily: "var(--font-display)" }}
      >
        What should we call you?
      </h1>
      <p className="mt-3 text-ink-soft">
        This is how your partner will see you on the report.
      </p>

      {error && (
        <p className="mt-4 text-sm text-red-600">
          Please enter a name (100 characters max).
        </p>
      )}

      <form action={setDisplayName} className="mt-8 space-y-4">
        <input type="hidden" name="returnTo" value={returnTo ?? "/sessions"} />
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-ink">
            Your name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoFocus
            maxLength={100}
            placeholder="e.g. Adaeze"
            className="mt-2 w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink-soft/50 outline-none focus:border-ink/40"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-xl bg-ink px-6 py-3 font-medium text-white transition hover:bg-ink/90"
        >
          Continue
        </button>
      </form>
    </main>
  );
}

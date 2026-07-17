import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { updateDisplayName } from "./actions";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/profile");
  }

  const { saved, error } = await searchParams;

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1
        className="text-3xl"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Your profile
      </h1>
      <p className="mt-3 text-ink-soft">
        Update the name your partner sees on the report.
      </p>

      {saved && (
        <p className="mt-4 text-sm text-green-600">Name updated.</p>
      )}
      {error && (
        <p className="mt-4 text-sm text-red-600">
          Please enter a name (100 characters max).
        </p>
      )}

      <form action={updateDisplayName} className="mt-8 space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-ink">
            Display name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={100}
            defaultValue={session.user.name ?? ""}
            className="mt-2 w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink-soft/50 outline-none focus:border-ink/40"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-ink px-6 py-3 font-medium text-white transition hover:bg-ink/90"
        >
          Save
        </button>
      </form>
    </main>
  );
}

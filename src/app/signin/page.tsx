import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  async function sendLink(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    if (!email) return;
    await signIn("resend", { email, redirect: false });
    redirect("/signin/check-email");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1
        className="text-3xl"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Sign in to Beforehand
      </h1>
      <p className="mt-3 text-sm text-ink-soft">
        No passwords. Enter your email and we&rsquo;ll send you a sign-in
        link.
      </p>
      <form action={sendLink} className="mt-8 flex flex-col gap-3">
        <label className="text-sm font-medium" htmlFor="email">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="rounded-lg border border-ink/20 bg-white px-4 py-3 outline-none focus:border-candle-deep focus:ring-2 focus:ring-candle/40"
        />
        <button
          type="submit"
          className="mt-2 rounded-full bg-ink px-6 py-3 font-medium text-linen transition hover:bg-ink-soft"
        >
          Send sign-in link
        </button>
      </form>
    </main>
  );
}

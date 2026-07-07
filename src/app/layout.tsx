import type { Metadata } from "next";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beforehand — Before I ask for your hand... let's talk.",
  description:
    "The honest conversations couples need — private, unpressured, and surfaced together. A mirror, not a verdict.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  async function doSignOut(_formData: FormData) {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <html lang="en">
      <body className="bg-linen text-ink antialiased">
        <header className="border-b border-ink/10">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link
              href="/"
              className="text-sm font-medium uppercase tracking-[0.2em]"
            >
              Beforehand
            </Link>
            <nav className="flex items-center gap-4">
              {session?.user ? (
                <>
                  <span className="hidden text-sm text-ink-soft sm:block">
                    {session.user.email}
                  </span>
                  <form action={doSignOut}>
                    <button
                      type="submit"
                      className="text-sm text-ink-soft transition hover:text-ink"
                    >
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <Link
                  href="/signin"
                  className="text-sm text-ink-soft transition hover:text-ink"
                >
                  Sign in
                </Link>
              )}
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}

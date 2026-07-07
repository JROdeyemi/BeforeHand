export default function CheckEmailPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
      <h1
        className="text-3xl"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Check your email
      </h1>
      <p className="mt-4 text-ink-soft">
        We&rsquo;ve sent you a sign-in link. Open it on this device to
        continue.
      </p>
    </main>
  );
}

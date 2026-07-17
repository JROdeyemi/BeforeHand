import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Asserts the visitor is authenticated and has set a display name.
 * If not signed in → /signin. If signed in but name is null → /onboarding/name.
 *
 * Uses database sessions (DrizzleAdapter), which join the user row on every
 * auth() call — so session.user.name is always the current DB value and no
 * session token refresh is needed after updating users.name.
 */
export async function requireNamedUser(returnTo: string) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(returnTo)}`);
  }
  if (!session.user.name) {
    redirect(
      `/onboarding/name?returnTo=${encodeURIComponent(returnTo)}`,
    );
  }
  return { session: session! };
}

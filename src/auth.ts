import NextAuth from "next-auth";
import type { DefaultSession } from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import {
  accounts,
  authSessions,
  users,
  verificationTokens,
} from "@/db/schema";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

/**
 * Magic-link auth (no passwords). The invitation-accept flow reuses this:
 * the invitee signs in via the same email channel the invitation arrived
 * on, so accepting an invite and creating an account are one motion.
 * Google OAuth can be appended to `providers` later without migration.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: authSessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.EMAIL_FROM,
    }),
  ],
  pages: {
    signIn: "/signin",
    verifyRequest: "/signin/check-email",
  },
});

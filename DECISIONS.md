# Beforehand — Decision Log

Settled decisions. Future sessions: do not re-litigate; append new entries with dates.

| Date | Decision | Resolution |
|---|---|---|
| 2026-07 | Stack | Next.js (App Router, TS) + Tailwind v4 |
| 2026-07 | ORM | Drizzle (not Prisma): no binary engines, offline SQL migrations, lighter on serverless |
| 2026-07 | DB / hosting | Neon Postgres + Vercel |
| 2026-07 | Auth | Magic links via Auth.js + Resend; Google OAuth later. No passwords. |
| 2026-07 | Invitations & nudges (MVP) | Email only; SMS deferred |
| 2026-07 | Question bank | Claude drafts, Joshua reviews per category; upsert-by-id seed, deactivate-never-delete |
| 2026-07 | Phase 2: session creation status | Session inserts directly as `invited`; wizard always creates + invites atomically. `draft` reserved for future mid-wizard autosave. |
| 2026-07 | Phase 2: email failure handling | On send failure, redirect to `/sessions/[id]?emailFailed=1`; session already committed. Session page shows manual-share banner. Re-submit guard: duplicate check on (creator, partner email, pending invitation) before insert. |
| 2026-07 | Phase 2: resend SDK | `resend` added as direct dependency for custom transactional email; Auth.js uses its own internal copy and doesn't expose it. |
| 2026-07 | Phase 2: dotenv | `dotenv` added as dev dependency; loaded via `import "dotenv/config"` in drizzle.config.ts and scripts/seed.ts (run outside Next.js). |
| 2026-07 | Phase 2: cultural contexts from DB | Always read from DB; adding Yoruba, Igbo, Hausa is a YAML seed + re-run, not a code change. |
| 2026-07 | Phase 2: one invitation per session | Phase 2 creates exactly one invitation; no re-invite or change-partner flow. |
| 2026-07 | Phase 2: inviter name fallback | Invitation email and accept page fall back to inviter's email when `users.name` is null. |
| 2026-07 | Phase 4: submission gate | Submission requires 100% of applicable questions answered (bank questions matching stage+context, plus all custom questions in the session); a question deactivated mid-session drops out of the required set for partners who haven't answered it. |
| 2026-07 | Phase 4: placeholder report on mutual submit | Phase 4 inserts `payload = {}` when both partners submit, so the report gate works without a null check. Phase 6 must regenerate any report row whose payload is `{}` before surfacing the report UI. No real couple will complete a session before Phase 6 ships, but the backfill query must be written as part of Phase 6 to be safe. |

## Open (see beforehand-app skill, tech-stack.md)
- #7 Cultural context launch list — **Universal-only at Phase 2 launch**; Yoruba, Igbo, Hausa deferred (seed + code-change-free to add)
- #9 Monetization
- #10 Branding assets
- #11 Data deletion policy

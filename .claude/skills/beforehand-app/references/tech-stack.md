# Beforehand — Tech Stack & Open Decisions

## ✅ Resolved decisions (with Joshua, July 2026)

Do not re-litigate these; if a change is genuinely needed, raise it with Joshua explicitly.

| # | Decision | Resolution |
|---|---|---|
| 1 | **Stack** | Next.js (App Router, TypeScript) + Tailwind v4; Postgres via **Drizzle ORM** (chosen over Prisma: no binary engine downloads, offline SQL migration generation, lighter serverless cold starts). Single codebase so privacy invariants are enforced in one server-side data layer (`src/db/guards.ts`); analysis engine is a pure unit-tested TS function. |
| 2 | **Hosting & DB** | Vercel + Neon Postgres (free tiers for beta). |
| 3 | **Auth** | Magic links via email (Auth.js + Resend) as primary; Google OAuth as convenience. Invitation-accept link doubles as sign-in — minimal invitee friction. No passwords. |
| 4 | **Invitation channel (MVP)** | Email only. SMS deferred until delivery data justifies it. |
| 5 | **Nudge channel (MVP)** | Email only, same rationale. |
| 6 | **Question bank source** | Claude drafts; Joshua reviews and signs off category-by-category. Bank must support add/remove/replace: upsert by stable id, deactivate (never delete) ids with answers, replacement = deactivate + new id. |

## ⚠️ Still open — resolve with Joshua before the affected phase

| # | Decision | Options discussed / notes | Blocks |
|---|---|---|---|
| 7 | **Cultural context launch list** | e.g., Universal + Yoruba + Igbo + Hausa? Broader? | Phase 2 (session wizard) & 3 (questions) |
| 8 | **Skipping questions** | May a partner submit with unanswered questions, or is 100% required? (Affects progress %, analysis coverage) | Phase 4 |
| 9 | **Monetization in MVP** | Free beta vs. paid session/report from day one | Phase 1 (schema), later (billing) |
| 10 | **Branding** | Existing logo/colors/fonts, or design from scratch around the tagline | Phase 2+ |
| 11 | **Data deletion policy** | Account deletion semantics when data is shared between two people (what happens to the couple's report if one partner deletes?) | Phase 1 (schema), pre-launch (policy) |

## Stack-agnostic engineering requirements

Whatever the stack, these hold:

- **Server-side enforcement of the privacy invariant.** Cross-partner answer reads must be blocked at the data-access layer (Postgres RLS, repository guards, or policy middleware) — not by the client simply not asking. Write an integration test that attempts to read the partner's answers pre-unlock through every read path and asserts denial.
- **Transactional report generation.** Second submission → report generation → `report_ready` transition must be atomic/idempotent (a retryable job keyed on session id is fine).
- **Unguessable, single-use invitation tokens**, expiring never (sessions don't expire) but invalidated once accepted.
- **Migrations from day one.** The schema in `domain-model.md` will evolve; never mutate schema by hand.
- **Seed pipeline for questions** that upserts by stable question id and never deletes ids with answers.
- **Structured logging that never logs answer content or compromise text.** Treat answers like credentials in logging policy.
- **Timezone-safe timestamps (UTC in storage)** — couples may be in different countries.
- **Email deliverability** via a transactional provider (Resend/Postmark/SES); invitation email is the product's front door.

## Repo conventions

- Monorepo unless Joshua says otherwise; app code, seed data, and this skill's spec assumptions should live together so drift is visible in diffs.
- Tests required for: analysis classifier (full matrix), privacy guards, session state machine transitions, seed upsert idempotency.
- Keep a `DECISIONS.md` in the repo logging resolutions to the open questions above with dates — future sessions (and future models) should not re-litigate settled decisions.

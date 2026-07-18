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

| 2026-07 | Phase 7: name gate | requireNamedUser() helper in server components (not middleware); Auth.js DrizzleAdapter joins the user row on every auth() call so session.user.name is always current — no unstable_update needed. |
| 2026-07 | Phase 7: partner_view | Optional field on question (seed YAML + DB column); {name}/{their}/{them} placeholders resolved at report render time; stored as partner_view_template in payload entries. |
| 2026-07 | Phase 7: spotlight privacy | Spotlight rows follow the same guard rules as answers (readable only by their author before report_ready); cross-partner reads happen only inside computeReportPayload which requires report_ready status. spotlights field is optional in ReportPayload for backward compat with existing payloads. |
| 2026-07 | Phase 7: spotlight indexes | Partial unique indexes (WHERE question_id IS NOT NULL / WHERE custom_question_id IS NOT NULL), matching the answer table's answer_bank_unique / answer_custom_unique pattern. |

| 2026-07-17 | Phase 8: nudge rate limit | 1 nudge per sender per session per 24h, enforced server-side by querying `max(sent_at)` from nudges table. Friendly error includes hours remaining. Keeps nudges "sweet, not naggy" per ux-principles.md. |
| 2026-07-17 | Phase 8: nudge presets | 4 presets in `src/lib/nudge-presets.ts`. `message` column stores preset key (e.g. `your_move`) or raw custom text ≤200 chars. Server action resolves key → display text before sending email, keeping resolution logic in one place. |
| 2026-07-17 | Phase 8: custom nudge moderation | Custom nudge text is unmoderated by design — product trusts its audience; 24h rate limit reduces abuse surface. Norm-setting mitigation: textarea shows caption "A nudge is encouragement — save the real conversation for after the report." |

| 2026-07-18 | Phase 9: counselor share flow | Two-step mutual consent: requester inserts `shareConsents` + own `shareConsentApprovals` row; partner approves (inserts second approval) or declines (deletes row + cascades). Share executes only when both approvals exist AND `shared_at IS NULL`, checked inside a row-lock on `shareConsents` (same pattern as submitAnswers). State-based execution makes re-approval retry a previously failed send. Counselor email failure resets `sharedAt=NULL` so the approver can retry. Partner notification emails are non-fatal. One-sided request reveals nothing to the counselor. |
| 2026-07-18 | Phase 9: single-active-request rule | Only one un-shared (`sharedAt IS NULL`) request per session at a time. New request creation is blocked if one exists, checked inside the locked transaction to prevent races. Completed shares (`sharedAt NOT NULL`) are never deletable via decline/cancel — those paths use `DELETE WHERE shared_at IS NULL` and return a user-friendly error if the row count is zero. |
| 2026-07-18 | Phase 9: counselor email rendering | Counselor email uses neutral `question_text` throughout — never `partner_view_template`. The partner_view form addresses the other partner personally; a counselor reading the report is the wrong audience. Both partners are labelled by first name in the counselor email. All user-derived values (names, compromise text) are HTML-escaped. |

| 2026-07-19 | Punch-list-2: question bank mutability rule | Pre-launch, questions may be reworded in-place (id preserved) because the database resets before launch. Post-launch, any change to question meaning must retire the old id (set `active: false`) and introduce a new id — preserving past reports' ability to render their stored `question_text`. |
| 2026-07-18 | Punch-list-1: partner_view gating | `partner_view_template` is authored for the scenario where the partner endorsed the proposition (fully_on_board). Rendering it when the partner chose open_to_discussing or dealbreaker produces a false statement (e.g. "To Josh, living apart is acceptable" directly above "Josh said: This is a dealbreaker"). Rule: render the "How [Name] sees it" line ONLY when `partnerEntry(entry).choice === "fully_on_board"`. For all other choices, fall through to neutral question + choice + compromise_text as before Phase 7. Applies everywhere partner_view_template is rendered (FlagCard, TensionCard; SpotlightCard has no partner_view field). |

## Open (see beforehand-app skill, tech-stack.md)
- #7 Cultural context launch list — **Universal-only at Phase 2 launch**; Yoruba, Igbo, Hausa deferred (seed + code-change-free to add)
- #9 Monetization
- #10 Branding assets
- #11 Data deletion policy

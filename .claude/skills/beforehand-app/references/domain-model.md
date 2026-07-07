# Beforehand — Domain Model & Session Lifecycle

The proposed entity model. Adapt naming to the chosen stack's conventions, but preserve the relationships and the invariant-enforcement points marked ⚠️.

## Entities

### User
- `id`, `email` (unique), `phone` (nullable), `display_name`, auth fields per chosen provider, `created_at`
- A user can participate in multiple sessions over time (e.g., a married couple retaking years later), but see the pairing rule below.

### Session
The central aggregate — one session = one couple doing one assessment round.

- `id`, `created_by_user_id`, `partner_user_id` (nullable until invitation accepted)
- `relationship_stage` — enum: `early_dating | dating | engaged | married`
- `cultural_context_id` — FK to CulturalContext
- `status` — enum, see lifecycle below
- `report_generated_at` (nullable), `closed_at` (nullable), `created_at`
- ⚠️ Sessions never auto-expire. No TTL, no cleanup job that closes sessions. Only a partner action sets `closed`.

### Invitation
- `id`, `session_id`, `invited_email` / `invited_phone`, `token` (single-use, unguessable), `channel` (`email | sms`), `sent_at`, `accepted_at` (nullable)
- Accepting binds the accepting user as `session.partner_user_id` and transitions the session to `active`.
- ⚠️ Questions are not served to either partner until `accepted_at` is set.

### CulturalContext
- `id`, `name`, `slug`, `description`
- Seed data. Questions can target one or more contexts (or be universal). Exact list of contexts is an open product decision — see `tech-stack.md`.

### Category
- `id`, `name`, `slug`, `display_order`, `icon`
- The 12 launch categories: Finance; Parenting; Sexuality; Faith & Spirituality; Chores & Home Life; Career & Ambition; Extended Family & In-Laws; Housing; Stress & Conflict Style; Sexual History; Food & Kitchen; Tribal/Cultural Expectations.

### Question
- `id`, `category_id`, `text`, `stages` (array/junction — which relationship stages it applies to), `cultural_contexts` (junction; empty = universal), `display_order`, `is_active`
- Questions are data, not code. Never hard-code question text into the frontend.

### CustomQuestion
- `id`, `session_id`, `author_user_id`, `category_id` (nullable or "Personal"), `text`, `created_at`
- Authored by one partner, answered by **both** (same three-option format). Visible to the other partner as a question to answer, without revealing the author's own answer to it.

### CategoryDesignation
- `session_id`, `user_id`, `category_id`, `designation` — enum: `core | flexible`
- Each partner designates every category before answering. Effective designation for analysis = `core` if either partner said core.

### Answer
- `id`, `session_id`, `user_id`, `question_id` (or `custom_question_id`), `choice` — enum: `fully_on_board | open_to_discussing | dealbreaker`
- `compromise_text` — required when `choice = open_to_discussing`, null otherwise
- `updated_at` — answers are editable until the partner submits
- ⚠️ **The privacy invariant lives here.** No API response, page render, or serialized object may include an Answer whose `user_id` ≠ requesting user while `session.status != report_ready`. Enforce in the data-access layer (e.g., a scoped query/policy), not per-endpoint. Postgres row-level security or an equivalent repository guard is appropriate.

### Submission
- `session_id`, `user_id`, `submitted_at`
- Submitting locks that partner's answers. When the **second** submission lands, generate the report in the same transaction (or an idempotent job triggered by it) and transition the session to `report_ready`.
- ⚠️ Simultaneous unlock: the report's availability flag is session-level, not per-user.

### Nudge
- `id`, `session_id`, `from_user_id`, `message` (preset key or custom text), `channel`, `sent_at`

### Report
- `id`, `session_id` (unique), `generated_at`, `payload` (structured JSON per `analysis-logic.md`)
- Persist the generated report rather than recomputing on every view — answers are locked at generation time, so it's stable.

### ShareConsent (counselor sharing)
- `id`, `session_id`, `counselor_email` (MVP: an email destination; Phase 2: FK to a Counselor entity), `requested_by_user_id`
- `consents`: one row/flag per partner with `consented_at`
- ⚠️ The share executes only when **both** consents exist. A pending one-sided request must not reveal report content to anyone, and should be visible to the second partner as a consent request.

## Session lifecycle

```
draft ──invite sent──▶ invited ──partner accepts──▶ active
                                                      │
                              (both designate categories, answer, edit freely)
                                                      │
                                    first partner submits: still `active`
                                    (that partner's answers now locked)
                                                      │
                          second partner submits ──▶ report_ready
                                                      │
                                 either partner closes ──▶ closed
```

Rules:
- `draft → invited`: creator has set stage + cultural context and sent the invitation.
- `invited → active`: invitee accepts via token. Questions become visible to both.
- One partner submitting does **not** change session status visible behavior for the other beyond progress % (which reads 100%).
- `report_ready` is the only state in which cross-partner answers are readable (via the report and answer-comparison views).
- `closed` can be entered from any post-invite state, by either partner. Closing is not deletion; deletion/anonymization is a separate, explicit account-level action (data privacy decision — see open questions).

## Progress calculation

`progress % = answered questions / total applicable questions` for that partner, where applicable = active questions matching the session's stage + cultural context, plus custom questions addressed to them. Expose only the percentage of the *other* partner — never a category or question breakdown. Category-level breakdown of one's **own** progress is fine and useful.

## Retake reminders (married stage)

Store `next_retake_reminder_at` on the session (or a couple-level record) when a married-stage report is generated: 3–5 years out (default 4; make configurable). A scheduled job emails both partners when due. Low priority within MVP — schema-ready is enough; the job can come last.

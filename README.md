# Beforehand

*Before I ask for your hand... let's talk.*

A relationship compatibility platform: each partner answers honest, stage- and
culture-specific questions **privately**; when both submit, a report unlocks
**for both at once** — alignment, tensions, dealbreakers, in each partner's
own words. A mirror, not a verdict.

Product spec and invariants live in the `beforehand-app` skill; decisions in
`DECISIONS.md`.

## Non-negotiable invariants (enforced server-side)
1. No cross-partner answer reads before `report_ready` — all answer/report
   queries go through `src/db/guards.ts`, nowhere else.
2. Report unlocks simultaneously for both partners (session-level state).
3. Partner progress is a percentage only.
4. No compatibility score or verdict anywhere.
5. Mutual consent gates all sharing.
6. Sessions never expire.

## Setup
```bash
npm install
cp .env.example .env        # fill in Neon DATABASE_URL, AUTH_SECRET, Resend key
npm run db:generate         # generate SQL migrations from src/db/schema.ts
npm run db:migrate          # apply to the database
npm run db:seed             # load categories, contexts, questions from seed/
npm run dev
```

## Commands
- `npm test` — unit tests (state machine, invariants gates, tokens)
- `npm run typecheck`
- `npm run db:generate` / `db:migrate` / `db:seed`

## Layout
- `src/db/schema.ts` — full domain model (invariant-critical tables marked)
- `src/db/guards.ts` — the ONLY module allowed to read `answers`/`reports`
- `src/lib/session-state.ts` — session lifecycle state machine (pure, tested)
- `seed/` — question bank as versioned YAML; upsert by stable id
- `scripts/seed.ts` — idempotent seed pipeline

---
name: beforehand-app
description: "The complete build guide for Beforehand, Joshua Odeyemi's relationship compatibility web app ('Before I ask for your hand... let's talk'). Use this skill for ANY work on Beforehand: building or modifying the app, its question bank, session/invitation flows, the three-option answer system, the compatibility report, nudges, counselor sharing, or its database schema and APIs. Trigger whenever the user mentions Beforehand, a couples questionnaire app, partner sessions, compatibility reports, dealbreakers, or relationship-stage question sets — even for small changes, because this skill encodes product invariants (privacy rules, no-verdict principle) that must never be violated."
---

# Beforehand — Build Guide

Beforehand is a relationship compatibility platform. One partner creates a session and invites the other; each answers a stage- and culture-specific question bank **privately and asynchronously**; when both submit, a compatibility report unlocks **simultaneously for both**, surfacing alignment areas, tension areas, and dealbreaker flags — with each partner's actual words, and no score or verdict.

It is a mirror, not a judge. Everything in this skill flows from that.

## How to use this skill

Read the reference files before writing code in their area. They are the spec — the founder (Joshua) reviewed the product vision they distill, so deviating from them silently is a bug, not creativity.

| File | Read it when |
|---|---|
| `references/product-spec.md` | Starting any feature work; you need the full feature list and what's in/out of scope |
| `references/domain-model.md` | Designing or touching the database schema, session lifecycle, or API |
| `references/analysis-logic.md` | Building or modifying the compatibility report generation |
| `references/question-bank.md` | Authoring, seeding, importing, or restructuring questions |
| `references/ux-principles.md` | Building any user-facing screen, copy, email, or notification |
| `references/tech-stack.md` | Setting up the project, choosing libraries, deploying |

## Product invariants — never violate these

These are load-bearing. Enforce them **server-side**, not just in the UI:

1. **Answer privacy until mutual submission.** A partner's answers (choices AND compromise text) must never be readable by the other partner — through any API, page, cache, email, or log — until *both* have submitted. No endpoint may return partner B's answers to partner A before that moment.
2. **Simultaneous unlock.** The report becomes available to both partners at the same moment (when the second submission lands). There is no state where one partner can see the report and the other cannot.
3. **Progress is a percentage only.** Partners may see each other's completion %, never *which* categories or questions the other has answered or skipped.
4. **No verdict, ever.** No compatibility score, percentage match, grade, or stay/leave recommendation appears anywhere — report, emails, marketing copy, metadata. The report shows specific named divergences with each partner's actual words.
5. **Mutual consent gates all sharing.** Nothing leaves the couple (counselor sharing included) unless *both* partners explicitly consent. One-sided consent shares nothing and reveals nothing.
6. **Sessions never expire.** Only a partner can close a session. Answers save incrementally; a couple can take months.
7. **Both parties enter intentionally.** Questions unlock only after the invited partner accepts the invitation.

If a requested change would violate one of these, stop and raise it with Joshua instead of building it.

## Build order (MVP)

Work in this sequence — each phase is independently verifiable:

1. **Foundation** — project scaffold, auth, data model, migrations (see `domain-model.md`, `tech-stack.md`)
2. **Session & invitation flow** — create session, set stage + cultural context, invite via email, accept flow
3. **Question bank & seeding** — schema + seed data (see `question-bank.md`)
4. **Answering experience** — category core/flexible designation, three-option answers, compromise text, incremental save, custom questions
5. **Progress & nudges** — completion %, nudge messages
6. **Submission & report** — the analysis engine (see `analysis-logic.md`) and report UI
7. **Counselor sharing (consent flow only)** — the mutual-consent share; full counselor dashboard is Phase 2, do not build it in MVP

## Working with Joshua

Joshua is a senior data engineer and the founder. His explicit working preference on this project: **do not build ahead of alignment.** Confirm the plan for each phase before implementing it, and check in at natural milestones rather than delivering a monolith. When the spec is ambiguous, ask — he would rather answer a question than review a wrong assumption. Open product decisions are tracked at the top of `tech-stack.md`; resolve them with him before the affected phase.

# Beforehand — Product Specification

Distilled from the Product Vision Document v1.0 (Joshua Odeyemi, Founder). This is the authoritative feature spec for the MVP.

## The problem it solves

Couples fail because of lies told before commitment: performative dating (presenting an agreeable false self), dishonest conversations (right questions, wrong answers), and dismissed honesty (truth spoken but not taken seriously). There is no structured, pressure-free tool for confronting this before it's too late.

## The core insight

Honesty requires the right conditions. Face-to-face, in the moment, social pressure distorts answers — people soften, mirror, perform. Beforehand works because each partner answers **privately, asynchronously, unwatched** — and only then are answers surfaced together.

Every design decision should be tested against this: *does it protect the conditions for honesty?*

## Positioning — what Beforehand is NOT

- **Not a verdict machine.** It never tells couples to stay or leave. It surfaces truth; what they do with it is theirs.
- **Not a matchmaking/dating app.** It begins after two people have chosen each other.
- **Not therapy.** It creates conditions for honest conversation and can point toward professional help.

Tagline: *"Before I ask for your hand... let's talk."*

## Target users (relationship stages)

Question sets are stage-specific. Four stages:

1. **Crushes & early daters** — is this person worth pursuing seriously?
2. **Dating couples** — deciding whether to move toward engagement with clarity.
3. **Engaged couples** — honest premarital work before the wedding.
4. **Married couples** — re-alignment every few years (app reminds them every 3–5 years to retake, with a married-life question set).

## MVP features

### 1. Session creation & invitation
- One partner creates the session: sets relationship stage, selects cultural/tribal context, invites the other via email or SMS.
- Questions become available to both partners **only after the invitation is accepted** — both parties enter intentionally.

### 2. Question bank
- Hundreds of preloaded questions across 12 categories: Finance; Parenting; Sexuality; Faith & Spirituality; Chores & Home Life; Career & Ambition; Extended Family & In-Laws; Housing; Stress & Conflict Style; Sexual History; Food & Kitchen; Tribal/Cultural Expectations.
- Questions are **stage-specific** (dating vs. engaged vs. married) and **culture-specific**. See `question-bank.md`.

### 3. Three honest response options
Per question, exactly three choices — no vague middle ground:
- ✅ **I'm fully on board**
- 🤝 **I'm open to discussing this** → opens a required free-text field for the partner's proposed compromise
- 🚫 **This is a dealbreaker for me**

### 4. Core vs. flexible category designation
- Before answering, each partner marks each category as **core (non-negotiable)** or **flexible**.
- If *either* partner marks a category core, it is treated as core in the final analysis.

### 5. Custom questions
- Each partner can submit their own questions to the other, in the same three-option format, to surface deeply personal issues the general bank doesn't cover.

### 6. Progress visibility & nudges
- Each partner sees the other's **completion percentage only** — never which sections are done or skipped.
- A partner can send a **nudge**: a preset cute message or a custom one, delivered via push notification, email, or SMS (MVP may start with a subset of channels — see tech-stack open decisions).

### 7. The compatibility report
- Unlocks **simultaneously for both** when both have submitted.
- Structured as: **Alignment Areas**, **Tension Areas** (divergence where compromise is possible), **Dealbreaker Flags** (a non-negotiable conflicting with the other's answer).
- For every meaningful divergence: shows exactly how each partner answered and what they wrote — so neither person can misremember or minimise.
- No score, no percentage, no verdict. See `analysis-logic.md`.

### 8. Counselor sharing (MVP: consent + share only)
- Both partners must consent before the full report is shared with a therapist/counselor. One-sided consent shares nothing.
- The counselor **dashboard** (accounts, custom question sets, report inbox, session booking) is **Phase 2 — do not build in MVP**.

## Session & data rules

- Sessions never expire; only a partner can close one.
- Answers save incrementally (days, weeks, months of progress preserved).
- Report unlocks only when **both** have submitted.
- Married couples get a retake reminder every 3–5 years.
- All data private by default; nothing shared outside the couple without explicit mutual consent.

## Phase 2 (future — for architectural awareness only)

- Counselor accounts; counselors recommend Beforehand to clients.
- Counselors customise which question sets clients answer.
- With mutual consent, counselors receive the full report pre-session.
- In-platform session booking with counselors.

Design the MVP schema so these can be added without migration pain (e.g., report sharing is already an entity, question sets are already data, not code) — but do not implement them.

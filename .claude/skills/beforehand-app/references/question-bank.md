# Beforehand — Question Bank

The question bank is content, and content is the product. Treat it with the same rigor as code: versioned seed files, reviewable diffs, founder sign-off before anything ships to users.

## Structure

Questions live in seed data (suggest one YAML/JSON file per category under `seed/questions/`), never hard-coded in the UI. Each question record:

```yaml
- id: fin-012                # stable slug id — never renumber; answers reference it
  category: finance
  text: "All income becomes joint money once we're married — separate accounts end."
  stages: [dating, engaged, married]   # which relationship stages see it
  contexts: []                          # empty = universal; else cultural context slugs
  active: true
```

## The three-option format shapes how questions must be written

Every question is answered with: ✅ fully on board · 🤝 open to discussing (+ compromise text) · 🚫 dealbreaker.

That means each question must be a **clear, concrete proposition a person can be on board with or not** — a stance, expectation, or arrangement. Not an open question, not a quiz item.

- ❌ "How do you feel about money?" (not answerable with the three options)
- ❌ "Is it okay to have separate accounts?" (yes/no framing, ambiguous stance)
- ✅ "We will keep fully separate bank accounts and split shared bills."
- ✅ "My mother will live with us when she is older."
- ✅ "We will raise our children in my faith, including if only one of us practices it."

Writing guidelines:
- One proposition per question. Split compound expectations.
- Direct, plain language. These are the questions couples avoid — the product's job is to ask them bluntly but respectfully.
- First-person-couple voice ("We will…", "I expect…") so the stance is unambiguous.
- Sensitive categories (Sexuality, Sexual History) are in scope and important — write them frankly and matter-of-factly, at the level of adult premarital counseling material. No euphemism that blurs the stance; no gratuitous detail either.
- Culture-specific questions state the cultural expectation explicitly rather than assuming shared context (e.g., bride price/dowry expectations, extended-family financial obligations, whose hometown holidays are spent in, naming traditions).
- Stage-appropriateness: early-dating sets skew toward values and direction ("I want children someday"), engaged sets toward concrete arrangements ("We will live with/near my family for the first year"), married sets toward re-alignment ("Our current division of chores is working for me").

## The 12 launch categories

Finance · Parenting · Sexuality · Faith & Spirituality · Chores & Home Life · Career & Ambition · Extended Family & In-Laws · Housing · Stress & Conflict Style · Sexual History · Food & Kitchen · Tribal/Cultural Expectations.

Target: "hundreds" of questions total. A practical launch bar: 15–25 per category with stage variants, weighted heavier in Finance, Parenting, Faith, and Extended Family (the highest-conflict domains).

## Cultural contexts

The vision doc specifies culture-/tribe-specific question sets. The launch list of contexts is an **open product decision** (see `tech-stack.md` open questions) — likely candidates given the founder's market include Nigerian contexts (e.g., Yoruba, Igbo, Hausa) plus a universal/default set. Do not invent the final list without founder confirmation, and have the founder (ideally with cultural reviewers) sign off on culture-specific question content before it goes live.

## Authoring workflow

1. Confirm with the founder whether he has existing question material or wants a drafted bank to review.
2. Draft per category in seed files; open for his review category-by-category (he prefers stepwise alignment over big drops).
3. Only mark `active: true` after sign-off.
4. Never delete or repurpose a question id that has answers against it — deactivate (`active: false`) and add a new id. Reports must remain renderable forever against the questions as they were asked.

## Custom questions

Partners can author their own questions within a session, in the same propositional format. Give the authoring UI a one-line format hint ("State it as something your partner can be fully on board with, open to discussing, or name as a dealbreaker") and show the three options in preview.

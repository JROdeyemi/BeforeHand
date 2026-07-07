# Beforehand — Compatibility Analysis Logic

How the report thinks. This is the heart of the product; implement it as a pure, unit-tested function from `(answers_A, answers_B, category_designations, questions)` → `report_payload`.

## First principles

- **Show, don't tell.** The output is specific, named divergences with each partner's actual words — *"Amara says she wants 3 children and will not compromise on this. You said 1 or 2 is enough and you are open to discussing it."* Never a compatibility score, percentage, or verdict.
- **Weight by what matters to them**, not by raw disagreement count. Two people who disagree on 30 minor things but align on every core issue may be more compatible than two who agree on the surface but clash on a mutual non-negotiable.
- **Dealbreakers surface first**, regardless of category weight.

## Per-question classification

Both partners answer every question with one of three choices. Classify each question by the pair of choices:

| Partner A \ Partner B | Fully on board | Open to discussing | Dealbreaker |
|---|---|---|---|
| **Fully on board** | ALIGNED | TENSION | **DEALBREAKER FLAG** |
| **Open to discussing** | TENSION | TENSION | TENSION (elevated) |
| **Dealbreaker** | **DEALBREAKER FLAG** | TENSION (elevated) | ALIGNED* |

Notes:
- **DEALBREAKER FLAG** = one partner marked it a non-negotiable while the other is fully on board with the opposite stance. Per the vision doc, this is the primary tension pattern and is surfaced first regardless of category.
- **ALIGNED\*** (dealbreaker/dealbreaker): both consider it a dealbreaker — they agree on the boundary. Treat as alignment, but list it in a distinct "shared non-negotiables" subsection; agreeing on a hard limit is meaningful and worth naming.
- **TENSION (elevated)** (open/dealbreaker): one partner holds a hard line, the other is open. Not a full flag — the open partner's compromise text may resolve toward the dealbreaker holder's position — but rank it above ordinary tensions.
- **TENSION**: divergence where compromise is possible. Whenever either partner chose "open to discussing," their compromise text is attached and displayed — it is the starting point for the real conversation.
- Unanswered questions (possible if a partner submits with skips, if skipping is allowed — open decision) are excluded from classification but counted in a coverage note.

## Category weighting

- Effective designation per category: **core if either partner marked it core**, else flexible.
- Within the report, conflicts in core categories rank above conflicts in flexible categories at the same classification level.
- Suggested ordering key for the tension list: `(classification_severity desc, is_core_category desc, category display_order, question order)` where severity is `dealbreaker_flag > tension_elevated > tension`.

## Report payload structure

Persist as structured JSON; render from it. Suggested shape:

```json
{
  "generated_at": "...",
  "session": { "stage": "engaged", "cultural_context": "..." },
  "summary": {
    "total_questions": 214,
    "aligned": 158,
    "shared_dealbreakers": 6,
    "tensions": 41,
    "dealbreaker_flags": 9,
    "core_categories": ["finance", "parenting", "faith"]
  },
  "dealbreaker_flags": [
    {
      "question_id": "...", "question_text": "...",
      "category": "parenting", "is_core": true,
      "partner_a": { "choice": "dealbreaker", "compromise_text": null },
      "partner_b": { "choice": "fully_on_board", "compromise_text": null }
    }
  ],
  "tensions": [
    {
      "question_id": "...", "question_text": "...",
      "category": "finance", "is_core": true, "elevated": false,
      "partner_a": { "choice": "open_to_discussing", "compromise_text": "..." },
      "partner_b": { "choice": "fully_on_board", "compromise_text": null }
    }
  ],
  "alignment": {
    "by_category": [ { "category": "housing", "aligned_count": 12, "total": 14 } ],
    "shared_dealbreakers": [ { "question_id": "...", "question_text": "..." } ]
  },
  "custom_questions": [ /* same classification, listed separately */ ]
}
```

The `summary` counts are internal structure for rendering sections — they are **not** to be collapsed into a single score or percentage anywhere in the UI, emails, or metadata (including page titles and notification text).

## Rendering rules

- Order: Dealbreaker Flags → Tension Areas (core first, elevated first) → Alignment Areas.
- Every divergence entry names both partners and quotes their choice and compromise text verbatim. Use display names, second person for the viewing partner ("You said…", "Amara said…").
- Compromise proposals get visual emphasis — they are the productive output of the whole exercise.
- Language must stay descriptive, never evaluative: "You differ here" — never "this is bad," "red flag," "incompatible," or advice to stay/leave. Where results are heavy (many core dealbreaker flags), the report may gently note that couples often find it helpful to work through results with a counselor, and surface the counselor-sharing feature. That is the maximum level of steer permitted.

## Testing expectations

Unit-test the classifier against the full 3×3 matrix, category-weight ordering, custom questions, and the empty/partial edge cases. Snapshot-test a full payload from a realistic fixture couple. These tests are the guardrail that future edits don't quietly turn the mirror into a judge.

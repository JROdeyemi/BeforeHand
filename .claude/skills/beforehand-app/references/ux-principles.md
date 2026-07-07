# Beforehand — UX Principles, Tone & Copy

Beforehand handles the most private material in a person's life, at a decision point that shapes it. The UX must earn the honesty it asks for.

## Tone of voice

- **Warm, direct, unafraid.** The product asks blunt questions kindly. Copy should sound like a wise friend, not a clinical form and not a cutesy app.
- **Never judgmental, never alarmist.** No "red flags," no "warning" language about the *relationship*. Severity language is reserved for the structural labels the product defines (Dealbreaker Flags, Tension Areas) and stays descriptive.
- **The founder's framing is canon:** it's a mirror, not a verdict. "Beforehand does not tell you what to do. It shows you what's true."
- The tagline — *"Before I ask for your hand... let's talk."* — sets the register: romantic seriousness, not gamification. No streaks, badges, or scores.

## Privacy as felt experience, not just policy

Users must *feel* the privacy that makes honesty possible:

- On every answering screen, a persistent, quiet reassurance: answers are private until you both submit.
- Before first answer, a short explainer of the mechanic: answer alone → both submit → report unlocks for both at once.
- The compromise text field prompts for honesty: "If you're open to discussing this, what would a compromise look like for you?"
- Never preview, tease, or hint at the partner's answers pre-unlock ("Your partner answered this differently!" is forbidden — it violates the core mechanic).
- Nudges must not leak content: a nudge says "keep going," never "she finished the Finance section" (progress is % only).

## Key screens (MVP)

1. **Landing / marketing** — the founder's story and problem framing are the pitch; lead with the tagline and the mirror-not-verdict promise.
2. **Session creation wizard** — stage → cultural context → invite partner. Explain why each choice matters (it tailors the questions).
3. **Invitation accept** — the invitee sees who invited them, what Beforehand is, and what they're agreeing to (intentional entry). Requires account creation/sign-in.
4. **Category designation** — mark each category core/flexible before answering, with a plain explanation: "Core means: conflicts here matter most to you. If either of you marks a category core, we treat it as core."
5. **Answering flow** — one question at a time or category pages (founder's call), three big options, compromise text when 🤝 chosen, autosave indicator, own-progress by category.
6. **Waiting state** — after submitting: own answers locked, partner's completion %, nudge button.
7. **Report** — Dealbreaker Flags → Tensions → Alignment, per `analysis-logic.md` rendering rules. Design for the couple reading it *together*: calm, spacious, printable/exportable.
8. **Counselor share** — request → both consents → sent. State clearly at every step that nothing is shared until both agree.

## Nudges

- Preset messages are affectionate and light ("No pressure… okay, tiny pressure 💛", "I finished mine. Your move."), plus custom text.
- Rate-limit (e.g., 1/day) so nudges stay sweet, not naggy.

## Emails / notifications

Every outbound message must respect the invariants: no answer content, no partner-progress detail beyond %, no scores. Transactional set for MVP: invitation, invitation accepted, partner submitted (only "your partner has finished — the report unlocks when you submit"), report ready, nudge, consent request, share confirmation, (later) married-stage retake reminder.

## Accessibility & reach

- Mobile-first responsive web; long-form answering happens on phones.
- The three options must be distinguishable beyond emoji/color (labels always visible; adequate contrast; screen-reader labels).
- Plain-language throughout — the audience is every couple, not tech workers.

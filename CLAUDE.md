# Beforehand
Read .claude/skills/beforehand-app/SKILL.md and DECISIONS.md before any feature work.
The 7 product invariants in SKILL.md are non-negotiable; enforce them server-side.
All answer/report queries go through src/db/guards.ts — never query those tables directly.
Before claiming any task done: npm test && npm run build must pass.
Never log answer content or compromise text.
Questions live in seed/ YAML — never hard-code question text.
Workflow: propose a plan and wait for approval before writing code.
Log settled decisions in DECISIONS.md with dates.
Git: create a phase-N branch at the start of each phase; commit there; never push to main without explicit approval.
After committing, run git status and confirm the working tree is clean — report if it isn't.
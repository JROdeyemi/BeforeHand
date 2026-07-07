/**
 * Beforehand — session lifecycle state machine (pure, no I/O).
 *
 *   draft ─▶ invited ─▶ active ─▶ report_ready
 *                │          │           │
 *                └──────────┴───────────┴──▶ closed
 *
 * Rules (references/domain-model.md):
 * - Sessions never expire; only a partner action reaches `closed`.
 * - One partner submitting does NOT change status; the SECOND submission
 *   moves active → report_ready (report generated in the same transaction).
 * - `report_ready` is the only state where cross-partner answers are readable.
 */

export type SessionStatus =
  | "draft"
  | "invited"
  | "active"
  | "report_ready"
  | "closed";

export type SessionEvent =
  | "send_invitation"
  | "accept_invitation"
  | "second_submission"
  | "close";

const TRANSITIONS: Record<SessionStatus, Partial<Record<SessionEvent, SessionStatus>>> = {
  draft: { send_invitation: "invited", close: "closed" },
  invited: { accept_invitation: "active", close: "closed" },
  active: { second_submission: "report_ready", close: "closed" },
  report_ready: { close: "closed" },
  closed: {},
};

export function nextStatus(
  from: SessionStatus,
  event: SessionEvent,
): SessionStatus | null {
  return TRANSITIONS[from][event] ?? null;
}

export class InvalidTransitionError extends Error {
  constructor(from: SessionStatus, event: SessionEvent) {
    super(`Cannot apply "${event}" while session is "${from}".`);
  }
}

export function assertTransition(
  from: SessionStatus,
  event: SessionEvent,
): SessionStatus {
  const to = nextStatus(from, event);
  if (!to) throw new InvalidTransitionError(from, event);
  return to;
}

/** Questions are visible to partners only from `active` onward. */
export function questionsVisible(status: SessionStatus): boolean {
  return status === "active" || status === "report_ready";
}

/** The single gate for cross-partner answer visibility. */
export function crossPartnerAnswersVisible(status: SessionStatus): boolean {
  return status === "report_ready";
}

/** A partner may edit answers only while active and not yet submitted. */
export function canEditAnswers(
  status: SessionStatus,
  hasSubmitted: boolean,
): boolean {
  return status === "active" && !hasSubmitted;
}

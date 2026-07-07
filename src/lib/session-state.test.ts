import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canEditAnswers,
  crossPartnerAnswersVisible,
  InvalidTransitionError,
  nextStatus,
  questionsVisible,
  type SessionEvent,
  type SessionStatus,
} from "./session-state";
import { generateInviteToken } from "./tokens";

const ALL_STATUSES: SessionStatus[] = [
  "draft",
  "invited",
  "active",
  "report_ready",
  "closed",
];
const ALL_EVENTS: SessionEvent[] = [
  "send_invitation",
  "accept_invitation",
  "second_submission",
  "close",
];

describe("session state machine", () => {
  it("follows the happy path", () => {
    expect(nextStatus("draft", "send_invitation")).toBe("invited");
    expect(nextStatus("invited", "accept_invitation")).toBe("active");
    expect(nextStatus("active", "second_submission")).toBe("report_ready");
  });

  it("allows a partner to close from any live state", () => {
    for (const s of ["draft", "invited", "active", "report_ready"] as const) {
      expect(nextStatus(s, "close")).toBe("closed");
    }
  });

  it("closed is terminal — sessions never reopen or expire elsewhere", () => {
    for (const e of ALL_EVENTS) expect(nextStatus("closed", e)).toBeNull();
  });

  it("rejects every transition not explicitly allowed", () => {
    const allowed = new Set([
      "draft:send_invitation",
      "draft:close",
      "invited:accept_invitation",
      "invited:close",
      "active:second_submission",
      "active:close",
      "report_ready:close",
    ]);
    for (const s of ALL_STATUSES) {
      for (const e of ALL_EVENTS) {
        const key = `${s}:${e}`;
        if (allowed.has(key)) {
          expect(nextStatus(s, e)).not.toBeNull();
        } else {
          expect(nextStatus(s, e)).toBeNull();
          expect(() => assertTransition(s, e)).toThrow(InvalidTransitionError);
        }
      }
    }
  });

  it("cannot skip intentional entry: no submissions before acceptance", () => {
    expect(nextStatus("draft", "second_submission")).toBeNull();
    expect(nextStatus("invited", "second_submission")).toBeNull();
  });
});

describe("visibility gates (product invariants)", () => {
  it("questions unlock only after the invitation is accepted", () => {
    expect(questionsVisible("draft")).toBe(false);
    expect(questionsVisible("invited")).toBe(false);
    expect(questionsVisible("active")).toBe(true);
  });

  it("cross-partner answers are visible in report_ready and NOWHERE else", () => {
    for (const s of ALL_STATUSES) {
      expect(crossPartnerAnswersVisible(s)).toBe(s === "report_ready");
    }
  });

  it("answers lock on submission and outside active", () => {
    expect(canEditAnswers("active", false)).toBe(true);
    expect(canEditAnswers("active", true)).toBe(false);
    expect(canEditAnswers("report_ready", false)).toBe(false);
    expect(canEditAnswers("invited", false)).toBe(false);
  });
});

describe("invitation tokens", () => {
  it("are long, URL-safe, and unique", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const t = generateInviteToken();
      expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(seen.has(t)).toBe(false);
      seen.add(t);
    }
  });
});

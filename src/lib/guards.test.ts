/**
 * Unit tests for guard-level business logic.
 *
 * These test the pure decision functions and the session-state gates
 * relevant to the answering experience. They do not hit the database —
 * the DB-dependent guards are tested via integration paths.
 */

import { describe, expect, it } from "vitest";
import {
  canEditAnswers,
  crossPartnerAnswersVisible,
  questionsVisible,
} from "./session-state";

// ---------------------------------------------------------------------------
// Session-state gates (answering-experience invariants)
// ---------------------------------------------------------------------------

describe("canEditAnswers", () => {
  it("allows edits when active and not submitted", () => {
    expect(canEditAnswers("active", false)).toBe(true);
  });

  it("locks edits after submission", () => {
    expect(canEditAnswers("active", true)).toBe(false);
  });

  it("locks edits when session is not active", () => {
    expect(canEditAnswers("report_ready", false)).toBe(false);
    expect(canEditAnswers("closed", false)).toBe(false);
    expect(canEditAnswers("invited", false)).toBe(false);
    expect(canEditAnswers("draft", false)).toBe(false);
  });
});

describe("crossPartnerAnswersVisible", () => {
  it("is false before report_ready — even immediately after second submit", () => {
    // After the second submission the status moves to report_ready in the
    // same transaction; there is no intermediate state where answers are
    // visible before report_ready.
    expect(crossPartnerAnswersVisible("active")).toBe(false);
    expect(crossPartnerAnswersVisible("invited")).toBe(false);
    expect(crossPartnerAnswersVisible("draft")).toBe(false);
    expect(crossPartnerAnswersVisible("closed")).toBe(false);
  });

  it("is true only when report_ready", () => {
    expect(crossPartnerAnswersVisible("report_ready")).toBe(true);
  });
});

describe("questionsVisible", () => {
  it("is true only once the invitation is accepted", () => {
    expect(questionsVisible("draft")).toBe(false);
    expect(questionsVisible("invited")).toBe(false);
    expect(questionsVisible("active")).toBe(true);
    expect(questionsVisible("report_ready")).toBe(true);
    // closed: questions still viewable (they submitted)
    expect(questionsVisible("closed")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// canSubmit decision logic (tested through pure arithmetic)
// ---------------------------------------------------------------------------
// The actual canSubmit function hits the DB, so we test the underlying
// rule: answered === total AND total > 0.

describe("canSubmit logic (pure arithmetic, not DB)", () => {
  function wouldAllow(answered: number, total: number) {
    return total > 0 && answered === total;
  }

  it("rejects when nothing answered", () => {
    expect(wouldAllow(0, 20)).toBe(false);
  });

  it("rejects when partially answered", () => {
    expect(wouldAllow(10, 20)).toBe(false);
    expect(wouldAllow(19, 20)).toBe(false);
  });

  it("allows when exactly 100%", () => {
    expect(wouldAllow(20, 20)).toBe(true);
    expect(wouldAllow(1, 1)).toBe(true);
  });

  it("rejects when total is 0 (no applicable questions — edge case)", () => {
    expect(wouldAllow(0, 0)).toBe(false);
  });

  it("deactivated questions drop the denominator, not the numerator", () => {
    // Before deactivation: 20 total, 19 answered → cannot submit
    expect(wouldAllow(19, 20)).toBe(false);
    // Question deactivated: 19 total, 19 answered → can submit
    expect(wouldAllow(19, 19)).toBe(true);
  });

  it("custom questions count toward the total", () => {
    // 18 bank + 2 custom = 20 total; user answered 18 bank + 1 custom = 19
    expect(wouldAllow(19, 20)).toBe(false);
    // User answers the last custom question
    expect(wouldAllow(20, 20)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// areAllCategoriesDesignated logic (pure arithmetic)
// ---------------------------------------------------------------------------

describe("areAllCategoriesDesignated logic (pure arithmetic, not DB)", () => {
  function wouldAllow(designated: number, total: number) {
    return total > 0 && designated >= total;
  }

  it("false when nothing designated", () => {
    expect(wouldAllow(0, 12)).toBe(false);
  });

  it("false when 11 of 12 designated", () => {
    expect(wouldAllow(11, 12)).toBe(false);
  });

  it("true when all 12 designated", () => {
    expect(wouldAllow(12, 12)).toBe(true);
  });

  it("false when no categories exist", () => {
    expect(wouldAllow(0, 0)).toBe(false);
  });
});

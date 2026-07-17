import { describe, expect, it } from "vitest";
import {
  analyzeSession,
  classifyPair,
  type AnalysisInput,
  type CategoryRecord,
  type PartnerAnswer,
  type QuestionRecord,
} from "./analysis";

// ---------------------------------------------------------------------------
// classifyPair — full 3×3 matrix
// ---------------------------------------------------------------------------

describe("classifyPair", () => {
  it("FOB + FOB → ALIGNED", () => {
    expect(classifyPair("fully_on_board", "fully_on_board")).toBe("ALIGNED");
  });
  it("FOB + OTD → TENSION", () => {
    expect(classifyPair("fully_on_board", "open_to_discussing")).toBe("TENSION");
  });
  it("FOB + DB → DEALBREAKER_FLAG", () => {
    expect(classifyPair("fully_on_board", "dealbreaker")).toBe("DEALBREAKER_FLAG");
  });
  it("OTD + FOB → TENSION", () => {
    expect(classifyPair("open_to_discussing", "fully_on_board")).toBe("TENSION");
  });
  it("OTD + OTD → TENSION", () => {
    expect(classifyPair("open_to_discussing", "open_to_discussing")).toBe("TENSION");
  });
  it("OTD + DB → TENSION_ELEVATED", () => {
    expect(classifyPair("open_to_discussing", "dealbreaker")).toBe("TENSION_ELEVATED");
  });
  it("DB + FOB → DEALBREAKER_FLAG", () => {
    expect(classifyPair("dealbreaker", "fully_on_board")).toBe("DEALBREAKER_FLAG");
  });
  it("DB + OTD → TENSION_ELEVATED", () => {
    expect(classifyPair("dealbreaker", "open_to_discussing")).toBe("TENSION_ELEVATED");
  });
  it("DB + DB → ALIGNED_SHARED", () => {
    expect(classifyPair("dealbreaker", "dealbreaker")).toBe("ALIGNED_SHARED");
  });
});

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const CATS: CategoryRecord[] = [
  { slug: "finance", displayOrder: 1 },
  { slug: "parenting", displayOrder: 2 },
  { slug: "housing", displayOrder: 3 },
  { slug: "personal", displayOrder: 99 },
];

function q(
  id: string,
  categorySlug: string,
  displayOrder = 0,
): QuestionRecord {
  return { id, categorySlug, text: `Question ${id}`, displayOrder };
}

function ans(
  questionId: string | null,
  customQuestionId: string | null,
  choice: PartnerAnswer["choice"],
  compromiseText: string | null = null,
): PartnerAnswer {
  return { questionId, customQuestionId, choice, compromiseText };
}

function bankAns(qid: string, choice: PartnerAnswer["choice"], text?: string): PartnerAnswer {
  return ans(qid, null, choice, text ?? null);
}

function customAns(cid: string, choice: PartnerAnswer["choice"], text?: string): PartnerAnswer {
  return ans(null, cid, choice, text ?? null);
}

function baseInput(overrides: Partial<AnalysisInput> = {}): AnalysisInput {
  return {
    session: { stage: "engaged", culturalContextSlug: "universal" },
    partnerAUserId: "user-a",
    partnerBUserId: "user-b",
    answersA: [],
    answersB: [],
    designationsA: { finance: "core", parenting: "core", housing: "flexible" },
    designationsB: { finance: "flexible", parenting: "core", housing: "flexible" },
    bankQuestions: [],
    customQuestions: [],
    categories: CATS,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// analyzeSession — classification routing
// ---------------------------------------------------------------------------

describe("analyzeSession — classification routing", () => {
  it("routes ALIGNED to alignment.by_category", () => {
    const input = baseInput({
      bankQuestions: [q("q1", "finance")],
      answersA: [bankAns("q1", "fully_on_board")],
      answersB: [bankAns("q1", "fully_on_board")],
    });
    const result = analyzeSession(input);
    expect(result.dealbreaker_flags).toHaveLength(0);
    expect(result.tensions).toHaveLength(0);
    expect(result.summary.aligned).toBe(1);
    expect(result.alignment.by_category[0]).toMatchObject({ category: "finance", aligned_count: 1, total: 1 });
  });

  it("routes ALIGNED_SHARED to alignment.shared_dealbreakers and counts as aligned in by_category", () => {
    const input = baseInput({
      bankQuestions: [q("q1", "finance")],
      answersA: [bankAns("q1", "dealbreaker")],
      answersB: [bankAns("q1", "dealbreaker")],
    });
    const result = analyzeSession(input);
    expect(result.alignment.shared_dealbreakers).toHaveLength(1);
    expect(result.alignment.shared_dealbreakers[0].question_id).toBe("q1");
    expect(result.alignment.by_category[0]).toMatchObject({ aligned_count: 1, total: 1 });
    expect(result.summary.shared_dealbreakers).toBe(1);
    // ALIGNED_SHARED does NOT increment summary.aligned
    expect(result.summary.aligned).toBe(0);
  });

  it("routes DEALBREAKER_FLAG to dealbreaker_flags", () => {
    const input = baseInput({
      bankQuestions: [q("q1", "finance")],
      answersA: [bankAns("q1", "dealbreaker")],
      answersB: [bankAns("q1", "fully_on_board")],
    });
    const result = analyzeSession(input);
    expect(result.dealbreaker_flags).toHaveLength(1);
    expect(result.dealbreaker_flags[0]).toMatchObject({
      question_id: "q1",
      category: "finance",
      is_core: true, // finance is core for A
      partner_a: { choice: "dealbreaker", compromise_text: null },
      partner_b: { choice: "fully_on_board", compromise_text: null },
    });
  });

  it("routes TENSION to tensions with elevated=false", () => {
    const input = baseInput({
      bankQuestions: [q("q1", "housing")],
      answersA: [bankAns("q1", "open_to_discussing", "we could rent first")],
      answersB: [bankAns("q1", "fully_on_board")],
    });
    const result = analyzeSession(input);
    expect(result.tensions).toHaveLength(1);
    expect(result.tensions[0]).toMatchObject({
      elevated: false,
      partner_a: { choice: "open_to_discussing", compromise_text: "we could rent first" },
    });
  });

  it("routes TENSION_ELEVATED to tensions with elevated=true", () => {
    const input = baseInput({
      bankQuestions: [q("q1", "housing")],
      answersA: [bankAns("q1", "open_to_discussing", "maybe one day")],
      answersB: [bankAns("q1", "dealbreaker")],
    });
    const result = analyzeSession(input);
    expect(result.tensions).toHaveLength(1);
    expect(result.tensions[0].elevated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// analyzeSession — ordering rules
// ---------------------------------------------------------------------------

describe("analyzeSession — ordering rules", () => {
  it("elevated tensions rank above ordinary tensions", () => {
    const input = baseInput({
      bankQuestions: [
        q("q1", "housing", 1), // ordinary tension — housing is flexible for both
        q("q2", "housing", 2), // elevated tension
      ],
      answersA: [
        bankAns("q1", "open_to_discussing", "negotiable"),
        bankAns("q2", "open_to_discussing", "maybe"),
      ],
      answersB: [
        bankAns("q1", "fully_on_board"),
        bankAns("q2", "dealbreaker"),
      ],
    });
    const result = analyzeSession(input);
    expect(result.tensions[0].question_id).toBe("q2"); // elevated first
    expect(result.tensions[1].question_id).toBe("q1");
  });

  it("core categories rank above flexible at the same severity level", () => {
    // Two ordinary tensions: one in core category (finance), one in flexible (housing)
    const input = baseInput({
      bankQuestions: [
        q("qf", "housing", 1), // flexible
        q("qc", "finance", 2), // core for A, so effectively core
      ],
      answersA: [
        bankAns("qf", "open_to_discussing", "maybe"),
        bankAns("qc", "open_to_discussing", "let's discuss"),
      ],
      answersB: [
        bankAns("qf", "fully_on_board"),
        bankAns("qc", "fully_on_board"),
      ],
    });
    const result = analyzeSession(input);
    expect(result.tensions[0].question_id).toBe("qc"); // core first
    expect(result.tensions[1].question_id).toBe("qf");
  });

  it("within same severity and core, orders by category displayOrder then question displayOrder", () => {
    const input = baseInput({
      bankQuestions: [
        q("qb", "housing", 2), // housing displayOrder=3
        q("qa", "housing", 1), // housing displayOrder=3, lower question order
      ],
      answersA: [
        bankAns("qb", "open_to_discussing", "t"),
        bankAns("qa", "open_to_discussing", "t"),
      ],
      answersB: [
        bankAns("qb", "fully_on_board"),
        bankAns("qa", "fully_on_board"),
      ],
    });
    const result = analyzeSession(input);
    expect(result.tensions[0].question_id).toBe("qa"); // lower displayOrder first
    expect(result.tensions[1].question_id).toBe("qb");
  });

  it("core first in dealbreaker_flags", () => {
    const input = baseInput({
      bankQuestions: [
        q("qh", "housing", 1), // flexible
        q("qf", "finance", 2), // core
      ],
      answersA: [
        bankAns("qh", "dealbreaker"),
        bankAns("qf", "dealbreaker"),
      ],
      answersB: [
        bankAns("qh", "fully_on_board"),
        bankAns("qf", "fully_on_board"),
      ],
    });
    const result = analyzeSession(input);
    expect(result.dealbreaker_flags[0].question_id).toBe("qf"); // core first
    expect(result.dealbreaker_flags[1].question_id).toBe("qh");
  });
});

// ---------------------------------------------------------------------------
// analyzeSession — custom questions
// ---------------------------------------------------------------------------

describe("analyzeSession — custom questions", () => {
  it("custom questions appear in custom_questions, not main sections", () => {
    const input = baseInput({
      customQuestions: [{ id: "cq1", categorySlug: "personal", text: "Custom Q", displayOrder: 0 }],
      answersA: [customAns("cq1", "dealbreaker")],
      answersB: [customAns("cq1", "fully_on_board")],
    });
    const result = analyzeSession(input);
    expect(result.dealbreaker_flags).toHaveLength(0);
    expect(result.custom_questions.dealbreaker_flags).toHaveLength(1);
  });

  it("custom ALIGNED_SHARED goes to custom_questions.shared_dealbreakers only", () => {
    const input = baseInput({
      customQuestions: [{ id: "cq1", categorySlug: "personal", text: "C", displayOrder: 0 }],
      answersA: [customAns("cq1", "dealbreaker")],
      answersB: [customAns("cq1", "dealbreaker")],
    });
    const result = analyzeSession(input);
    expect(result.custom_questions.shared_dealbreakers).toHaveLength(1);
    expect(result.custom_questions.aligned).toHaveLength(0);
  });

  it("custom ALIGNED goes to custom_questions.aligned only", () => {
    const input = baseInput({
      customQuestions: [{ id: "cq1", categorySlug: "personal", text: "C", displayOrder: 0 }],
      answersA: [customAns("cq1", "fully_on_board")],
      answersB: [customAns("cq1", "fully_on_board")],
    });
    const result = analyzeSession(input);
    expect(result.custom_questions.aligned).toHaveLength(1);
    expect(result.custom_questions.shared_dealbreakers).toHaveLength(0);
  });

  it("custom TENSION_ELEVATED goes to custom_questions.tensions with elevated=true", () => {
    const input = baseInput({
      customQuestions: [{ id: "cq1", categorySlug: "personal", text: "C", displayOrder: 0 }],
      answersA: [customAns("cq1", "open_to_discussing", "maybe")],
      answersB: [customAns("cq1", "dealbreaker")],
    });
    const result = analyzeSession(input);
    expect(result.custom_questions.tensions[0].elevated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// analyzeSession — one-sided coverage (amendment 1)
// ---------------------------------------------------------------------------

describe("analyzeSession — one-sided coverage", () => {
  it("A-answered-only → coverage_notes with only_partner_a_answered", () => {
    const input = baseInput({
      bankQuestions: [q("q1", "finance")],
      answersA: [bankAns("q1", "fully_on_board")],
      answersB: [], // B never answered
    });
    const result = analyzeSession(input);
    expect(result.dealbreaker_flags).toHaveLength(0);
    expect(result.tensions).toHaveLength(0);
    expect(result.summary.total_questions).toBe(0);
    expect(result.coverage_notes).toHaveLength(1);
    expect(result.coverage_notes[0]).toMatchObject({
      reason: "only_partner_a_answered",
      excluded_question_ids: ["q1"],
    });
  });

  it("B-answered-only → coverage_notes with only_partner_b_answered", () => {
    const input = baseInput({
      bankQuestions: [q("q1", "finance")],
      answersA: [],
      answersB: [bankAns("q1", "dealbreaker")],
    });
    const result = analyzeSession(input);
    expect(result.coverage_notes[0]).toMatchObject({
      reason: "only_partner_b_answered",
      excluded_question_ids: ["q1"],
    });
  });

  it("neither answered → coverage_notes with neither_answered", () => {
    const input = baseInput({
      bankQuestions: [q("q1", "finance")],
      answersA: [],
      answersB: [],
    });
    const result = analyzeSession(input);
    expect(result.coverage_notes[0]).toMatchObject({
      reason: "neither_answered",
      excluded_question_ids: ["q1"],
    });
  });

  it("groups all A-only into one note", () => {
    const input = baseInput({
      bankQuestions: [q("q1", "finance"), q("q2", "housing")],
      answersA: [bankAns("q1", "fully_on_board"), bankAns("q2", "dealbreaker")],
      answersB: [],
    });
    const result = analyzeSession(input);
    expect(result.coverage_notes).toHaveLength(1);
    expect(result.coverage_notes[0].excluded_question_ids).toHaveLength(2);
  });

  it("separates A-only and B-only into distinct notes", () => {
    const input = baseInput({
      bankQuestions: [q("q1", "finance"), q("q2", "housing")],
      answersA: [bankAns("q1", "fully_on_board")], // q2 unanswered by A
      answersB: [bankAns("q2", "dealbreaker")],    // q1 unanswered by B
    });
    const result = analyzeSession(input);
    const reasons = result.coverage_notes.map((n) => n.reason);
    expect(reasons).toContain("only_partner_a_answered"); // q1
    expect(reasons).toContain("only_partner_b_answered"); // q2
    expect(result.summary.total_questions).toBe(0);
  });

  it("excluded questions are NOT included in summary totals", () => {
    const input = baseInput({
      bankQuestions: [q("q1", "finance"), q("q2", "housing")],
      answersA: [bankAns("q1", "fully_on_board"), bankAns("q2", "fully_on_board")],
      answersB: [bankAns("q1", "fully_on_board")], // q2 unanswered by B
    });
    const result = analyzeSession(input);
    expect(result.summary.total_questions).toBe(1); // only q1 classified
    expect(result.summary.aligned).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// analyzeSession — edge cases
// ---------------------------------------------------------------------------

describe("analyzeSession — edge cases", () => {
  it("all aligned — no flags or tensions", () => {
    const input = baseInput({
      bankQuestions: [q("q1", "finance"), q("q2", "parenting")],
      answersA: [bankAns("q1", "fully_on_board"), bankAns("q2", "fully_on_board")],
      answersB: [bankAns("q1", "fully_on_board"), bankAns("q2", "fully_on_board")],
    });
    const result = analyzeSession(input);
    expect(result.dealbreaker_flags).toHaveLength(0);
    expect(result.tensions).toHaveLength(0);
    expect(result.summary.aligned).toBe(2);
  });

  it("all dealbreaker flags", () => {
    const input = baseInput({
      bankQuestions: [q("q1", "finance")],
      answersA: [bankAns("q1", "dealbreaker")],
      answersB: [bankAns("q1", "fully_on_board")],
    });
    const result = analyzeSession(input);
    expect(result.dealbreaker_flags).toHaveLength(1);
    expect(result.summary.dealbreaker_flags).toBe(1);
    expect(result.summary.aligned).toBe(0);
  });

  it("empty answer sets — no classifications, no coverage notes", () => {
    const input = baseInput({ bankQuestions: [], answersA: [], answersB: [] });
    const result = analyzeSession(input);
    expect(result.summary.total_questions).toBe(0);
    expect(result.coverage_notes).toHaveLength(0);
    expect(result.dealbreaker_flags).toHaveLength(0);
  });

  it("summary counts add up: aligned + shared_dealbreakers + tensions + dealbreaker_flags = total", () => {
    const input = baseInput({
      bankQuestions: [
        q("q1", "finance"),   // ALIGNED
        q("q2", "finance"),   // ALIGNED_SHARED
        q("q3", "parenting"), // TENSION
        q("q4", "parenting"), // DEALBREAKER_FLAG
      ],
      answersA: [
        bankAns("q1", "fully_on_board"),
        bankAns("q2", "dealbreaker"),
        bankAns("q3", "open_to_discussing", "we could talk"),
        bankAns("q4", "dealbreaker"),
      ],
      answersB: [
        bankAns("q1", "fully_on_board"),
        bankAns("q2", "dealbreaker"),
        bankAns("q3", "fully_on_board"),
        bankAns("q4", "fully_on_board"),
      ],
    });
    const result = analyzeSession(input);
    const { aligned, shared_dealbreakers, tensions, dealbreaker_flags, total_questions } = result.summary;
    expect(aligned + shared_dealbreakers + tensions + dealbreaker_flags).toBe(total_questions);
    expect(total_questions).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// analyzeSession — effective category designation
// ---------------------------------------------------------------------------

describe("analyzeSession — effective category designation", () => {
  it("is_core = true when only one partner designates core", () => {
    // A marks finance as core, B marks as flexible → effective = core
    const input = baseInput({
      bankQuestions: [q("q1", "finance")],
      answersA: [bankAns("q1", "open_to_discussing", "maybe")],
      answersB: [bankAns("q1", "fully_on_board")],
      designationsA: { finance: "core" },
      designationsB: { finance: "flexible" },
    });
    const result = analyzeSession(input);
    expect(result.tensions[0].is_core).toBe(true);
  });

  it("is_core = false when both designate flexible", () => {
    const input = baseInput({
      bankQuestions: [q("q1", "housing")],
      answersA: [bankAns("q1", "open_to_discussing", "t")],
      answersB: [bankAns("q1", "fully_on_board")],
      designationsA: { housing: "flexible" },
      designationsB: { housing: "flexible" },
    });
    const result = analyzeSession(input);
    expect(result.tensions[0].is_core).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// analyzeSession — snapshot test (realistic fixture)
// ---------------------------------------------------------------------------

describe("analyzeSession — snapshot", () => {
  it("produces a stable payload for a realistic fixture couple", () => {
    const input: AnalysisInput = {
      session: { stage: "engaged", culturalContextSlug: "universal" },
      partnerAUserId: "user-a",
      partnerBUserId: "user-b",
      answersA: [
        bankAns("fin-01", "fully_on_board"),
        bankAns("fin-02", "dealbreaker"),
        bankAns("fin-03", "open_to_discussing", "we could do 50/50 on savings"),
        bankAns("par-01", "fully_on_board"),
        bankAns("par-02", "dealbreaker"),
        bankAns("par-03", "open_to_discussing", "2 or 3 kids feels right"),
        bankAns("hou-01", "fully_on_board"),
        bankAns("hou-02", "dealbreaker"),
        bankAns("hou-03", "fully_on_board"),
        // hou-04 answered by A only (one-sided)
        bankAns("hou-04", "fully_on_board"),
        customAns("cq-01", "open_to_discussing", "let's set a shared goal"),
        customAns("cq-02", "dealbreaker"),
      ],
      answersB: [
        bankAns("fin-01", "fully_on_board"),
        bankAns("fin-02", "fully_on_board"),
        bankAns("fin-03", "fully_on_board"),
        bankAns("par-01", "open_to_discussing", "I could see us having 1"),
        bankAns("par-02", "dealbreaker"),
        bankAns("par-03", "dealbreaker"),
        bankAns("hou-01", "fully_on_board"),
        bankAns("hou-02", "open_to_discussing", "depends on the city"),
        bankAns("hou-03", "dealbreaker"),
        // hou-04 NOT answered by B
        customAns("cq-01", "fully_on_board"),
        customAns("cq-02", "dealbreaker"),
      ],
      designationsA: {
        finance: "core",
        parenting: "core",
        housing: "flexible",
      },
      designationsB: {
        finance: "flexible",
        parenting: "core",
        housing: "flexible",
      },
      bankQuestions: [
        { id: "fin-01", categorySlug: "finance", text: "How do you feel about joint finances?", displayOrder: 1 },
        { id: "fin-02", categorySlug: "finance", text: "Would you prenup?", displayOrder: 2 },
        { id: "fin-03", categorySlug: "finance", text: "How much should we save monthly?", displayOrder: 3 },
        { id: "par-01", categorySlug: "parenting", text: "Do you want children?", displayOrder: 1 },
        { id: "par-02", categorySlug: "parenting", text: "Would you adopt?", displayOrder: 2 },
        { id: "par-03", categorySlug: "parenting", text: "How many children?", displayOrder: 3 },
        { id: "hou-01", categorySlug: "housing", text: "Own or rent?", displayOrder: 1 },
        { id: "hou-02", categorySlug: "housing", text: "City or suburb?", displayOrder: 2 },
        { id: "hou-03", categorySlug: "housing", text: "Move for a job?", displayOrder: 3 },
        { id: "hou-04", categorySlug: "housing", text: "Beach or mountains?", displayOrder: 4 },
      ],
      customQuestions: [
        { id: "cq-01", categorySlug: "personal", text: "How do you feel about our spending habits?", displayOrder: 1 },
        { id: "cq-02", categorySlug: "personal", text: "Would you give up your career for family?", displayOrder: 2 },
      ],
      categories: [
        { slug: "finance", displayOrder: 1 },
        { slug: "parenting", displayOrder: 2 },
        { slug: "housing", displayOrder: 3 },
        { slug: "personal", displayOrder: 99 },
      ],
    };

    const result = analyzeSession(input);

    // Strip generated_at before snapshotting (it's time-dependent)
    const { generated_at: _, ...stable } = result;
    expect(stable).toMatchSnapshot();
  });
});

/**
 * Beforehand — pure compatibility analysis engine.
 *
 * Input: both partners' answers, designations, questions (all pre-fetched).
 * Output: structured ReportPayload (shape matches references/analysis-logic.md).
 *
 * No DB, no side-effects. All business logic here is unit-testable in isolation.
 */

export type AnswerChoice = "fully_on_board" | "open_to_discussing" | "dealbreaker";

export interface PartnerAnswer {
  questionId: string | null;
  customQuestionId: string | null;
  choice: AnswerChoice;
  compromiseText: string | null;
}

export interface QuestionRecord {
  id: string;
  categorySlug: string; // "personal" sentinel for custom questions with null DB category
  text: string;
  displayOrder: number;
  partnerView?: string | null;
}

export interface CategoryRecord {
  slug: string;
  displayOrder: number;
}

export interface SpotlightRef {
  questionId?: string | null;
  customQuestionId?: string | null;
}

export interface AnalysisInput {
  session: { stage: string; culturalContextSlug: string };
  partnerAUserId: string; // session.createdByUserId
  partnerBUserId: string; // session.partnerUserId
  answersA: PartnerAnswer[];
  answersB: PartnerAnswer[];
  designationsA: Record<string, "core" | "flexible">;
  designationsB: Record<string, "core" | "flexible">;
  bankQuestions: QuestionRecord[]; // pre-filtered to session stage + context
  customQuestions: QuestionRecord[];
  categories: CategoryRecord[];
  spotlightsA?: SpotlightRef[];
  spotlightsB?: SpotlightRef[];
}

// ---------------------------------------------------------------------------
// Payload types (stored as JSONB; rendered verbatim)
// ---------------------------------------------------------------------------

export interface PartnerAnswerEntry {
  choice: AnswerChoice;
  compromise_text: string | null;
}

export interface DealbreakerFlagEntry {
  question_id: string;
  question_text: string;
  category: string;
  is_core: boolean;
  partner_a: PartnerAnswerEntry;
  partner_b: PartnerAnswerEntry;
  partner_view_template?: string | null;
}

export interface TensionEntry {
  question_id: string;
  question_text: string;
  category: string;
  is_core: boolean;
  elevated: boolean;
  partner_a: PartnerAnswerEntry;
  partner_b: PartnerAnswerEntry;
  partner_view_template?: string | null;
}

export interface SpotlightEntry {
  question_id: string;
  question_text: string;
  category: string;
  is_custom: boolean;
  partner_a: PartnerAnswerEntry | null;
  partner_b: PartnerAnswerEntry | null;
}

export interface AlignedEntry {
  question_id: string;
  question_text: string;
}

export interface CategoryAlignmentSummary {
  category: string;
  aligned_count: number;
  total: number;
}

export interface CoverageNote {
  excluded_question_ids: string[];
  reason:
    | "only_partner_a_answered"
    | "only_partner_b_answered"
    | "neither_answered";
}

export interface ReportPayload {
  generated_at: string;
  session: { stage: string; cultural_context: string };
  summary: {
    /** Classified bank questions only (both partners answered). */
    total_questions: number;
    aligned: number;
    shared_dealbreakers: number;
    tensions: number;
    dealbreaker_flags: number;
    /** Category slugs where either partner designated "core". */
    core_categories: string[];
  };
  dealbreaker_flags: DealbreakerFlagEntry[];
  tensions: TensionEntry[];
  alignment: {
    by_category: CategoryAlignmentSummary[];
    shared_dealbreakers: AlignedEntry[];
  };
  /** Custom questions classified the same way, listed separately. */
  custom_questions: {
    dealbreaker_flags: DealbreakerFlagEntry[];
    tensions: TensionEntry[];
    aligned: AlignedEntry[];
    shared_dealbreakers: AlignedEntry[];
  };
  /**
   * Questions excluded from classification because only one or neither
   * partner answered them (e.g. deactivated mid-session).
   */
  coverage_notes: CoverageNote[];
  /** Questions each partner flagged as "this matters to me". Both partners'
   *  spotlights are included; rendered at the top of the report. Optional
   *  so existing payloads without this field render gracefully. */
  spotlights?: {
    partner_a: SpotlightEntry[];
    partner_b: SpotlightEntry[];
  };
}

// ---------------------------------------------------------------------------
// Classification — 3×3 matrix (analysis-logic.md)
// ---------------------------------------------------------------------------

type Classification =
  | "ALIGNED"
  | "ALIGNED_SHARED" // both dealbreaker — they agree on a boundary
  | "DEALBREAKER_FLAG" // one dealbreaker + other fully_on_board
  | "TENSION"
  | "TENSION_ELEVATED"; // one dealbreaker + other open_to_discussing

export function classifyPair(
  choiceA: AnswerChoice,
  choiceB: AnswerChoice,
): Classification {
  if (choiceA === "fully_on_board" && choiceB === "fully_on_board") return "ALIGNED";
  if (choiceA === "dealbreaker" && choiceB === "dealbreaker") return "ALIGNED_SHARED";
  if (
    (choiceA === "dealbreaker" && choiceB === "fully_on_board") ||
    (choiceA === "fully_on_board" && choiceB === "dealbreaker")
  )
    return "DEALBREAKER_FLAG";
  if (
    (choiceA === "open_to_discussing" && choiceB === "dealbreaker") ||
    (choiceA === "dealbreaker" && choiceB === "open_to_discussing")
  )
    return "TENSION_ELEVATED";
  // open/open, open/fully_on_board, fully_on_board/open_to_discussing
  return "TENSION";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Core if either partner designated the category as core. */
function effectivelyCore(
  categorySlug: string,
  designationsA: Record<string, "core" | "flexible">,
  designationsB: Record<string, "core" | "flexible">,
): boolean {
  return (
    designationsA[categorySlug] === "core" ||
    designationsB[categorySlug] === "core"
  );
}

function sortFlags(
  arr: DealbreakerFlagEntry[],
  catOrderMap: Map<string, number>,
  qOrderMap: Map<string, number>,
): DealbreakerFlagEntry[] {
  return [...arr].sort((a, b) => {
    if (a.is_core !== b.is_core) return a.is_core ? -1 : 1;
    const catDiff =
      (catOrderMap.get(a.category) ?? 999) -
      (catOrderMap.get(b.category) ?? 999);
    if (catDiff !== 0) return catDiff;
    return (
      (qOrderMap.get(a.question_id) ?? 999) -
      (qOrderMap.get(b.question_id) ?? 999)
    );
  });
}

function sortTensions(
  arr: TensionEntry[],
  catOrderMap: Map<string, number>,
  qOrderMap: Map<string, number>,
): TensionEntry[] {
  return [...arr].sort((a, b) => {
    // Severity desc: elevated(2) before tension(1)
    const sevDiff = (b.elevated ? 2 : 1) - (a.elevated ? 2 : 1);
    if (sevDiff !== 0) return sevDiff;
    // Core first
    if (a.is_core !== b.is_core) return a.is_core ? -1 : 1;
    const catDiff =
      (catOrderMap.get(a.category) ?? 999) -
      (catOrderMap.get(b.category) ?? 999);
    if (catDiff !== 0) return catDiff;
    return (
      (qOrderMap.get(a.question_id) ?? 999) -
      (qOrderMap.get(b.question_id) ?? 999)
    );
  });
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function analyzeSession(input: AnalysisInput): ReportPayload {
  const {
    session,
    answersA,
    answersB,
    designationsA,
    designationsB,
    bankQuestions,
    customQuestions,
    categories,
    spotlightsA = [],
    spotlightsB = [],
  } = input;

  // Answer lookup — keyed by questionId (bank) or customQuestionId (custom)
  const mapA = new Map<string, PartnerAnswer>(
    answersA.map((a) => [a.questionId ?? a.customQuestionId!, a]),
  );
  const mapB = new Map<string, PartnerAnswer>(
    answersB.map((b) => [b.questionId ?? b.customQuestionId!, b]),
  );

  const catOrderMap = new Map(categories.map((c) => [c.slug, c.displayOrder]));
  const qOrderMap = new Map<string, number>([
    ...bankQuestions.map((q) => [q.id, q.displayOrder] as [string, number]),
    ...customQuestions.map((q) => [q.id, q.displayOrder] as [string, number]),
  ]);

  // Coverage exclusion buckets
  const onlyAIds: string[] = [];
  const onlyBIds: string[] = [];
  const neitherIds: string[] = [];

  // Bank question result buckets
  const bankFlags: DealbreakerFlagEntry[] = [];
  const bankTensions: TensionEntry[] = [];
  const bankSharedDealbreakers: AlignedEntry[] = [];
  const catStats = new Map<string, { aligned: number; total: number }>();
  let bankAlignedCount = 0;

  // Custom question result buckets
  const customFlags: DealbreakerFlagEntry[] = [];
  const customTensions: TensionEntry[] = [];
  const customAligned: AlignedEntry[] = [];
  const customSharedDealbreakers: AlignedEntry[] = [];

  function processQuestion(q: QuestionRecord, isCustom: boolean): void {
    const ansA = mapA.get(q.id);
    const ansB = mapB.get(q.id);

    if (!ansA && !ansB) {
      neitherIds.push(q.id);
      return;
    }
    if (ansA && !ansB) {
      onlyAIds.push(q.id);
      return;
    }
    if (!ansA && ansB) {
      onlyBIds.push(q.id);
      return;
    }

    const cls = classifyPair(ansA!.choice, ansB!.choice);
    const core = effectivelyCore(q.categorySlug, designationsA, designationsB);
    const entryA: PartnerAnswerEntry = {
      choice: ansA!.choice,
      compromise_text: ansA!.compromiseText,
    };
    const entryB: PartnerAnswerEntry = {
      choice: ansB!.choice,
      compromise_text: ansB!.compromiseText,
    };

    if (isCustom) {
      if (cls === "ALIGNED") {
        customAligned.push({ question_id: q.id, question_text: q.text });
      } else if (cls === "ALIGNED_SHARED") {
        customSharedDealbreakers.push({ question_id: q.id, question_text: q.text });
      } else if (cls === "DEALBREAKER_FLAG") {
        customFlags.push({
          question_id: q.id,
          question_text: q.text,
          category: q.categorySlug,
          is_core: core,
          partner_a: entryA,
          partner_b: entryB,
          partner_view_template: q.partnerView ?? null,
        });
      } else {
        customTensions.push({
          question_id: q.id,
          question_text: q.text,
          category: q.categorySlug,
          is_core: core,
          elevated: cls === "TENSION_ELEVATED",
          partner_a: entryA,
          partner_b: entryB,
          partner_view_template: q.partnerView ?? null,
        });
      }
      return;
    }

    // Bank question — update catStats
    const stats = catStats.get(q.categorySlug) ?? { aligned: 0, total: 0 };
    stats.total++;

    if (cls === "ALIGNED") {
      stats.aligned++;
      bankAlignedCount++;
    } else if (cls === "ALIGNED_SHARED") {
      stats.aligned++; // shared non-negotiables count as aligned in the by_category view
      bankSharedDealbreakers.push({ question_id: q.id, question_text: q.text });
    } else if (cls === "DEALBREAKER_FLAG") {
      bankFlags.push({
        question_id: q.id,
        question_text: q.text,
        category: q.categorySlug,
        is_core: core,
        partner_a: entryA,
        partner_b: entryB,
        partner_view_template: q.partnerView ?? null,
      });
    } else {
      bankTensions.push({
        question_id: q.id,
        question_text: q.text,
        category: q.categorySlug,
        is_core: core,
        elevated: cls === "TENSION_ELEVATED",
        partner_a: entryA,
        partner_b: entryB,
        partner_view_template: q.partnerView ?? null,
      });
    }

    catStats.set(q.categorySlug, stats);
  }

  for (const q of bankQuestions) processQuestion(q, false);
  for (const q of customQuestions) processQuestion(q, true);

  // Sort
  const sortedBankFlags = sortFlags(bankFlags, catOrderMap, qOrderMap);
  const sortedBankTensions = sortTensions(bankTensions, catOrderMap, qOrderMap);
  const sortedCustomFlags = sortFlags(customFlags, catOrderMap, qOrderMap);
  const sortedCustomTensions = sortTensions(customTensions, catOrderMap, qOrderMap);

  // Coverage notes — one entry per reason, omitted when empty
  const coverageNotes: CoverageNote[] = [];
  if (onlyAIds.length > 0)
    coverageNotes.push({ excluded_question_ids: onlyAIds, reason: "only_partner_a_answered" });
  if (onlyBIds.length > 0)
    coverageNotes.push({ excluded_question_ids: onlyBIds, reason: "only_partner_b_answered" });
  if (neitherIds.length > 0)
    coverageNotes.push({ excluded_question_ids: neitherIds, reason: "neither_answered" });

  // Core categories — any category where either partner designated "core"
  const allCategorySlugs = new Set(bankQuestions.map((q) => q.categorySlug));
  const coreCategories = [...allCategorySlugs].filter((slug) =>
    effectivelyCore(slug, designationsA, designationsB),
  );

  const totalClassified =
    bankAlignedCount +
    bankSharedDealbreakers.length +
    bankTensions.length +
    bankFlags.length;

  // Spotlight entries — both partners' "this matters to me" questions
  const allQuestions = [...bankQuestions, ...customQuestions];
  function buildSpotlightEntry(ref: SpotlightRef): SpotlightEntry | null {
    const qid = ref.questionId ?? null;
    const cqid = ref.customQuestionId ?? null;
    const lookupKey = qid ?? cqid;
    if (!lookupKey) return null;
    const q = allQuestions.find((aq) => aq.id === lookupKey);
    if (!q) return null;
    const ansA = mapA.get(lookupKey);
    const ansB = mapB.get(lookupKey);
    return {
      question_id: q.id,
      question_text: q.text,
      category: q.categorySlug,
      is_custom: Boolean(cqid),
      partner_a: ansA ? { choice: ansA.choice, compromise_text: ansA.compromiseText } : null,
      partner_b: ansB ? { choice: ansB.choice, compromise_text: ansB.compromiseText } : null,
    };
  }

  const spotlightEntriesA = spotlightsA
    .map(buildSpotlightEntry)
    .filter((e): e is SpotlightEntry => e !== null);
  const spotlightEntriesB = spotlightsB
    .map(buildSpotlightEntry)
    .filter((e): e is SpotlightEntry => e !== null);

  return {
    generated_at: new Date().toISOString(),
    session: { stage: session.stage, cultural_context: session.culturalContextSlug },
    summary: {
      total_questions: totalClassified,
      aligned: bankAlignedCount,
      shared_dealbreakers: bankSharedDealbreakers.length,
      tensions: bankTensions.length,
      dealbreaker_flags: bankFlags.length,
      core_categories: coreCategories,
    },
    dealbreaker_flags: sortedBankFlags,
    tensions: sortedBankTensions,
    alignment: {
      by_category: [...catStats.entries()].map(([category, { aligned, total }]) => ({
        category,
        aligned_count: aligned,
        total,
      })),
      shared_dealbreakers: bankSharedDealbreakers,
    },
    custom_questions: {
      dealbreaker_flags: sortedCustomFlags,
      tensions: sortedCustomTensions,
      aligned: customAligned,
      shared_dealbreakers: customSharedDealbreakers,
    },
    coverage_notes: coverageNotes,
    spotlights: {
      partner_a: spotlightEntriesA,
      partner_b: spotlightEntriesB,
    },
  };
}

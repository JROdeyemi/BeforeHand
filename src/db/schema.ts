/**
 * Beforehand — database schema.
 *
 * Mirrors references/domain-model.md in the beforehand-app skill.
 * Invariant-critical tables are marked; read src/db/guards.ts before
 * writing ANY query that touches `answers` or `reports`.
 */
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

/* ----------------------------- enums ----------------------------- */

export const relationshipStageEnum = pgEnum("relationship_stage", [
  "early_dating",
  "dating",
  "engaged",
  "married",
]);

export const sessionStatusEnum = pgEnum("couple_session_status", [
  "draft",
  "invited",
  "active",
  "report_ready",
  "closed",
]);

export const answerChoiceEnum = pgEnum("answer_choice", [
  "fully_on_board",
  "open_to_discussing",
  "dealbreaker",
]);

export const designationEnum = pgEnum("category_designation", [
  "core",
  "flexible",
]);

export const channelEnum = pgEnum("message_channel", ["email", "sms"]);

/* ------------------------ auth (Auth.js) -------------------------- */

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  phone: text("phone"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const authSessions = pgTable("auth_session", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_token",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* --------------------------- content ------------------------------ */

export const culturalContexts = pgTable("cultural_context", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
});

export const categories = pgTable("category", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  displayOrder: integer("display_order").notNull(),
  icon: text("icon"),
  description: text("description"),
});

/**
 * Questions are data, never code. Stable `id` slugs (e.g. "fin-012") —
 * never renumbered, never deleted once answers exist; retire with
 * isActive=false. See references/question-bank.md.
 */
export const questions = pgTable(
  "question",
  {
    id: text("id").primaryKey(),
    categorySlug: text("category_slug")
      .notNull()
      .references(() => categories.slug),
    text: text("text").notNull(),
    stages: relationshipStageEnum("stages").array().notNull(),
    /** Cultural context slugs this question targets; empty = universal. */
    contexts: text("contexts").array().notNull().default(sql`'{}'::text[]`),
    displayOrder: integer("display_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    /** Optional reframing for the partner's perspective in the report.
     *  Supports {name}, {their}, {them} placeholders. */
    partnerView: text("partner_view"),
  },
  (t) => [index("question_category_idx").on(t.categorySlug)],
);

/* --------------------------- sessions ----------------------------- */

export const coupleSessions = pgTable("couple_session", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => users.id),
  partnerUserId: text("partner_user_id").references(() => users.id),
  relationshipStage: relationshipStageEnum("relationship_stage").notNull(),
  culturalContextSlug: text("cultural_context_slug")
    .notNull()
    .references(() => culturalContexts.slug),
  status: sessionStatusEnum("status").notNull().default("draft"),
  reportGeneratedAt: timestamp("report_generated_at", { mode: "date" }),
  closedAt: timestamp("closed_at", { mode: "date" }),
  closedByUserId: text("closed_by_user_id").references(() => users.id),
  /** Married-stage retake reminder; set when a married report generates. */
  nextRetakeReminderAt: timestamp("next_retake_reminder_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const invitations = pgTable(
  "invitation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text("session_id")
      .notNull()
      .references(() => coupleSessions.id, { onDelete: "cascade" }),
    invitedEmail: text("invited_email").notNull(),
    /** Single-use, unguessable (see src/lib/tokens.ts). Never expires —
     *  sessions never expire — but is consumed on acceptance. */
    token: text("token").notNull().unique(),
    channel: channelEnum("channel").notNull().default("email"),
    sentAt: timestamp("sent_at", { mode: "date" }).notNull().defaultNow(),
    acceptedAt: timestamp("accepted_at", { mode: "date" }),
    acceptedByUserId: text("accepted_by_user_id").references(() => users.id),
  },
  (t) => [index("invitation_session_idx").on(t.sessionId)],
);

export const customQuestions = pgTable(
  "custom_question",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text("session_id")
      .notNull()
      .references(() => coupleSessions.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => users.id),
    categorySlug: text("category_slug").references(() => categories.slug),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("custom_question_session_idx").on(t.sessionId)],
);

export const categoryDesignations = pgTable(
  "category_designation_choice",
  {
    sessionId: text("session_id")
      .notNull()
      .references(() => coupleSessions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    categorySlug: text("category_slug")
      .notNull()
      .references(() => categories.slug),
    designation: designationEnum("designation").notNull(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.userId, t.categorySlug] })],
);

/* ---------------------------- answers ----------------------------- */

/**
 * ⚠️ INVARIANT-CRITICAL TABLE.
 * A row here must NEVER be readable by any user other than its author
 * while the session is not report_ready. All reads go through
 * src/db/guards.ts — do not query this table directly from routes.
 */
export const answers = pgTable(
  "answer",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text("session_id")
      .notNull()
      .references(() => coupleSessions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    questionId: text("question_id").references(() => questions.id),
    customQuestionId: text("custom_question_id").references(
      () => customQuestions.id,
    ),
    choice: answerChoiceEnum("choice").notNull(),
    /** Required when choice = open_to_discussing; the partner's proposed
     *  compromise, quoted verbatim in the report. NEVER log this field. */
    compromiseText: text("compromise_text"),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("answer_bank_unique")
      .on(t.sessionId, t.userId, t.questionId)
      .where(sql`${t.questionId} IS NOT NULL`),
    uniqueIndex("answer_custom_unique")
      .on(t.sessionId, t.userId, t.customQuestionId)
      .where(sql`${t.customQuestionId} IS NOT NULL`),
    check(
      "answer_exactly_one_question",
      sql`num_nonnulls(${t.questionId}, ${t.customQuestionId}) = 1`,
    ),
    check(
      "answer_compromise_iff_open",
      sql`(${t.choice} = 'open_to_discussing') = (${t.compromiseText} IS NOT NULL AND length(btrim(${t.compromiseText})) > 0)`,
    ),
    index("answer_session_user_idx").on(t.sessionId, t.userId),
  ],
);

/** Submitting locks a partner's answers; second submission triggers
 *  report generation + transition to report_ready (atomically). */
export const submissions = pgTable(
  "submission",
  {
    sessionId: text("session_id")
      .notNull()
      .references(() => coupleSessions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    submittedAt: timestamp("submitted_at", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.userId] })],
);

export const nudges = pgTable("nudge", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  sessionId: text("session_id")
    .notNull()
    .references(() => coupleSessions.id, { onDelete: "cascade" }),
  fromUserId: text("from_user_id")
    .notNull()
    .references(() => users.id),
  /** Preset key (e.g. "your_move") or free text. Must never contain or
   *  reference answer content or per-category progress. */
  message: text("message").notNull(),
  channel: channelEnum("channel").notNull().default("email"),
  sentAt: timestamp("sent_at", { mode: "date" }).notNull().defaultNow(),
});

/* ---------------------------- report ------------------------------ */

/**
 * ⚠️ INVARIANT-CRITICAL TABLE.
 * Generated once, when the second submission lands; session-level
 * availability (never per-user). Payload shape: references/analysis-logic.md.
 */
export const reports = pgTable("report", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  sessionId: text("session_id")
    .notNull()
    .unique()
    .references(() => coupleSessions.id, { onDelete: "cascade" }),
  generatedAt: timestamp("generated_at", { mode: "date" }).notNull().defaultNow(),
  payload: jsonb("payload").notNull(),
});

/* -------------------------- spotlights ---------------------------- */

/**
 * ⚠️ INVARIANT-CRITICAL TABLE.
 * A spotlight row must NEVER be readable by any user other than its author
 * while the session is not report_ready. All cross-partner reads go through
 * src/db/guards.ts — do not query this table directly from routes.
 *
 * Partial unique indexes match the answer table pattern (answer_bank_unique /
 * answer_custom_unique) — one spotlight per (session, user, question).
 */
export const spotlights = pgTable(
  "spotlight",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text("session_id")
      .notNull()
      .references(() => coupleSessions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    questionId: text("question_id").references(() => questions.id),
    customQuestionId: text("custom_question_id").references(
      () => customQuestions.id,
    ),
    markedAt: timestamp("marked_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("spotlight_bank_unique")
      .on(t.sessionId, t.userId, t.questionId)
      .where(sql`${t.questionId} IS NOT NULL`),
    uniqueIndex("spotlight_custom_unique")
      .on(t.sessionId, t.userId, t.customQuestionId)
      .where(sql`${t.customQuestionId} IS NOT NULL`),
    check(
      "spotlight_exactly_one_question",
      sql`num_nonnulls(${t.questionId}, ${t.customQuestionId}) = 1`,
    ),
    index("spotlight_session_user_idx").on(t.sessionId, t.userId),
  ],
);

/* ----------------------- counselor sharing ------------------------ */

export const shareConsents = pgTable("share_consent", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  sessionId: text("session_id")
    .notNull()
    .references(() => coupleSessions.id, { onDelete: "cascade" }),
  counselorEmail: text("counselor_email").notNull(),
  requestedByUserId: text("requested_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  /** Set only after BOTH approvals exist and the send has happened. */
  sharedAt: timestamp("shared_at", { mode: "date" }),
});

/** One row per partner per share request. The share executes only when
 *  both partners' rows exist. One-sided consent shares (and reveals) nothing. */
export const shareConsentApprovals = pgTable(
  "share_consent_approval",
  {
    shareConsentId: text("share_consent_id")
      .notNull()
      .references(() => shareConsents.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    consentedAt: timestamp("consented_at", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.shareConsentId, t.userId] })],
);

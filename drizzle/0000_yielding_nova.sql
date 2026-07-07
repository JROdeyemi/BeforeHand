CREATE TYPE "public"."answer_choice" AS ENUM('fully_on_board', 'open_to_discussing', 'dealbreaker');--> statement-breakpoint
CREATE TYPE "public"."message_channel" AS ENUM('email', 'sms');--> statement-breakpoint
CREATE TYPE "public"."category_designation" AS ENUM('core', 'flexible');--> statement-breakpoint
CREATE TYPE "public"."relationship_stage" AS ENUM('early_dating', 'dating', 'engaged', 'married');--> statement-breakpoint
CREATE TYPE "public"."couple_session_status" AS ENUM('draft', 'invited', 'active', 'report_ready', 'closed');--> statement-breakpoint
CREATE TABLE "account" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "answer" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"question_id" text,
	"custom_question_id" text,
	"choice" "answer_choice" NOT NULL,
	"compromise_text" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "answer_exactly_one_question" CHECK (num_nonnulls("answer"."question_id", "answer"."custom_question_id") = 1),
	CONSTRAINT "answer_compromise_iff_open" CHECK (("answer"."choice" = 'open_to_discussing') = ("answer"."compromise_text" IS NOT NULL AND length(btrim("answer"."compromise_text")) > 0))
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"display_order" integer NOT NULL,
	"icon" text
);
--> statement-breakpoint
CREATE TABLE "category_designation_choice" (
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"category_slug" text NOT NULL,
	"designation" "category_designation" NOT NULL,
	CONSTRAINT "category_designation_choice_session_id_user_id_category_slug_pk" PRIMARY KEY("session_id","user_id","category_slug")
);
--> statement-breakpoint
CREATE TABLE "couple_session" (
	"id" text PRIMARY KEY NOT NULL,
	"created_by_user_id" text NOT NULL,
	"partner_user_id" text,
	"relationship_stage" "relationship_stage" NOT NULL,
	"cultural_context_slug" text NOT NULL,
	"status" "couple_session_status" DEFAULT 'draft' NOT NULL,
	"report_generated_at" timestamp,
	"closed_at" timestamp,
	"closed_by_user_id" text,
	"next_retake_reminder_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cultural_context" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_question" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"author_user_id" text NOT NULL,
	"category_slug" text,
	"text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"invited_email" text NOT NULL,
	"token" text NOT NULL,
	"channel" "message_channel" DEFAULT 'email' NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	"accepted_by_user_id" text,
	CONSTRAINT "invitation_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "nudge" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"from_user_id" text NOT NULL,
	"message" text NOT NULL,
	"channel" "message_channel" DEFAULT 'email' NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question" (
	"id" text PRIMARY KEY NOT NULL,
	"category_slug" text NOT NULL,
	"text" text NOT NULL,
	"stages" "relationship_stage"[] NOT NULL,
	"contexts" text[] DEFAULT '{}'::text[] NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "report_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "share_consent_approval" (
	"share_consent_id" text NOT NULL,
	"user_id" text NOT NULL,
	"consented_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "share_consent_approval_share_consent_id_user_id_pk" PRIMARY KEY("share_consent_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "share_consent" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"counselor_email" text NOT NULL,
	"requested_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"shared_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "submission" (
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "submission_session_id_user_id_pk" PRIMARY KEY("session_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp,
	"image" text,
	"phone" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_token" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_token_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer" ADD CONSTRAINT "answer_session_id_couple_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."couple_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer" ADD CONSTRAINT "answer_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer" ADD CONSTRAINT "answer_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer" ADD CONSTRAINT "answer_custom_question_id_custom_question_id_fk" FOREIGN KEY ("custom_question_id") REFERENCES "public"."custom_question"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_designation_choice" ADD CONSTRAINT "category_designation_choice_session_id_couple_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."couple_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_designation_choice" ADD CONSTRAINT "category_designation_choice_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_designation_choice" ADD CONSTRAINT "category_designation_choice_category_slug_category_slug_fk" FOREIGN KEY ("category_slug") REFERENCES "public"."category"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "couple_session" ADD CONSTRAINT "couple_session_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "couple_session" ADD CONSTRAINT "couple_session_partner_user_id_user_id_fk" FOREIGN KEY ("partner_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "couple_session" ADD CONSTRAINT "couple_session_cultural_context_slug_cultural_context_slug_fk" FOREIGN KEY ("cultural_context_slug") REFERENCES "public"."cultural_context"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "couple_session" ADD CONSTRAINT "couple_session_closed_by_user_id_user_id_fk" FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_question" ADD CONSTRAINT "custom_question_session_id_couple_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."couple_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_question" ADD CONSTRAINT "custom_question_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_question" ADD CONSTRAINT "custom_question_category_slug_category_slug_fk" FOREIGN KEY ("category_slug") REFERENCES "public"."category"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_session_id_couple_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."couple_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_accepted_by_user_id_user_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nudge" ADD CONSTRAINT "nudge_session_id_couple_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."couple_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nudge" ADD CONSTRAINT "nudge_from_user_id_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_category_slug_category_slug_fk" FOREIGN KEY ("category_slug") REFERENCES "public"."category"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_session_id_couple_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."couple_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_consent_approval" ADD CONSTRAINT "share_consent_approval_share_consent_id_share_consent_id_fk" FOREIGN KEY ("share_consent_id") REFERENCES "public"."share_consent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_consent_approval" ADD CONSTRAINT "share_consent_approval_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_consent" ADD CONSTRAINT "share_consent_session_id_couple_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."couple_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_consent" ADD CONSTRAINT "share_consent_requested_by_user_id_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_session_id_couple_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."couple_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "answer_bank_unique" ON "answer" USING btree ("session_id","user_id","question_id") WHERE "answer"."question_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "answer_custom_unique" ON "answer" USING btree ("session_id","user_id","custom_question_id") WHERE "answer"."custom_question_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "answer_session_user_idx" ON "answer" USING btree ("session_id","user_id");--> statement-breakpoint
CREATE INDEX "custom_question_session_idx" ON "custom_question" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "invitation_session_idx" ON "invitation" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "question_category_idx" ON "question" USING btree ("category_slug");
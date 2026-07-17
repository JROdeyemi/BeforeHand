CREATE TABLE "spotlight" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"question_id" text,
	"custom_question_id" text,
	"marked_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "spotlight_exactly_one_question" CHECK (num_nonnulls("spotlight"."question_id", "spotlight"."custom_question_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "partner_view" text;--> statement-breakpoint
ALTER TABLE "spotlight" ADD CONSTRAINT "spotlight_session_id_couple_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."couple_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotlight" ADD CONSTRAINT "spotlight_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotlight" ADD CONSTRAINT "spotlight_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotlight" ADD CONSTRAINT "spotlight_custom_question_id_custom_question_id_fk" FOREIGN KEY ("custom_question_id") REFERENCES "public"."custom_question"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "spotlight_bank_unique" ON "spotlight" USING btree ("session_id","user_id","question_id") WHERE "spotlight"."question_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "spotlight_custom_unique" ON "spotlight" USING btree ("session_id","user_id","custom_question_id") WHERE "spotlight"."custom_question_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "spotlight_session_user_idx" ON "spotlight" USING btree ("session_id","user_id");
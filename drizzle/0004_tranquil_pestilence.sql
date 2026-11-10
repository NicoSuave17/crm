CREATE TYPE "public"."gatekeeper_operation" AS ENUM('create', 'update', 'merge', 'bulk_update');--> statement-breakpoint
CREATE TYPE "public"."gatekeeper_source" AS ENUM('form', 'import', 'bulk', 'merge', 'api');--> statement-breakpoint
CREATE TYPE "public"."gatekeeper_zone" AS ENUM('auto_apply', 'review', 'reject', 'bypassed');--> statement-breakpoint
CREATE TYPE "public"."import_job_status" AS ENUM('pending', 'processing', 'complete', 'failed');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending_review', 'approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."survivorship_strategy" AS ENUM('most_recent', 'most_complete', 'manual', 'ai_decide');--> statement-breakpoint
ALTER TYPE "public"."alert_type" ADD VALUE 'import_complete';--> statement-breakpoint
CREATE TABLE "gatekeeper_decision_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_id" text NOT NULL,
	"source" "gatekeeper_source" NOT NULL,
	"operation" "gatekeeper_operation" NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"confidence" numeric(5, 2) NOT NULL,
	"zone" "gatekeeper_zone" NOT NULL,
	"analysis" jsonb,
	"model_used" text,
	"tokens_used" integer,
	"latency_ms" integer,
	"user_id" uuid,
	"import_job_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gatekeeper_decision_log_decision_id_unique" UNIQUE("decision_id")
);
--> statement-breakpoint
CREATE TABLE "gatekeeper_review_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_id" text NOT NULL,
	"source" "gatekeeper_source" NOT NULL,
	"operation" "gatekeeper_operation" NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"incoming_data" jsonb NOT NULL,
	"normalized_data" jsonb,
	"existing_record" jsonb,
	"ai_analysis" jsonb,
	"status" "review_status" DEFAULT 'pending_review' NOT NULL,
	"submitted_by" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"review_notes" text,
	"import_job_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "gatekeeper_survivorship_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"field" text NOT NULL,
	"strategy" "survivorship_strategy" DEFAULT 'most_complete' NOT NULL,
	"ai_context" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "idx_gk_survivorship_entity_field" UNIQUE("entity_type","field")
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"status" "import_job_status" DEFAULT 'pending' NOT NULL,
	"file_name" text,
	"payload" jsonb NOT NULL,
	"total_rows" integer NOT NULL,
	"processed_rows" integer DEFAULT 0 NOT NULL,
	"results" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "normalized_phone" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "gatekeeper_decision_log" ADD CONSTRAINT "gatekeeper_decision_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gatekeeper_decision_log" ADD CONSTRAINT "gatekeeper_decision_log_import_job_id_import_jobs_id_fk" FOREIGN KEY ("import_job_id") REFERENCES "public"."import_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gatekeeper_review_queue" ADD CONSTRAINT "gatekeeper_review_queue_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gatekeeper_review_queue" ADD CONSTRAINT "gatekeeper_review_queue_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gatekeeper_review_queue" ADD CONSTRAINT "gatekeeper_review_queue_import_job_id_import_jobs_id_fk" FOREIGN KEY ("import_job_id") REFERENCES "public"."import_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_gk_decision_zone" ON "gatekeeper_decision_log" USING btree ("zone");--> statement-breakpoint
CREATE INDEX "idx_gk_decision_user" ON "gatekeeper_decision_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_gk_decision_created" ON "gatekeeper_decision_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_gk_decision_import_job" ON "gatekeeper_decision_log" USING btree ("import_job_id");--> statement-breakpoint
CREATE INDEX "idx_gk_review_status" ON "gatekeeper_review_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_gk_review_submitted_by" ON "gatekeeper_review_queue" USING btree ("submitted_by");--> statement-breakpoint
CREATE INDEX "idx_gk_review_import_job" ON "gatekeeper_review_queue" USING btree ("import_job_id");--> statement-breakpoint
CREATE INDEX "idx_import_jobs_user" ON "import_jobs" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_companies_domain_unique" ON "companies" USING btree ("domain") WHERE "companies"."domain" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_contacts_email_unique" ON "contacts" USING btree ("email") WHERE "contacts"."email" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_contacts_normalized_phone" ON "contacts" USING btree ("normalized_phone");
-- Add normalizedPhone column to contacts
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "normalized_phone" text;

-- Add unique index on email (where not null)
CREATE UNIQUE INDEX IF NOT EXISTS "idx_contacts_email_unique" ON "contacts" ("email") WHERE email IS NOT NULL;

-- Add index on normalized_phone
CREATE INDEX IF NOT EXISTS "idx_contacts_normalized_phone" ON "contacts" ("normalized_phone");

-- Create gatekeeper enums
DO $$ BEGIN
  CREATE TYPE "public"."gatekeeper_zone" AS ENUM('auto_apply', 'review', 'reject', 'bypassed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."gatekeeper_source" AS ENUM('form', 'import', 'bulk', 'merge', 'api');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."gatekeeper_operation" AS ENUM('create', 'update', 'merge', 'bulk_update');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."review_status" AS ENUM('pending_review', 'approved', 'rejected', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."survivorship_strategy" AS ENUM('most_recent', 'most_complete', 'manual', 'ai_decide');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create gatekeeper_decision_log table
CREATE TABLE IF NOT EXISTS "gatekeeper_decision_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "decision_id" text NOT NULL UNIQUE,
  "source" "gatekeeper_source" NOT NULL,
  "operation" "gatekeeper_operation" NOT NULL,
  "entity_type" "entity_type" NOT NULL,
  "confidence" numeric(5, 2) NOT NULL,
  "zone" "gatekeeper_zone" NOT NULL,
  "analysis" jsonb,
  "model_used" text,
  "tokens_used" integer,
  "latency_ms" integer,
  "user_id" uuid REFERENCES "users"("id"),
  "import_job_id" uuid REFERENCES "import_jobs"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_gk_decision_zone" ON "gatekeeper_decision_log" ("zone");
CREATE INDEX IF NOT EXISTS "idx_gk_decision_user" ON "gatekeeper_decision_log" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_gk_decision_created" ON "gatekeeper_decision_log" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_gk_decision_import_job" ON "gatekeeper_decision_log" ("import_job_id");

-- Create gatekeeper_review_queue table
CREATE TABLE IF NOT EXISTS "gatekeeper_review_queue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "decision_id" text NOT NULL,
  "source" "gatekeeper_source" NOT NULL,
  "operation" "gatekeeper_operation" NOT NULL,
  "entity_type" "entity_type" NOT NULL,
  "incoming_data" jsonb NOT NULL,
  "normalized_data" jsonb,
  "existing_record" jsonb,
  "ai_analysis" jsonb,
  "status" "review_status" NOT NULL DEFAULT 'pending_review',
  "submitted_by" uuid REFERENCES "users"("id"),
  "reviewed_by" uuid REFERENCES "users"("id"),
  "reviewed_at" timestamp,
  "review_notes" text,
  "import_job_id" uuid REFERENCES "import_jobs"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp
);

CREATE INDEX IF NOT EXISTS "idx_gk_review_status" ON "gatekeeper_review_queue" ("status");
CREATE INDEX IF NOT EXISTS "idx_gk_review_submitted_by" ON "gatekeeper_review_queue" ("submitted_by");
CREATE INDEX IF NOT EXISTS "idx_gk_review_import_job" ON "gatekeeper_review_queue" ("import_job_id");

-- Create gatekeeper_survivorship_rules table
CREATE TABLE IF NOT EXISTS "gatekeeper_survivorship_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_type" "entity_type" NOT NULL,
  "field" text NOT NULL,
  "strategy" "survivorship_strategy" NOT NULL DEFAULT 'most_complete',
  "ai_context" text,
  "priority" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "idx_gk_survivorship_entity_field" UNIQUE("entity_type", "field")
);

-- Backfill normalized_phone for existing contacts
UPDATE "contacts"
SET "normalized_phone" = regexp_replace("phone", '[^0-9]', '', 'g')
WHERE "phone" IS NOT NULL
  AND "normalized_phone" IS NULL
  AND length(regexp_replace("phone", '[^0-9]', '', 'g')) >= 7;

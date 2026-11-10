-- CRM ID Sequences table
CREATE TABLE "crm_id_sequences" (
	"entity_type" text PRIMARY KEY NOT NULL,
	"next_val" integer DEFAULT 1 NOT NULL
);

-- Seed sequences
INSERT INTO "crm_id_sequences" ("entity_type", "next_val") VALUES ('contact', 1), ('company', 1), ('deal', 1);

-- Add crm_id columns as NULLABLE first
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "crm_id" text;
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "crm_id" text;
--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "crm_id" text;

-- Backfill existing contacts
--> statement-breakpoint
UPDATE "contacts" SET "crm_id" = 'CON-' || LPAD(sub.rn::text, 4, '0')
FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn FROM "contacts") sub
WHERE "contacts".id = sub.id;

-- Backfill existing companies
--> statement-breakpoint
UPDATE "companies" SET "crm_id" = 'COM-' || LPAD(sub.rn::text, 4, '0')
FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn FROM "companies") sub
WHERE "companies".id = sub.id;

-- Backfill existing deals
--> statement-breakpoint
UPDATE "deals" SET "crm_id" = 'DEAL-' || LPAD(sub.rn::text, 4, '0')
FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn FROM "deals") sub
WHERE "deals".id = sub.id;

-- Update sequences to next values
--> statement-breakpoint
UPDATE "crm_id_sequences" SET "next_val" = COALESCE((SELECT COUNT(*) FROM "contacts"), 0) + 1 WHERE "entity_type" = 'contact';
--> statement-breakpoint
UPDATE "crm_id_sequences" SET "next_val" = COALESCE((SELECT COUNT(*) FROM "companies"), 0) + 1 WHERE "entity_type" = 'company';
--> statement-breakpoint
UPDATE "crm_id_sequences" SET "next_val" = COALESCE((SELECT COUNT(*) FROM "deals"), 0) + 1 WHERE "entity_type" = 'deal';

-- Now add NOT NULL constraints
--> statement-breakpoint
ALTER TABLE "contacts" ALTER COLUMN "crm_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "crm_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "crm_id" SET NOT NULL;

-- Add unique constraints
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_crm_id_unique" UNIQUE("crm_id");
--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_crm_id_unique" UNIQUE("crm_id");
--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_crm_id_unique" UNIQUE("crm_id");

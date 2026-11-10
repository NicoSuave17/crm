ALTER TABLE "tags" ALTER COLUMN "color" SET DEFAULT '#8A7E7D';--> statement-breakpoint
ALTER TABLE "stage_checklists" ADD COLUMN "is_required" boolean DEFAULT false NOT NULL;
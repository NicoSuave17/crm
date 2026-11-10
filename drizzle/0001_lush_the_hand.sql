CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'bulk_update', 'bulk_delete', 'import', 'merge', 'tag_add', 'tag_remove', 'assign', 'stage_change');--> statement-breakpoint
CREATE TYPE "public"."audit_source" AS ENUM('ui', 'api', 'import', 'bulk', 'automation', 'merge');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" "audit_action" NOT NULL,
	"changes" jsonb,
	"snapshot" jsonb,
	"user_id" uuid,
	"source" "audit_source" DEFAULT 'ui' NOT NULL,
	"correlation_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_log_entity" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_user" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_action" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_log_created" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_log_correlation" ON "audit_log" USING btree ("correlation_id");
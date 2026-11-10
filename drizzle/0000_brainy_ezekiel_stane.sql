CREATE TYPE "public"."activity_type" AS ENUM('note', 'call', 'email_sent', 'email_received', 'meeting', 'linkedin_message', 'task_completed', 'deal_stage_change', 'health_score_change', 'gmv_milestone', 'churn_alert', 'system_event');--> statement-breakpoint
CREATE TYPE "public"."alert_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('gmv_drop', 'gmv_milestone', 'churn_risk_increase', 'inactive_creator', 'deal_stale', 'task_overdue', 'health_score_drop', 'new_creator_onboarded');--> statement-breakpoint
CREATE TYPE "public"."churn_risk" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."company_size" AS ENUM('1-10', '11-50', '51-200', '201-1000', '1000+');--> statement-breakpoint
CREATE TYPE "public"."contact_source" AS ENUM('whop_api_sync', 'manual', 'linkedin', 'referral', 'inbound', 'import');--> statement-breakpoint
CREATE TYPE "public"."contact_status" AS ENUM('active', 'churned', 'at_risk', 'prospect', 'closed_lost');--> statement-breakpoint
CREATE TYPE "public"."contact_tier" AS ENUM('enterprise', 'premium', 'standard', 'starter');--> statement-breakpoint
CREATE TYPE "public"."contact_type" AS ENUM('creator', 'lead', 'enterprise_prospect', 'partner');--> statement-breakpoint
CREATE TYPE "public"."deal_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('contact', 'deal', 'company');--> statement-breakpoint
CREATE TYPE "public"."field_access" AS ENUM('hidden', 'readonly', 'editable');--> statement-breakpoint
CREATE TYPE "public"."field_type" AS ENUM('text', 'number', 'date', 'boolean', 'select', 'multi_select', 'url', 'email', 'currency');--> statement-breakpoint
CREATE TYPE "public"."nav_section" AS ENUM('main', 'bottom');--> statement-breakpoint
CREATE TYPE "public"."pipeline_type" AS ENUM('seller_onboarding', 'enterprise', 'partnerships', 'custom');--> statement-breakpoint
CREATE TYPE "public"."record_scope" AS ENUM('all', 'own', 'team');--> statement-breakpoint
CREATE TYPE "public"."report_format" AS ENUM('tabular', 'summary', 'matrix');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'manager', 'account_manager', 'ae', 'enterprise_sales');--> statement-breakpoint
CREATE TYPE "public"."vertical_type" AS ENUM('sports_picks', 'crypto_trading', 'coaching_courses', 'communities', 'software_saas', 'templates', 'agency', 'content_media', 'affiliate_networks');--> statement-breakpoint
CREATE TYPE "public"."view_entity_type" AS ENUM('contact', 'deal', 'company', 'task');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "activity_type" NOT NULL,
	"subject" text,
	"body" text,
	"metadata" jsonb,
	"contact_id" uuid,
	"deal_id" uuid,
	"company_id" uuid,
	"user_id" uuid,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"duration" integer,
	"next_follow_up_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_calculated_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"label" text NOT NULL,
	"entity_type" text NOT NULL,
	"formula" text NOT NULL,
	"output_type" text DEFAULT 'number' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_nav_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"icon" text DEFAULT 'Circle' NOT NULL,
	"href" text NOT NULL,
	"section" "nav_section" DEFAULT 'main' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"parent_id" uuid,
	"saved_view_id" uuid,
	"entity_type" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_nav_role_access" (
	"nav_item_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	CONSTRAINT "admin_nav_role_access_nav_item_id_role_pk" PRIMARY KEY("nav_item_id","role")
);
--> statement-breakpoint
CREATE TABLE "admin_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "user_role" NOT NULL,
	"entity_type" text NOT NULL,
	"can_create" boolean DEFAULT true NOT NULL,
	"can_read" boolean DEFAULT true NOT NULL,
	"can_update" boolean DEFAULT true NOT NULL,
	"can_delete" boolean DEFAULT false NOT NULL,
	"record_scope" "record_scope" DEFAULT 'all' NOT NULL,
	"field_overrides" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_permissions_role_entity_type_unique" UNIQUE("role","entity_type")
);
--> statement-breakpoint
CREATE TABLE "admin_report_role_access" (
	"report_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	CONSTRAINT "admin_report_role_access_report_id_role_pk" PRIMARY KEY("report_id","role")
);
--> statement-breakpoint
CREATE TABLE "admin_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"report_type" text NOT NULL,
	"format" "report_format" DEFAULT 'tabular' NOT NULL,
	"config" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_role_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "user_role" NOT NULL,
	"landing_page" text DEFAULT '/dashboard' NOT NULL,
	"default_pipeline_id" uuid,
	"dashboard_widgets" jsonb,
	"field_labels" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_role_config_role_unique" UNIQUE("role")
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "alert_type" NOT NULL,
	"user_id" uuid NOT NULL,
	"contact_id" uuid,
	"deal_id" uuid,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"severity" "alert_severity" NOT NULL,
	"metadata" jsonb,
	"is_read" boolean DEFAULT false,
	"dismissed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"user_id" uuid,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"industry" text,
	"size" "company_size",
	"description" text,
	"linkedin_url" text,
	"website_url" text,
	"vertical" "vertical_type",
	"owner_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_tags" (
	"company_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "company_tags_company_id_tag_id_pk" PRIMARY KEY("company_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "contact_companies" (
	"contact_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"role" text,
	"is_primary" boolean DEFAULT false,
	CONSTRAINT "contact_companies_contact_id_company_id_pk" PRIMARY KEY("contact_id","company_id")
);
--> statement-breakpoint
CREATE TABLE "contact_tags" (
	"contact_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "contact_tags_contact_id_tag_id_pk" PRIMARY KEY("contact_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text,
	"email" text,
	"phone" text,
	"avatar_url" text,
	"whop_company_id" text,
	"whop_username" text,
	"type" "contact_type" NOT NULL,
	"status" "contact_status" DEFAULT 'prospect' NOT NULL,
	"tier" "contact_tier",
	"owner_id" uuid,
	"health_score" integer,
	"current_mrr" numeric(12, 2),
	"current_gmv" numeric(12, 2),
	"lifetime_gmv" numeric(14, 2),
	"member_count" integer,
	"churn_risk" "churn_risk",
	"last_active_at" timestamp,
	"vertical" "vertical_type",
	"source" "contact_source",
	"source_details" text,
	"linkedin_url" text,
	"twitter_url" text,
	"website_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contacts_whop_company_id_unique" UNIQUE("whop_company_id")
);
--> statement-breakpoint
CREATE TABLE "custom_field_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"name" text NOT NULL,
	"label" text NOT NULL,
	"field_type" "field_type" NOT NULL,
	"options" jsonb,
	"is_required" boolean DEFAULT false,
	"position" integer DEFAULT 0 NOT NULL,
	"is_visible_in_list" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "custom_field_definitions_entity_type_name_unique" UNIQUE("entity_type","name")
);
--> statement-breakpoint
CREATE TABLE "custom_field_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field_definition_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"text_value" text,
	"number_value" numeric(14, 4),
	"date_value" timestamp,
	"boolean_value" boolean,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "custom_field_values_field_definition_id_entity_id_unique" UNIQUE("field_definition_id","entity_id")
);
--> statement-breakpoint
CREATE TABLE "deal_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"checklist_id" uuid NOT NULL,
	"completed_at" timestamp,
	"completed_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "deal_checklist_items_deal_id_checklist_id_unique" UNIQUE("deal_id","checklist_id")
);
--> statement-breakpoint
CREATE TABLE "deal_stage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"from_stage_id" uuid,
	"to_stage_id" uuid NOT NULL,
	"user_id" uuid,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_tags" (
	"deal_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "deal_tags_deal_id_tag_id_pk" PRIMARY KEY("deal_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"pipeline_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"company_id" uuid,
	"owner_id" uuid NOT NULL,
	"value" numeric(12, 2),
	"currency" text DEFAULT 'USD',
	"expected_mrr" numeric(12, 2),
	"expected_close_date" date,
	"actual_close_date" date,
	"closed_at" timestamp,
	"lost_reason" text,
	"priority" "deal_priority" DEFAULT 'medium',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"category" text,
	"created_by" uuid NOT NULL,
	"is_shared" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gmv_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"date" date NOT NULL,
	"gmv" numeric(14, 2) NOT NULL,
	"mrr" numeric(12, 2),
	"member_count" integer,
	"new_members" integer,
	"churned_members" integer,
	CONSTRAINT "gmv_snapshots_contact_id_date_unique" UNIQUE("contact_id","date")
);
--> statement-breakpoint
CREATE TABLE "pipeline_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"color" text,
	"probability" integer,
	"is_won" boolean DEFAULT false,
	"is_lost" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "pipelines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "pipeline_type" NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_view_role_access" (
	"saved_view_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	CONSTRAINT "saved_view_role_access_saved_view_id_role_pk" PRIMARY KEY("saved_view_id","role")
);
--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"entity_type" "view_entity_type" NOT NULL,
	"filters" jsonb NOT NULL,
	"sort_by" jsonb,
	"columns" jsonb,
	"user_id" uuid NOT NULL,
	"is_shared" boolean DEFAULT false,
	"is_default" boolean DEFAULT false,
	"is_admin_view" boolean DEFAULT false,
	"show_in_sidebar" boolean DEFAULT false,
	"column_widths" jsonb,
	"group_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6B7280' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"assignee_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"contact_id" uuid,
	"deal_id" uuid,
	"company_id" uuid,
	"due_date" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "team_members_team_id_user_id_pk" PRIMARY KEY("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"manager_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"avatar_url" text,
	"role" "user_role" DEFAULT 'ae' NOT NULL,
	"team_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "whop_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sync_type" text NOT NULL,
	"status" "sync_status" NOT NULL,
	"records_processed" integer DEFAULT 0,
	"error_message" text,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_calculated_fields" ADD CONSTRAINT "admin_calculated_fields_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_nav_items" ADD CONSTRAINT "admin_nav_items_saved_view_id_saved_views_id_fk" FOREIGN KEY ("saved_view_id") REFERENCES "public"."saved_views"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_nav_role_access" ADD CONSTRAINT "admin_nav_role_access_nav_item_id_admin_nav_items_id_fk" FOREIGN KEY ("nav_item_id") REFERENCES "public"."admin_nav_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_report_role_access" ADD CONSTRAINT "admin_report_role_access_report_id_admin_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."admin_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_reports" ADD CONSTRAINT "admin_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_role_config" ADD CONSTRAINT "admin_role_config_default_pipeline_id_pipelines_id_fk" FOREIGN KEY ("default_pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_history" ADD CONSTRAINT "change_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_tags" ADD CONSTRAINT "company_tags_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_tags" ADD CONSTRAINT "company_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_companies" ADD CONSTRAINT "contact_companies_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_companies" ADD CONSTRAINT "contact_companies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_field_definition_id_custom_field_definitions_id_fk" FOREIGN KEY ("field_definition_id") REFERENCES "public"."custom_field_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_checklist_items" ADD CONSTRAINT "deal_checklist_items_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_checklist_items" ADD CONSTRAINT "deal_checklist_items_checklist_id_stage_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."stage_checklists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_checklist_items" ADD CONSTRAINT "deal_checklist_items_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_history" ADD CONSTRAINT "deal_stage_history_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_history" ADD CONSTRAINT "deal_stage_history_from_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("from_stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_history" ADD CONSTRAINT "deal_stage_history_to_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("to_stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_history" ADD CONSTRAINT "deal_stage_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_tags" ADD CONSTRAINT "deal_tags_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_tags" ADD CONSTRAINT "deal_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmv_snapshots" ADD CONSTRAINT "gmv_snapshots_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_view_role_access" ADD CONSTRAINT "saved_view_role_access_saved_view_id_saved_views_id_fk" FOREIGN KEY ("saved_view_id") REFERENCES "public"."saved_views"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_checklists" ADD CONSTRAINT "stage_checklists_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activities_contact_time" ON "activities" USING btree ("contact_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_activities_deal_time" ON "activities" USING btree ("deal_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_admin_nav_position" ON "admin_nav_items" USING btree ("section","position");--> statement-breakpoint
CREATE INDEX "idx_alerts_user" ON "alerts" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "idx_change_history_entity" ON "change_history" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_contacts_owner" ON "contacts" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_contacts_type" ON "contacts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_contacts_status" ON "contacts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_cfv_entity" ON "custom_field_values" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_deal_checklist_deal" ON "deal_checklist_items" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "idx_deal_stage_history_deal" ON "deal_stage_history" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "idx_deals_pipeline" ON "deals" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "idx_deals_stage" ON "deals" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "idx_deals_contact" ON "deals" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_deals_owner" ON "deals" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_gmv_snapshots_date" ON "gmv_snapshots" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_stages_pipeline" ON "pipeline_stages" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "idx_stage_checklists_stage" ON "stage_checklists" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_assignee" ON "tasks" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_contact" ON "tasks" USING btree ("contact_id");
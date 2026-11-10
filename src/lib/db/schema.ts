import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  decimal,
  date,
  jsonb,
  index,
  unique,
  uniqueIndex,
  primaryKey,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ─── Enums ──────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "manager",
  "account_manager",
  "ae",
  "enterprise_sales",
]);

export const contactTypeEnum = pgEnum("contact_type", [
  "creator",
  "lead",
  "enterprise_prospect",
  "partner",
]);

export const contactStatusEnum = pgEnum("contact_status", [
  "active",
  "churned",
  "at_risk",
  "prospect",
  "closed_lost",
]);

export const contactTierEnum = pgEnum("contact_tier", [
  "enterprise",
  "premium",
  "standard",
  "starter",
]);

export const churnRiskEnum = pgEnum("churn_risk", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const contactSourceEnum = pgEnum("contact_source", [
  "whop_api_sync",
  "manual",
  "linkedin",
  "referral",
  "inbound",
  "import",
]);

export const companySizeEnum = pgEnum("company_size", [
  "1-10",
  "11-50",
  "51-200",
  "201-1000",
  "1000+",
]);

export const pipelineTypeEnum = pgEnum("pipeline_type", [
  "seller_onboarding",
  "enterprise",
  "partnerships",
  "custom",
]);

export const dealPriorityEnum = pgEnum("deal_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

export const activityTypeEnum = pgEnum("activity_type", [
  "note",
  "call",
  "email_sent",
  "email_received",
  "meeting",
  "linkedin_message",
  "task_completed",
  "deal_stage_change",
  "health_score_change",
  "gmv_milestone",
  "churn_alert",
  "system_event",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

export const entityTypeEnum = pgEnum("entity_type", [
  "contact",
  "deal",
  "company",
]);

export const fieldTypeEnum = pgEnum("field_type", [
  "text",
  "number",
  "date",
  "boolean",
  "select",
  "multi_select",
  "url",
  "email",
  "currency",
]);

export const viewEntityTypeEnum = pgEnum("view_entity_type", [
  "contact",
  "deal",
  "company",
  "task",
]);

export const navSectionEnum = pgEnum("nav_section", ["main", "bottom"]);

export const recordScopeEnum = pgEnum("record_scope", ["all", "own", "team"]);

export const fieldAccessEnum = pgEnum("field_access", [
  "hidden",
  "readonly",
  "editable",
]);

export const reportFormatEnum = pgEnum("report_format", [
  "tabular",
  "summary",
  "matrix",
]);

export const alertTypeEnum = pgEnum("alert_type", [
  "gmv_drop",
  "gmv_milestone",
  "churn_risk_increase",
  "inactive_creator",
  "deal_stale",
  "task_overdue",
  "health_score_drop",
  "new_creator_onboarded",
  "import_complete",
]);

export const alertSeverityEnum = pgEnum("alert_severity", [
  "info",
  "warning",
  "critical",
]);

export const syncStatusEnum = pgEnum("sync_status", [
  "running",
  "completed",
  "failed",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "update",
  "delete",
  "bulk_update",
  "bulk_delete",
  "import",
  "merge",
  "tag_add",
  "tag_remove",
  "assign",
  "stage_change",
]);

export const auditSourceEnum = pgEnum("audit_source", [
  "ui",
  "api",
  "import",
  "bulk",
  "automation",
  "merge",
]);

export const verticalTypeEnum = pgEnum("vertical_type", [
  "sports_picks",
  "crypto_trading",
  "coaching_courses",
  "communities",
  "software_saas",
  "templates",
  "agency",
  "content_media",
  "affiliate_networks",
]);

// ─── Gatekeeper Enums ────────────────────────────────────────────

export const gatekeeperZoneEnum = pgEnum("gatekeeper_zone", [
  "auto_apply",
  "review",
  "reject",
  "bypassed",
]);

export const gatekeeperSourceEnum = pgEnum("gatekeeper_source", [
  "form",
  "import",
  "bulk",
  "merge",
  "api",
]);

export const gatekeeperOperationEnum = pgEnum("gatekeeper_operation", [
  "create",
  "update",
  "merge",
  "bulk_update",
]);

export const reviewStatusEnum = pgEnum("review_status", [
  "pending_review",
  "approved",
  "rejected",
  "expired",
]);

export const survivorshipStrategyEnum = pgEnum("survivorship_strategy", [
  "most_recent",
  "most_complete",
  "manual",
  "ai_decide",
]);

// ─── CRM ID Sequences ───────────────────────────────────────────

export const crmIdSequences = pgTable("crm_id_sequences", {
  entityType: text("entity_type").primaryKey(),
  nextVal: integer("next_val").notNull().default(1),
});

// ─── Users ──────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  avatarUrl: text("avatar_url"),
  role: userRoleEnum("role").notNull().default("ae"),
  teamId: uuid("team_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Teams ──────────────────────────────────────────────────────

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  managerId: uuid("manager_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const teamMembers = pgTable(
  "team_members",
  {
    teamId: uuid("team_id")
      .references(() => teams.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.userId] })]
);

// ─── Contacts ───────────────────────────────────────────────────

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    crmId: text("crm_id").notNull().unique(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    email: text("email"),
    phone: text("phone"),
    normalizedPhone: text("normalized_phone"),
    title: text("title"),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    country: text("country"),
    avatarUrl: text("avatar_url"),

    // Whop-specific
    whopCompanyId: text("whop_company_id").unique(),
    whopUsername: text("whop_username"),

    // Classification
    type: contactTypeEnum("type").notNull(),
    status: contactStatusEnum("status").notNull().default("prospect"),
    tier: contactTierEnum("tier"),

    // Ownership
    ownerId: uuid("owner_id").references(() => users.id),

    // Health & Metrics
    healthScore: integer("health_score"),
    currentMrr: decimal("current_mrr", { precision: 12, scale: 2 }),
    currentGmv: decimal("current_gmv", { precision: 12, scale: 2 }),
    lifetimeGmv: decimal("lifetime_gmv", { precision: 14, scale: 2 }),
    memberCount: integer("member_count"),
    churnRisk: churnRiskEnum("churn_risk"),
    lastActiveAt: timestamp("last_active_at"),

    // Vertical/Archetype
    vertical: verticalTypeEnum("vertical"),

    // Source
    source: contactSourceEnum("source"),
    sourceDetails: text("source_details"),

    // Social
    linkedinUrl: text("linkedin_url"),
    twitterUrl: text("twitter_url"),
    websiteUrl: text("website_url"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_contacts_owner").on(t.ownerId),
    index("idx_contacts_type").on(t.type),
    index("idx_contacts_status").on(t.status),
    uniqueIndex("idx_contacts_email_unique").on(t.email).where(sql`${t.email} IS NOT NULL`),
    index("idx_contacts_normalized_phone").on(t.normalizedPhone),
  ]
);

// ─── Companies ──────────────────────────────────────────────────

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    crmId: text("crm_id").notNull().unique(),
    name: text("name").notNull(),
    domain: text("domain"),
    industry: text("industry"),
    size: companySizeEnum("size"),
    description: text("description"),
    linkedinUrl: text("linkedin_url"),
    websiteUrl: text("website_url"),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    country: text("country"),
    vertical: verticalTypeEnum("vertical"),
    ownerId: uuid("owner_id").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("idx_companies_domain_unique").on(t.domain).where(sql`${t.domain} IS NOT NULL`),
  ]
);

export const contactCompanies = pgTable(
  "contact_companies",
  {
    contactId: uuid("contact_id")
      .references(() => contacts.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    role: text("role"),
    isPrimary: boolean("is_primary").default(false),
  },
  (t) => [primaryKey({ columns: [t.contactId, t.companyId] })]
);

// ─── Pipelines & Deals ─────────────────────────────────────────

export const pipelines = pgTable("pipelines", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  type: pipelineTypeEnum("type").notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pipelineStages = pgTable(
  "pipeline_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pipelineId: uuid("pipeline_id")
      .references(() => pipelines.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    color: text("color"),
    probability: integer("probability"),
    isWon: boolean("is_won").default(false),
    isLost: boolean("is_lost").default(false),
  },
  (t) => [index("idx_stages_pipeline").on(t.pipelineId)]
);

export const deals = pgTable(
  "deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    crmId: text("crm_id").notNull().unique(),
    title: text("title").notNull(),
    description: text("description"),

    pipelineId: uuid("pipeline_id")
      .references(() => pipelines.id)
      .notNull(),
    stageId: uuid("stage_id")
      .references(() => pipelineStages.id)
      .notNull(),

    contactId: uuid("contact_id")
      .references(() => contacts.id)
      .notNull(),
    companyId: uuid("company_id").references(() => companies.id),
    ownerId: uuid("owner_id")
      .references(() => users.id)
      .notNull(),

    value: decimal("value", { precision: 12, scale: 2 }),
    currency: text("currency").default("USD"),
    expectedMrr: decimal("expected_mrr", { precision: 12, scale: 2 }),

    expectedCloseDate: date("expected_close_date"),
    actualCloseDate: date("actual_close_date"),
    closedAt: timestamp("closed_at"),

    lostReason: text("lost_reason"),
    priority: dealPriorityEnum("priority").default("medium"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_deals_pipeline").on(t.pipelineId),
    index("idx_deals_stage").on(t.stageId),
    index("idx_deals_contact").on(t.contactId),
    index("idx_deals_owner").on(t.ownerId),
  ]
);

// ─── Deal Stage History ─────────────────────────────────────────

export const dealStageHistory = pgTable(
  "deal_stage_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id")
      .references(() => deals.id, { onDelete: "cascade" })
      .notNull(),
    fromStageId: uuid("from_stage_id").references(() => pipelineStages.id),
    toStageId: uuid("to_stage_id")
      .references(() => pipelineStages.id)
      .notNull(),
    userId: uuid("user_id").references(() => users.id),
    changedAt: timestamp("changed_at").defaultNow().notNull(),
  },
  (t) => [index("idx_deal_stage_history_deal").on(t.dealId)]
);

// ─── Stage Checklists ───────────────────────────────────────────

export const stageChecklists = pgTable(
  "stage_checklists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stageId: uuid("stage_id")
      .references(() => pipelineStages.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").notNull(),
    description: text("description"),
    isRequired: boolean("is_required").notNull().default(false),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_stage_checklists_stage").on(t.stageId)]
);

export const dealChecklistItems = pgTable(
  "deal_checklist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id")
      .references(() => deals.id, { onDelete: "cascade" })
      .notNull(),
    checklistId: uuid("checklist_id")
      .references(() => stageChecklists.id, { onDelete: "cascade" })
      .notNull(),
    completedAt: timestamp("completed_at"),
    completedBy: uuid("completed_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    unique().on(t.dealId, t.checklistId),
    index("idx_deal_checklist_deal").on(t.dealId),
  ]
);

// ─── Activities ─────────────────────────────────────────────────

export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: activityTypeEnum("type").notNull(),
    subject: text("subject"),
    body: text("body"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "cascade",
    }),
    dealId: uuid("deal_id").references(() => deals.id, {
      onDelete: "set null",
    }),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),

    userId: uuid("user_id").references(() => users.id),

    occurredAt: timestamp("occurred_at").notNull().defaultNow(),
    duration: integer("duration"),
    nextFollowUpDate: date("next_follow_up_date"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_activities_contact_time").on(t.contactId, t.occurredAt),
    index("idx_activities_deal_time").on(t.dealId, t.occurredAt),
  ]
);

// ─── Tasks ──────────────────────────────────────────────────────

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("pending"),
    priority: taskPriorityEnum("priority").notNull().default("medium"),

    assigneeId: uuid("assignee_id")
      .references(() => users.id)
      .notNull(),
    creatorId: uuid("creator_id")
      .references(() => users.id)
      .notNull(),

    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "cascade",
    }),
    dealId: uuid("deal_id").references(() => deals.id, {
      onDelete: "set null",
    }),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),

    dueDate: timestamp("due_date"),
    completedAt: timestamp("completed_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_tasks_assignee").on(t.assigneeId),
    index("idx_tasks_contact").on(t.contactId),
  ]
);

// ─── Tags ───────────────────────────────────────────────────────

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  color: text("color").notNull().default("#8A7E7D"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contactTags = pgTable(
  "contact_tags",
  {
    contactId: uuid("contact_id")
      .references(() => contacts.id, { onDelete: "cascade" })
      .notNull(),
    tagId: uuid("tag_id")
      .references(() => tags.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.contactId, t.tagId] })]
);

export const dealTags = pgTable(
  "deal_tags",
  {
    dealId: uuid("deal_id")
      .references(() => deals.id, { onDelete: "cascade" })
      .notNull(),
    tagId: uuid("tag_id")
      .references(() => tags.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.dealId, t.tagId] })]
);

export const companyTags = pgTable(
  "company_tags",
  {
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    tagId: uuid("tag_id")
      .references(() => tags.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.companyId, t.tagId] })]
);

// ─── Change History ─────────────────────────────────────────────

export const changeHistory = pgTable(
  "change_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    fieldName: text("field_name").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    userId: uuid("user_id").references(() => users.id),
    changedAt: timestamp("changed_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_change_history_entity").on(t.entityType, t.entityId),
  ]
);

// ─── Audit Log (Dedicated) ──────────────────────────────────────

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: auditActionEnum("action").notNull(),
    changes: jsonb("changes").$type<Record<string, { from: unknown; to: unknown }>>(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>(),
    userId: uuid("user_id").references(() => users.id),
    source: auditSourceEnum("source").notNull().default("ui"),
    correlationId: uuid("correlation_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_audit_log_entity").on(t.entityType, t.entityId),
    index("idx_audit_log_user").on(t.userId),
    index("idx_audit_log_action").on(t.action),
    index("idx_audit_log_created").on(t.createdAt),
    index("idx_audit_log_correlation").on(t.correlationId),
  ]
);

// ─── Custom Fields ──────────────────────────────────────────────

export const customFieldDefinitions = pgTable(
  "custom_field_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: entityTypeEnum("entity_type").notNull(),
    name: text("name").notNull(),
    label: text("label").notNull(),
    fieldType: fieldTypeEnum("field_type").notNull(),
    options:
      jsonb("options").$type<
        { value: string; label: string; color?: string }[]
      >(),
    isRequired: boolean("is_required").default(false),
    position: integer("position").notNull().default(0),
    isVisibleInList: boolean("is_visible_in_list").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.entityType, t.name)]
);

export const customFieldValues = pgTable(
  "custom_field_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fieldDefinitionId: uuid("field_definition_id")
      .references(() => customFieldDefinitions.id, { onDelete: "cascade" })
      .notNull(),
    entityId: uuid("entity_id").notNull(),

    textValue: text("text_value"),
    numberValue: decimal("number_value", { precision: 14, scale: 4 }),
    dateValue: timestamp("date_value"),
    booleanValue: boolean("boolean_value"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    unique().on(t.fieldDefinitionId, t.entityId),
    index("idx_cfv_entity").on(t.entityId),
  ]
);

// ─── Saved Views ────────────────────────────────────────────────

export const savedViews = pgTable("saved_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  entityType: viewEntityTypeEnum("entity_type").notNull(),
  filters: jsonb("filters").$type<Record<string, unknown>[]>().notNull(),
  sortBy:
    jsonb("sort_by").$type<{ field: string; direction: "asc" | "desc" }[]>(),
  columns: jsonb("columns").$type<string[]>(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  isShared: boolean("is_shared").default(false),
  isDefault: boolean("is_default").default(false),
  isAdminView: boolean("is_admin_view").default(false),
  showInSidebar: boolean("show_in_sidebar").default(false),
  columnWidths: jsonb("column_widths").$type<Record<string, number>>(),
  groupBy: text("group_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Email Templates ─────────────────────────────────────────────

export const emailTemplates = pgTable("email_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  category: text("category"),
  createdBy: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  isShared: boolean("is_shared").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Alerts ─────────────────────────────────────────────────────

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: alertTypeEnum("type").notNull(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "cascade",
    }),
    dealId: uuid("deal_id").references(() => deals.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    message: text("message").notNull(),
    severity: alertSeverityEnum("severity").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    isRead: boolean("is_read").default(false),
    dismissedAt: timestamp("dismissed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_alerts_user").on(t.userId, t.isRead)]
);

// ─── Import Jobs ────────────────────────────────────────────────

export const importJobStatusEnum = pgEnum("import_job_status", [
  "pending",
  "processing",
  "complete",
  "failed",
]);

export const importJobs = pgTable(
  "import_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    entityType: text("entity_type").notNull(), // "contact" | "company"
    status: importJobStatusEnum("status").notNull().default("pending"),
    fileName: text("file_name"),
    payload: jsonb("payload").notNull(), // resolved rows to process
    totalRows: integer("total_rows").notNull(),
    processedRows: integer("processed_rows").notNull().default(0),
    results: jsonb("results").$type<{
      created: number;
      skipped: number;
      updated: number;
      errors: number;
      errorDetails: { index: number; message: string }[];
      companyLinking?: {
        linkedByDomain: number;
        linkedByName: number;
        companiesCreated: number;
        companiesUpdated: number;
        ambiguousMatches: number;
        noCompanyInfo: number;
      };
    }>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (t) => [index("idx_import_jobs_user").on(t.userId, t.status)]
);

// ─── Gatekeeper Decision Log ─────────────────────────────────────

export const gatekeeperDecisionLog = pgTable(
  "gatekeeper_decision_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    decisionId: text("decision_id").notNull().unique(),
    source: gatekeeperSourceEnum("source").notNull(),
    operation: gatekeeperOperationEnum("operation").notNull(),
    entityType: entityTypeEnum("entity_type").notNull(),
    confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull(),
    zone: gatekeeperZoneEnum("zone").notNull(),
    analysis: jsonb("analysis").$type<Record<string, unknown>>(),
    modelUsed: text("model_used"),
    tokensUsed: integer("tokens_used"),
    latencyMs: integer("latency_ms"),
    userId: uuid("user_id").references(() => users.id),
    importJobId: uuid("import_job_id").references(() => importJobs.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_gk_decision_zone").on(t.zone),
    index("idx_gk_decision_user").on(t.userId),
    index("idx_gk_decision_created").on(t.createdAt),
    index("idx_gk_decision_import_job").on(t.importJobId),
  ]
);

// ─── Gatekeeper Review Queue ─────────────────────────────────────

export const gatekeeperReviewQueue = pgTable(
  "gatekeeper_review_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    decisionId: text("decision_id").notNull(),
    source: gatekeeperSourceEnum("source").notNull(),
    operation: gatekeeperOperationEnum("operation").notNull(),
    entityType: entityTypeEnum("entity_type").notNull(),
    incomingData: jsonb("incoming_data").$type<Record<string, unknown>>().notNull(),
    normalizedData: jsonb("normalized_data").$type<Record<string, unknown>>(),
    existingRecord: jsonb("existing_record").$type<Record<string, unknown>>(),
    aiAnalysis: jsonb("ai_analysis").$type<Record<string, unknown>>(),
    status: reviewStatusEnum("status").notNull().default("pending_review"),
    submittedBy: uuid("submitted_by").references(() => users.id),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),
    reviewNotes: text("review_notes"),
    importJobId: uuid("import_job_id").references(() => importJobs.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
  },
  (t) => [
    index("idx_gk_review_status").on(t.status),
    index("idx_gk_review_submitted_by").on(t.submittedBy),
    index("idx_gk_review_import_job").on(t.importJobId),
  ]
);

// ─── Gatekeeper Survivorship Rules ──────────────────────────────

export const gatekeeperSurvivorshipRules = pgTable(
  "gatekeeper_survivorship_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: entityTypeEnum("entity_type").notNull(),
    field: text("field").notNull(),
    strategy: survivorshipStrategyEnum("strategy").notNull().default("most_complete"),
    aiContext: text("ai_context"),
    priority: integer("priority").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    unique("idx_gk_survivorship_entity_field").on(t.entityType, t.field),
  ]
);

// ─── GMV Snapshots ──────────────────────────────────────────────

export const gmvSnapshots = pgTable(
  "gmv_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .references(() => contacts.id, { onDelete: "cascade" })
      .notNull(),
    date: date("date").notNull(),
    gmv: decimal("gmv", { precision: 14, scale: 2 }).notNull(),
    mrr: decimal("mrr", { precision: 12, scale: 2 }),
    memberCount: integer("member_count"),
    newMembers: integer("new_members"),
    churnedMembers: integer("churned_members"),
  },
  (t) => [
    unique().on(t.contactId, t.date),
    index("idx_gmv_snapshots_date").on(t.date),
  ]
);

// ─── Whop Sync Log ──────────────────────────────────────────────

export const whopSyncLog = pgTable("whop_sync_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  syncType: text("sync_type").notNull(),
  status: syncStatusEnum("status").notNull(),
  recordsProcessed: integer("records_processed").default(0),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
});

// ─── Admin: Navigation ──────────────────────────────────────────

export const adminNavItems = pgTable(
  "admin_nav_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    label: text("label").notNull(),
    icon: text("icon").notNull().default("Circle"),
    href: text("href").notNull(),
    section: navSectionEnum("section").notNull().default("main"),
    position: integer("position").notNull().default(0),
    parentId: uuid("parent_id"),
    savedViewId: uuid("saved_view_id").references(() => savedViews.id, {
      onDelete: "set null",
    }),
    entityType: text("entity_type"),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_admin_nav_position").on(t.section, t.position)]
);

export const adminNavRoleAccess = pgTable(
  "admin_nav_role_access",
  {
    navItemId: uuid("nav_item_id")
      .references(() => adminNavItems.id, { onDelete: "cascade" })
      .notNull(),
    role: userRoleEnum("role").notNull(),
  },
  (t) => [primaryKey({ columns: [t.navItemId, t.role] })]
);

// ─── Admin: Permissions ─────────────────────────────────────────

export const adminPermissions = pgTable(
  "admin_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    role: userRoleEnum("role").notNull(),
    entityType: text("entity_type").notNull(),
    canCreate: boolean("can_create").notNull().default(true),
    canRead: boolean("can_read").notNull().default(true),
    canUpdate: boolean("can_update").notNull().default(true),
    canDelete: boolean("can_delete").notNull().default(false),
    recordScope: recordScopeEnum("record_scope").notNull().default("all"),
    fieldOverrides:
      jsonb("field_overrides").$type<
        Record<string, "hidden" | "readonly" | "editable">
      >(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.role, t.entityType)]
);

// ─── Admin: Role Config ─────────────────────────────────────────

export const adminRoleConfig = pgTable("admin_role_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  role: userRoleEnum("role").notNull().unique(),
  landingPage: text("landing_page").notNull().default("/dashboard"),
  defaultPipelineId: uuid("default_pipeline_id").references(
    () => pipelines.id
  ),
  dashboardWidgets:
    jsonb("dashboard_widgets").$type<
      {
        id: string;
        type: string;
        title: string;
        reportId?: string;
        config: Record<string, unknown>;
        layout: { x: number; y: number; w: number; h: number };
      }[]
    >(),
  fieldLabels:
    jsonb("field_labels").$type<Record<string, string>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Admin: Saved View Role Access ──────────────────────────────

export const savedViewRoleAccess = pgTable(
  "saved_view_role_access",
  {
    savedViewId: uuid("saved_view_id")
      .references(() => savedViews.id, { onDelete: "cascade" })
      .notNull(),
    role: userRoleEnum("role").notNull(),
  },
  (t) => [primaryKey({ columns: [t.savedViewId, t.role] })]
);

// ─── Admin: Reports ─────────────────────────────────────────────

export const adminReports = pgTable("admin_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  reportType: text("report_type").notNull(),
  format: reportFormatEnum("format").notNull().default("tabular"),
  config: jsonb("config").$type<Record<string, unknown>>().notNull(),
  createdBy: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  isShared: boolean("is_shared").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const adminReportRoleAccess = pgTable(
  "admin_report_role_access",
  {
    reportId: uuid("report_id")
      .references(() => adminReports.id, { onDelete: "cascade" })
      .notNull(),
    role: userRoleEnum("role").notNull(),
  },
  (t) => [primaryKey({ columns: [t.reportId, t.role] })]
);

export const adminCalculatedFields = pgTable("admin_calculated_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  label: text("label").notNull(),
  entityType: text("entity_type").notNull(),
  formula: text("formula").notNull(),
  outputType: text("output_type").notNull().default("number"),
  createdBy: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Relations ──────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  ownedContacts: many(contacts),
  ownedDeals: many(deals),
  assignedTasks: many(tasks, { relationName: "assignee" }),
  createdTasks: many(tasks, { relationName: "creator" }),
  activities: many(activities),
  alerts: many(alerts),
  savedViews: many(savedViews),
  emailTemplates: many(emailTemplates),
  team: one(teams, { fields: [users.teamId], references: [teams.id] }),
  teamMemberships: many(teamMembers),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  manager: one(users, { fields: [teams.managerId], references: [users.id] }),
  members: many(teamMembers),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  owner: one(users, { fields: [contacts.ownerId], references: [users.id] }),
  activities: many(activities),
  deals: many(deals),
  tasks: many(tasks),
  contactTags: many(contactTags),
  contactCompanies: many(contactCompanies),
  gmvSnapshots: many(gmvSnapshots),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  owner: one(users, { fields: [companies.ownerId], references: [users.id] }),
  contactCompanies: many(contactCompanies),
  deals: many(deals),
  companyTags: many(companyTags),
}));

export const contactCompaniesRelations = relations(
  contactCompanies,
  ({ one }) => ({
    contact: one(contacts, {
      fields: [contactCompanies.contactId],
      references: [contacts.id],
    }),
    company: one(companies, {
      fields: [contactCompanies.companyId],
      references: [companies.id],
    }),
  })
);

export const pipelinesRelations = relations(pipelines, ({ many }) => ({
  stages: many(pipelineStages),
  deals: many(deals),
}));

export const pipelineStagesRelations = relations(
  pipelineStages,
  ({ one, many }) => ({
    pipeline: one(pipelines, {
      fields: [pipelineStages.pipelineId],
      references: [pipelines.id],
    }),
    deals: many(deals),
    checklists: many(stageChecklists),
  })
);

export const dealsRelations = relations(deals, ({ one, many }) => ({
  pipeline: one(pipelines, {
    fields: [deals.pipelineId],
    references: [pipelines.id],
  }),
  stage: one(pipelineStages, {
    fields: [deals.stageId],
    references: [pipelineStages.id],
  }),
  contact: one(contacts, {
    fields: [deals.contactId],
    references: [contacts.id],
  }),
  company: one(companies, {
    fields: [deals.companyId],
    references: [companies.id],
  }),
  owner: one(users, { fields: [deals.ownerId], references: [users.id] }),
  activities: many(activities),
  tasks: many(tasks),
  dealTags: many(dealTags),
  stageHistory: many(dealStageHistory),
  checklistItems: many(dealChecklistItems),
}));

export const dealStageHistoryRelations = relations(dealStageHistory, ({ one }) => ({
  deal: one(deals, { fields: [dealStageHistory.dealId], references: [deals.id] }),
  fromStage: one(pipelineStages, {
    fields: [dealStageHistory.fromStageId],
    references: [pipelineStages.id],
    relationName: "fromStage",
  }),
  toStage: one(pipelineStages, {
    fields: [dealStageHistory.toStageId],
    references: [pipelineStages.id],
    relationName: "toStage",
  }),
  user: one(users, { fields: [dealStageHistory.userId], references: [users.id] }),
}));

export const stageChecklistsRelations = relations(
  stageChecklists,
  ({ one, many }) => ({
    stage: one(pipelineStages, {
      fields: [stageChecklists.stageId],
      references: [pipelineStages.id],
    }),
    dealChecklistItems: many(dealChecklistItems),
  })
);

export const dealChecklistItemsRelations = relations(
  dealChecklistItems,
  ({ one }) => ({
    deal: one(deals, {
      fields: [dealChecklistItems.dealId],
      references: [deals.id],
    }),
    checklist: one(stageChecklists, {
      fields: [dealChecklistItems.checklistId],
      references: [stageChecklists.id],
    }),
    completedByUser: one(users, {
      fields: [dealChecklistItems.completedBy],
      references: [users.id],
    }),
  })
);

export const activitiesRelations = relations(activities, ({ one }) => ({
  contact: one(contacts, {
    fields: [activities.contactId],
    references: [contacts.id],
  }),
  deal: one(deals, {
    fields: [activities.dealId],
    references: [deals.id],
  }),
  company: one(companies, {
    fields: [activities.companyId],
    references: [companies.id],
  }),
  user: one(users, { fields: [activities.userId], references: [users.id] }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
    relationName: "assignee",
  }),
  creator: one(users, {
    fields: [tasks.creatorId],
    references: [users.id],
    relationName: "creator",
  }),
  contact: one(contacts, {
    fields: [tasks.contactId],
    references: [contacts.id],
  }),
  deal: one(deals, { fields: [tasks.dealId], references: [deals.id] }),
  company: one(companies, { fields: [tasks.companyId], references: [companies.id] }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  contactTags: many(contactTags),
  dealTags: many(dealTags),
  companyTags: many(companyTags),
}));

export const contactTagsRelations = relations(contactTags, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactTags.contactId],
    references: [contacts.id],
  }),
  tag: one(tags, { fields: [contactTags.tagId], references: [tags.id] }),
}));

export const dealTagsRelations = relations(dealTags, ({ one }) => ({
  deal: one(deals, { fields: [dealTags.dealId], references: [deals.id] }),
  tag: one(tags, { fields: [dealTags.tagId], references: [tags.id] }),
}));

export const companyTagsRelations = relations(companyTags, ({ one }) => ({
  company: one(companies, { fields: [companyTags.companyId], references: [companies.id] }),
  tag: one(tags, { fields: [companyTags.tagId], references: [tags.id] }),
}));

export const gmvSnapshotsRelations = relations(gmvSnapshots, ({ one }) => ({
  contact: one(contacts, {
    fields: [gmvSnapshots.contactId],
    references: [contacts.id],
  }),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  user: one(users, { fields: [alerts.userId], references: [users.id] }),
  contact: one(contacts, {
    fields: [alerts.contactId],
    references: [contacts.id],
  }),
  deal: one(deals, { fields: [alerts.dealId], references: [deals.id] }),
}));

export const savedViewsRelations = relations(savedViews, ({ one, many }) => ({
  user: one(users, { fields: [savedViews.userId], references: [users.id] }),
  roleAccess: many(savedViewRoleAccess),
}));

export const savedViewRoleAccessRelations = relations(
  savedViewRoleAccess,
  ({ one }) => ({
    savedView: one(savedViews, {
      fields: [savedViewRoleAccess.savedViewId],
      references: [savedViews.id],
    }),
  })
);

export const adminNavItemsRelations = relations(
  adminNavItems,
  ({ one, many }) => ({
    parent: one(adminNavItems, {
      fields: [adminNavItems.parentId],
      references: [adminNavItems.id],
      relationName: "navChildren",
    }),
    children: many(adminNavItems, { relationName: "navChildren" }),
    savedView: one(savedViews, {
      fields: [adminNavItems.savedViewId],
      references: [savedViews.id],
    }),
    roleAccess: many(adminNavRoleAccess),
  })
);

export const adminNavRoleAccessRelations = relations(
  adminNavRoleAccess,
  ({ one }) => ({
    navItem: one(adminNavItems, {
      fields: [adminNavRoleAccess.navItemId],
      references: [adminNavItems.id],
    }),
  })
);

export const adminReportsRelations = relations(
  adminReports,
  ({ one, many }) => ({
    creator: one(users, {
      fields: [adminReports.createdBy],
      references: [users.id],
    }),
    roleAccess: many(adminReportRoleAccess),
  })
);

export const adminReportRoleAccessRelations = relations(
  adminReportRoleAccess,
  ({ one }) => ({
    report: one(adminReports, {
      fields: [adminReportRoleAccess.reportId],
      references: [adminReports.id],
    }),
  })
);

export const emailTemplatesRelations = relations(emailTemplates, ({ one }) => ({
  creator: one(users, { fields: [emailTemplates.createdBy], references: [users.id] }),
}));

export const changeHistoryRelations = relations(changeHistory, ({ one }) => ({
  user: one(users, { fields: [changeHistory.userId], references: [users.id] }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(users, { fields: [auditLog.userId], references: [users.id] }),
}));

export const importJobsRelations = relations(importJobs, ({ one }) => ({
  user: one(users, { fields: [importJobs.userId], references: [users.id] }),
}));

export const gatekeeperDecisionLogRelations = relations(gatekeeperDecisionLog, ({ one }) => ({
  user: one(users, { fields: [gatekeeperDecisionLog.userId], references: [users.id] }),
  importJob: one(importJobs, { fields: [gatekeeperDecisionLog.importJobId], references: [importJobs.id] }),
}));

export const gatekeeperReviewQueueRelations = relations(gatekeeperReviewQueue, ({ one }) => ({
  submitter: one(users, { fields: [gatekeeperReviewQueue.submittedBy], references: [users.id], relationName: "submitter" }),
  reviewer: one(users, { fields: [gatekeeperReviewQueue.reviewedBy], references: [users.id], relationName: "reviewer" }),
  importJob: one(importJobs, { fields: [gatekeeperReviewQueue.importJobId], references: [importJobs.id] }),
}));

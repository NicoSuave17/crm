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
  primaryKey,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

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

export const alertTypeEnum = pgEnum("alert_type", [
  "gmv_drop",
  "gmv_milestone",
  "churn_risk_increase",
  "inactive_creator",
  "deal_stale",
  "task_overdue",
  "health_score_drop",
  "new_creator_onboarded",
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

// ─── Users ──────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  avatarUrl: text("avatar_url"),
  role: userRoleEnum("role").notNull().default("ae"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Contacts ───────────────────────────────────────────────────

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    email: text("email"),
    phone: text("phone"),
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
  ]
);

// ─── Companies ──────────────────────────────────────────────────

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  domain: text("domain"),
  industry: text("industry"),
  size: companySizeEnum("size"),
  description: text("description"),
  linkedinUrl: text("linkedin_url"),
  websiteUrl: text("website_url"),
  ownerId: uuid("owner_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
  color: text("color").notNull().default("#6B7280"),
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

// ─── Relations ──────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  ownedContacts: many(contacts),
  ownedDeals: many(deals),
  assignedTasks: many(tasks, { relationName: "assignee" }),
  createdTasks: many(tasks, { relationName: "creator" }),
  activities: many(activities),
  alerts: many(alerts),
  savedViews: many(savedViews),
  emailTemplates: many(emailTemplates),
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
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  contactTags: many(contactTags),
  dealTags: many(dealTags),
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

export const savedViewsRelations = relations(savedViews, ({ one }) => ({
  user: one(users, { fields: [savedViews.userId], references: [users.id] }),
}));

export const emailTemplatesRelations = relations(emailTemplates, ({ one }) => ({
  creator: one(users, { fields: [emailTemplates.createdBy], references: [users.id] }),
}));

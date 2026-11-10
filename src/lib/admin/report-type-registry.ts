export interface ReportField {
  key: string;
  label: string;
  type: "text" | "number" | "currency" | "date" | "boolean" | "enum";
  entity: string;
  column: string;
  aggregatable: boolean;
  groupable: boolean;
  filterable: boolean;
  enumValues?: string[];
}

export interface ReportType {
  key: string;
  label: string;
  description: string;
  baseEntity: string;
  joins: {
    entity: string;
    alias: string;
    type: "inner" | "left";
    on: [string, string];
  }[];
  availableFields: ReportField[];
}

// ─── Field Definitions ──────────────────────────────────────────

const CONTACT_FIELDS: ReportField[] = [
  { key: "contact.firstName", label: "First Name", type: "text", entity: "contacts", column: "first_name", aggregatable: false, groupable: false, filterable: true },
  { key: "contact.lastName", label: "Last Name", type: "text", entity: "contacts", column: "last_name", aggregatable: false, groupable: false, filterable: true },
  { key: "contact.email", label: "Email", type: "text", entity: "contacts", column: "email", aggregatable: false, groupable: false, filterable: true },
  { key: "contact.type", label: "Contact Type", type: "enum", entity: "contacts", column: "type", aggregatable: false, groupable: true, filterable: true, enumValues: ["creator", "lead", "enterprise_prospect", "partner"] },
  { key: "contact.status", label: "Contact Status", type: "enum", entity: "contacts", column: "status", aggregatable: false, groupable: true, filterable: true, enumValues: ["active", "churned", "at_risk", "prospect", "closed_lost"] },
  { key: "contact.tier", label: "Tier", type: "enum", entity: "contacts", column: "tier", aggregatable: false, groupable: true, filterable: true, enumValues: ["enterprise", "premium", "standard", "starter"] },
  { key: "contact.healthScore", label: "Health Score", type: "number", entity: "contacts", column: "health_score", aggregatable: true, groupable: false, filterable: true },
  { key: "contact.currentMrr", label: "Current MRR", type: "currency", entity: "contacts", column: "current_mrr", aggregatable: true, groupable: false, filterable: true },
  { key: "contact.currentGmv", label: "Current GMV", type: "currency", entity: "contacts", column: "current_gmv", aggregatable: true, groupable: false, filterable: true },
  { key: "contact.lifetimeGmv", label: "Lifetime GMV", type: "currency", entity: "contacts", column: "lifetime_gmv", aggregatable: true, groupable: false, filterable: true },
  { key: "contact.memberCount", label: "Member Count", type: "number", entity: "contacts", column: "member_count", aggregatable: true, groupable: false, filterable: true },
  { key: "contact.vertical", label: "Vertical", type: "enum", entity: "contacts", column: "vertical", aggregatable: false, groupable: true, filterable: true },
  { key: "contact.churnRisk", label: "Churn Risk", type: "enum", entity: "contacts", column: "churn_risk", aggregatable: false, groupable: true, filterable: true, enumValues: ["low", "medium", "high", "critical"] },
  { key: "contact.source", label: "Source", type: "enum", entity: "contacts", column: "source", aggregatable: false, groupable: true, filterable: true },
  { key: "contact.createdAt", label: "Created At", type: "date", entity: "contacts", column: "created_at", aggregatable: false, groupable: true, filterable: true },
];

const OWNER_FIELDS: ReportField[] = [
  { key: "owner.firstName", label: "Owner First Name", type: "text", entity: "users", column: "first_name", aggregatable: false, groupable: true, filterable: true },
  { key: "owner.lastName", label: "Owner Last Name", type: "text", entity: "users", column: "last_name", aggregatable: false, groupable: false, filterable: true },
  { key: "owner.role", label: "Owner Role", type: "enum", entity: "users", column: "role", aggregatable: false, groupable: true, filterable: true, enumValues: ["admin", "manager", "account_manager", "ae", "enterprise_sales"] },
];

const DEAL_FIELDS: ReportField[] = [
  { key: "deal.title", label: "Deal Title", type: "text", entity: "deals", column: "title", aggregatable: false, groupable: false, filterable: true },
  { key: "deal.value", label: "Deal Value", type: "currency", entity: "deals", column: "value", aggregatable: true, groupable: false, filterable: true },
  { key: "deal.expectedMrr", label: "Expected MRR", type: "currency", entity: "deals", column: "expected_mrr", aggregatable: true, groupable: false, filterable: true },
  { key: "deal.priority", label: "Priority", type: "enum", entity: "deals", column: "priority", aggregatable: false, groupable: true, filterable: true, enumValues: ["low", "medium", "high", "urgent"] },
  { key: "deal.expectedCloseDate", label: "Expected Close", type: "date", entity: "deals", column: "expected_close_date", aggregatable: false, groupable: true, filterable: true },
  { key: "deal.actualCloseDate", label: "Actual Close", type: "date", entity: "deals", column: "actual_close_date", aggregatable: false, groupable: true, filterable: true },
  { key: "deal.createdAt", label: "Created At", type: "date", entity: "deals", column: "created_at", aggregatable: false, groupable: true, filterable: true },
];

const STAGE_FIELDS: ReportField[] = [
  { key: "stage.name", label: "Stage Name", type: "text", entity: "pipeline_stages", column: "name", aggregatable: false, groupable: true, filterable: true },
  { key: "stage.probability", label: "Stage Probability", type: "number", entity: "pipeline_stages", column: "probability", aggregatable: true, groupable: false, filterable: true },
  { key: "stage.isWon", label: "Is Won", type: "boolean", entity: "pipeline_stages", column: "is_won", aggregatable: false, groupable: true, filterable: true },
  { key: "stage.isLost", label: "Is Lost", type: "boolean", entity: "pipeline_stages", column: "is_lost", aggregatable: false, groupable: true, filterable: true },
];

const PIPELINE_FIELDS: ReportField[] = [
  { key: "pipeline.name", label: "Pipeline Name", type: "text", entity: "pipelines", column: "name", aggregatable: false, groupable: true, filterable: true },
  { key: "pipeline.type", label: "Pipeline Type", type: "enum", entity: "pipelines", column: "type", aggregatable: false, groupable: true, filterable: true, enumValues: ["seller_onboarding", "enterprise", "partnerships", "custom"] },
];

const ACTIVITY_FIELDS: ReportField[] = [
  { key: "activity.type", label: "Activity Type", type: "enum", entity: "activities", column: "type", aggregatable: false, groupable: true, filterable: true, enumValues: ["note", "call", "email_sent", "email_received", "meeting", "linkedin_message", "task_completed", "deal_stage_change", "health_score_change", "gmv_milestone", "churn_alert", "system_event"] },
  { key: "activity.subject", label: "Subject", type: "text", entity: "activities", column: "subject", aggregatable: false, groupable: false, filterable: true },
  { key: "activity.occurredAt", label: "Occurred At", type: "date", entity: "activities", column: "occurred_at", aggregatable: false, groupable: true, filterable: true },
  { key: "activity.duration", label: "Duration (min)", type: "number", entity: "activities", column: "duration", aggregatable: true, groupable: false, filterable: true },
];

const TASK_FIELDS: ReportField[] = [
  { key: "task.title", label: "Task Title", type: "text", entity: "tasks", column: "title", aggregatable: false, groupable: false, filterable: true },
  { key: "task.status", label: "Task Status", type: "enum", entity: "tasks", column: "status", aggregatable: false, groupable: true, filterable: true, enumValues: ["pending", "in_progress", "completed", "cancelled"] },
  { key: "task.priority", label: "Task Priority", type: "enum", entity: "tasks", column: "priority", aggregatable: false, groupable: true, filterable: true, enumValues: ["low", "medium", "high", "urgent"] },
  { key: "task.dueDate", label: "Due Date", type: "date", entity: "tasks", column: "due_date", aggregatable: false, groupable: true, filterable: true },
  { key: "task.createdAt", label: "Created At", type: "date", entity: "tasks", column: "created_at", aggregatable: false, groupable: true, filterable: true },
];

const COMPANY_FIELDS: ReportField[] = [
  { key: "company.name", label: "Company Name", type: "text", entity: "companies", column: "name", aggregatable: false, groupable: true, filterable: true },
  { key: "company.industry", label: "Industry", type: "text", entity: "companies", column: "industry", aggregatable: false, groupable: true, filterable: true },
  { key: "company.size", label: "Company Size", type: "enum", entity: "companies", column: "size", aggregatable: false, groupable: true, filterable: true, enumValues: ["1-10", "11-50", "51-200", "201-1000", "1000+"] },
  { key: "company.vertical", label: "Vertical", type: "enum", entity: "companies", column: "vertical", aggregatable: false, groupable: true, filterable: true },
];

const GMV_SNAPSHOT_FIELDS: ReportField[] = [
  { key: "gmv.date", label: "Date", type: "date", entity: "gmv_snapshots", column: "date", aggregatable: false, groupable: true, filterable: true },
  { key: "gmv.gmv", label: "GMV", type: "currency", entity: "gmv_snapshots", column: "gmv", aggregatable: true, groupable: false, filterable: true },
  { key: "gmv.mrr", label: "MRR", type: "currency", entity: "gmv_snapshots", column: "mrr", aggregatable: true, groupable: false, filterable: true },
  { key: "gmv.memberCount", label: "Member Count", type: "number", entity: "gmv_snapshots", column: "member_count", aggregatable: true, groupable: false, filterable: true },
];

// ─── Report Type Registry ───────────────────────────────────────

export const REPORT_TYPE_REGISTRY: Record<string, ReportType> = {
  contacts: {
    key: "contacts",
    label: "Contacts",
    description: "Contact lists and segments",
    baseEntity: "contacts",
    joins: [
      { entity: "users", alias: "owner", type: "left", on: ["owner_id", "id"] },
    ],
    availableFields: [...CONTACT_FIELDS, ...OWNER_FIELDS],
  },

  contacts_with_companies: {
    key: "contacts_with_companies",
    label: "Contacts with Companies",
    description: "Contact-company analysis",
    baseEntity: "contacts",
    joins: [
      { entity: "users", alias: "owner", type: "left", on: ["owner_id", "id"] },
      { entity: "contact_companies", alias: "cc", type: "left", on: ["id", "contact_id"] },
      { entity: "companies", alias: "company", type: "left", on: ["cc.company_id", "id"] },
    ],
    availableFields: [...CONTACT_FIELDS, ...OWNER_FIELDS, ...COMPANY_FIELDS],
  },

  deals: {
    key: "deals",
    label: "Deals",
    description: "Deal pipeline analysis",
    baseEntity: "deals",
    joins: [
      { entity: "pipeline_stages", alias: "stage", type: "inner", on: ["stage_id", "id"] },
      { entity: "pipelines", alias: "pipeline", type: "inner", on: ["pipeline_id", "id"] },
      { entity: "users", alias: "owner", type: "left", on: ["owner_id", "id"] },
      { entity: "contacts", alias: "contact", type: "left", on: ["contact_id", "id"] },
    ],
    availableFields: [...DEAL_FIELDS, ...STAGE_FIELDS, ...PIPELINE_FIELDS, ...OWNER_FIELDS, ...CONTACT_FIELDS],
  },

  deals_with_companies: {
    key: "deals_with_companies",
    label: "Deals with Companies",
    description: "Full deal reporting with company data",
    baseEntity: "deals",
    joins: [
      { entity: "pipeline_stages", alias: "stage", type: "inner", on: ["stage_id", "id"] },
      { entity: "pipelines", alias: "pipeline", type: "inner", on: ["pipeline_id", "id"] },
      { entity: "users", alias: "owner", type: "left", on: ["owner_id", "id"] },
      { entity: "contacts", alias: "contact", type: "left", on: ["contact_id", "id"] },
      { entity: "companies", alias: "company", type: "left", on: ["company_id", "id"] },
    ],
    availableFields: [...DEAL_FIELDS, ...STAGE_FIELDS, ...PIPELINE_FIELDS, ...OWNER_FIELDS, ...CONTACT_FIELDS, ...COMPANY_FIELDS],
  },

  activities: {
    key: "activities",
    label: "Activities",
    description: "Activity volume and trends",
    baseEntity: "activities",
    joins: [
      { entity: "users", alias: "owner", type: "left", on: ["user_id", "id"] },
      { entity: "contacts", alias: "contact", type: "left", on: ["contact_id", "id"] },
      { entity: "deals", alias: "deal", type: "left", on: ["deal_id", "id"] },
    ],
    availableFields: [...ACTIVITY_FIELDS, ...OWNER_FIELDS, ...CONTACT_FIELDS],
  },

  activities_by_contact: {
    key: "activities_by_contact",
    label: "Activities by Contact",
    description: "Per-contact engagement analysis",
    baseEntity: "activities",
    joins: [
      { entity: "contacts", alias: "contact", type: "inner", on: ["contact_id", "id"] },
      { entity: "users", alias: "owner", type: "left", on: ["user_id", "id"] },
    ],
    availableFields: [...ACTIVITY_FIELDS, ...CONTACT_FIELDS, ...OWNER_FIELDS],
  },

  tasks: {
    key: "tasks",
    label: "Tasks",
    description: "Task tracking and analysis",
    baseEntity: "tasks",
    joins: [
      { entity: "users", alias: "assignee", type: "left", on: ["assignee_id", "id"] },
      { entity: "contacts", alias: "contact", type: "left", on: ["contact_id", "id"] },
      { entity: "deals", alias: "deal", type: "left", on: ["deal_id", "id"] },
    ],
    availableFields: [...TASK_FIELDS, ...OWNER_FIELDS, ...CONTACT_FIELDS],
  },

  pipeline_conversion: {
    key: "pipeline_conversion",
    label: "Pipeline Conversion",
    description: "Stage-to-stage conversion rates",
    baseEntity: "deal_stage_history",
    joins: [
      { entity: "deals", alias: "deal", type: "inner", on: ["deal_id", "id"] },
      { entity: "users", alias: "owner", type: "left", on: ["user_id", "id"] },
    ],
    availableFields: [
      { key: "history.changedAt", label: "Changed At", type: "date", entity: "deal_stage_history", column: "changed_at", aggregatable: false, groupable: true, filterable: true },
      ...DEAL_FIELDS,
      ...OWNER_FIELDS,
    ],
  },

  gmv_snapshots: {
    key: "gmv_snapshots",
    label: "GMV Snapshots",
    description: "GMV/MRR time series data",
    baseEntity: "gmv_snapshots",
    joins: [
      { entity: "contacts", alias: "contact", type: "inner", on: ["contact_id", "id"] },
    ],
    availableFields: [...GMV_SNAPSHOT_FIELDS, ...CONTACT_FIELDS],
  },

  portfolio_health: {
    key: "portfolio_health",
    label: "Portfolio Health",
    description: "Portfolio health analysis for creators",
    baseEntity: "contacts",
    joins: [
      { entity: "users", alias: "owner", type: "left", on: ["owner_id", "id"] },
    ],
    availableFields: [...CONTACT_FIELDS, ...OWNER_FIELDS],
  },
};

export function getReportType(key: string): ReportType | undefined {
  return REPORT_TYPE_REGISTRY[key];
}

export function listReportTypes(): ReportType[] {
  return Object.values(REPORT_TYPE_REGISTRY);
}

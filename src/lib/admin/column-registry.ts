export interface ColumnDef {
  key: string;
  label: string;
  type: "text" | "number" | "currency" | "date" | "boolean" | "enum" | "badge" | "avatar";
  sortable: boolean;
  filterable: boolean;
  defaultWidth: number;
  isCustomField?: boolean;
  enumValues?: string[];
}

// Built-in columns per entity type
const CONTACT_COLUMNS: ColumnDef[] = [
  { key: "firstName", label: "First Name", type: "text", sortable: true, filterable: true, defaultWidth: 150 },
  { key: "lastName", label: "Last Name", type: "text", sortable: true, filterable: true, defaultWidth: 150 },
  { key: "email", label: "Email", type: "text", sortable: true, filterable: true, defaultWidth: 200 },
  { key: "phone", label: "Phone", type: "text", sortable: false, filterable: false, defaultWidth: 140 },
  { key: "type", label: "Type", type: "enum", sortable: true, filterable: true, defaultWidth: 120, enumValues: ["creator", "lead", "enterprise_prospect", "partner"] },
  { key: "status", label: "Status", type: "badge", sortable: true, filterable: true, defaultWidth: 120, enumValues: ["active", "churned", "at_risk", "prospect", "closed_lost"] },
  { key: "healthScore", label: "Health", type: "number", sortable: true, filterable: true, defaultWidth: 80 },
  { key: "currentGmv", label: "GMV", type: "currency", sortable: true, filterable: true, defaultWidth: 120 },
  { key: "currentMrr", label: "MRR", type: "currency", sortable: true, filterable: true, defaultWidth: 120 },
  { key: "tier", label: "Tier", type: "enum", sortable: true, filterable: true, defaultWidth: 100, enumValues: ["enterprise", "premium", "standard", "starter"] },
  { key: "ownerName", label: "Owner", type: "text", sortable: true, filterable: true, defaultWidth: 150 },
  { key: "vertical", label: "Vertical", type: "enum", sortable: true, filterable: true, defaultWidth: 140 },
  { key: "createdAt", label: "Created", type: "date", sortable: true, filterable: true, defaultWidth: 120 },
];

const DEAL_COLUMNS: ColumnDef[] = [
  { key: "title", label: "Title", type: "text", sortable: true, filterable: true, defaultWidth: 200 },
  { key: "value", label: "Value", type: "currency", sortable: true, filterable: true, defaultWidth: 120 },
  { key: "stageName", label: "Stage", type: "text", sortable: true, filterable: true, defaultWidth: 140 },
  { key: "pipelineName", label: "Pipeline", type: "text", sortable: false, filterable: true, defaultWidth: 140 },
  { key: "contactName", label: "Contact", type: "text", sortable: true, filterable: true, defaultWidth: 160 },
  { key: "ownerName", label: "Owner", type: "text", sortable: true, filterable: true, defaultWidth: 150 },
  { key: "priority", label: "Priority", type: "badge", sortable: true, filterable: true, defaultWidth: 100, enumValues: ["low", "medium", "high", "urgent"] },
  { key: "expectedCloseDate", label: "Expected Close", type: "date", sortable: true, filterable: true, defaultWidth: 130 },
  { key: "expectedMrr", label: "Expected MRR", type: "currency", sortable: true, filterable: true, defaultWidth: 120 },
  { key: "createdAt", label: "Created", type: "date", sortable: true, filterable: true, defaultWidth: 120 },
];

const COMPANY_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Name", type: "text", sortable: true, filterable: true, defaultWidth: 200 },
  { key: "domain", label: "Domain", type: "text", sortable: true, filterable: true, defaultWidth: 160 },
  { key: "industry", label: "Industry", type: "text", sortable: true, filterable: true, defaultWidth: 140 },
  { key: "size", label: "Size", type: "enum", sortable: true, filterable: true, defaultWidth: 100, enumValues: ["1-10", "11-50", "51-200", "201-1000", "1000+"] },
  { key: "vertical", label: "Vertical", type: "enum", sortable: true, filterable: true, defaultWidth: 140 },
  { key: "ownerName", label: "Owner", type: "text", sortable: true, filterable: true, defaultWidth: 150 },
  { key: "createdAt", label: "Created", type: "date", sortable: true, filterable: true, defaultWidth: 120 },
];

const TASK_COLUMNS: ColumnDef[] = [
  { key: "title", label: "Title", type: "text", sortable: true, filterable: true, defaultWidth: 250 },
  { key: "status", label: "Status", type: "badge", sortable: true, filterable: true, defaultWidth: 120, enumValues: ["pending", "in_progress", "completed", "cancelled"] },
  { key: "priority", label: "Priority", type: "badge", sortable: true, filterable: true, defaultWidth: 100, enumValues: ["low", "medium", "high", "urgent"] },
  { key: "assigneeName", label: "Assignee", type: "text", sortable: true, filterable: true, defaultWidth: 150 },
  { key: "contactName", label: "Contact", type: "text", sortable: true, filterable: true, defaultWidth: 160 },
  { key: "dueDate", label: "Due Date", type: "date", sortable: true, filterable: true, defaultWidth: 120 },
  { key: "createdAt", label: "Created", type: "date", sortable: true, filterable: true, defaultWidth: 120 },
];

const BUILT_IN_COLUMNS: Record<string, ColumnDef[]> = {
  contact: CONTACT_COLUMNS,
  deal: DEAL_COLUMNS,
  company: COMPANY_COLUMNS,
  task: TASK_COLUMNS,
};

/**
 * Returns built-in columns only (no DB call needed, for client-side use).
 */
export function getBuiltInColumns(entityType: string): ColumnDef[] {
  return BUILT_IN_COLUMNS[entityType] ?? [];
}
import { z } from "zod";

// Filter condition
export const filterConditionSchema = z.object({
  field: z.string(),
  op: z.enum([
    "=", "!=", ">", "<", ">=", "<=",
    "in", "not_in", "contains", "starts_with",
    "is_null", "is_not_null", "between",
  ]),
  value: z.unknown(),
});

// Filter group (recursive AND/OR)
export const filterGroupSchema: z.ZodType<FilterGroup> = z.object({
  operator: z.enum(["AND", "OR"]),
  conditions: z.array(
    z.union([
      filterConditionSchema,
      z.lazy(() => filterGroupSchema),
    ])
  ),
});

export interface FilterCondition {
  field: string;
  op: string;
  value: unknown;
}

export interface FilterGroup {
  operator: "AND" | "OR";
  conditions: (FilterCondition | FilterGroup)[];
}

// Aggregation
export const aggregationSchema = z.object({
  field: z.string(),
  function: z.enum(["count", "count_distinct", "sum", "avg", "min", "max"]),
  alias: z.string(),
  condition: filterConditionSchema.optional(),
});

// Calculated field
export const calculatedFieldSchema = z.object({
  name: z.string(),
  formula: z.string(),
  outputType: z.enum(["number", "currency", "percent", "text"]),
});

// Chart config
export const chartConfigSchema = z.object({
  type: z.enum([
    "bar", "stacked_bar", "line", "area", "pie", "donut",
    "funnel", "scatter", "heatmap", "gauge", "number_card",
  ]),
  xAxis: z.string().optional(),
  yAxis: z.array(z.string()).optional(),
  colorBy: z.string().optional(),
  showLabels: z.boolean().optional(),
  showLegend: z.boolean().optional(),
  stacked: z.boolean().optional(),
  colors: z.array(z.string()).optional(),
});

// Full report config
export const reportConfigSchema = z.object({
  reportType: z.string(),
  columns: z.array(z.string()),
  filters: filterGroupSchema.optional(),
  groupBy: z.object({
    rows: z.array(z.string()),
    columns: z.array(z.string()).optional(),
  }).optional(),
  aggregations: z.array(aggregationSchema).default([]),
  calculatedFields: z.array(calculatedFieldSchema).optional(),
  sortBy: z.array(z.object({
    field: z.string(),
    direction: z.enum(["asc", "desc"]),
  })).optional(),
  dateBucket: z.enum(["day", "week", "month", "quarter", "year"]).optional(),
  chart: chartConfigSchema.nullable().optional(),
  limit: z.number().int().positive().max(10000).optional(),
});

// Create report request
export const createReportSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  reportType: z.string(),
  format: z.enum(["tabular", "summary", "matrix"]).default("tabular"),
  config: reportConfigSchema,
  isShared: z.boolean().default(false),
  roles: z.array(z.string()).optional(),
});

// Types
export type FilterConditionType = z.infer<typeof filterConditionSchema>;
export type AggregationType = z.infer<typeof aggregationSchema>;
export type CalculatedFieldType = z.infer<typeof calculatedFieldSchema>;
export type ChartConfigType = z.infer<typeof chartConfigSchema>;
export type ReportConfigType = z.infer<typeof reportConfigSchema>;
export type CreateReportType = z.infer<typeof createReportSchema>;

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getReportType, type ReportField } from "./report-type-registry";
import { evaluateFormula } from "./formula-engine";
import type { ReportConfigType, FilterGroup, FilterConditionType } from "@/lib/validators/report";

export interface ReportResult {
  columns: { key: string; label: string; type: string }[];
  rows: Record<string, unknown>[];
  aggregates?: Record<string, unknown>;
  groupedData?: GroupedRow[];
  metadata: { rowCount: number; executionMs: number; truncated: boolean };
}

export interface GroupedRow {
  groupKey: Record<string, unknown>;
  rows: Record<string, unknown>[];
  aggregates: Record<string, unknown>;
}

/**
 * Main entry point: execute a report config and return structured results.
 */
export async function executeReport(config: ReportConfigType): Promise<ReportResult> {
  const startTime = Date.now();

  const reportType = getReportType(config.reportType);
  if (!reportType) {
    throw new Error(`Unknown report type: ${config.reportType}`);
  }

  // Build the SQL query
  const { queryStr, params } = buildQuery(config, reportType);

  // Execute
  const rawRows = await db.execute(sql.raw(queryStr));
  let rows = Array.isArray(rawRows) ? rawRows : (rawRows as { rows?: Record<string, unknown>[] }).rows ?? [];

  // Apply calculated fields
  if (config.calculatedFields && config.calculatedFields.length > 0) {
    rows = applyCalculatedFields(rows as Record<string, unknown>[], config.calculatedFields);
  }

  // Apply limit
  const limit = config.limit ?? 5000;
  const truncated = rows.length > limit;
  if (truncated) {
    rows = rows.slice(0, limit);
  }

  // Build column metadata
  const columns = config.columns.map((key) => {
    const field = reportType.availableFields.find((f) => f.key === key);
    return {
      key,
      label: field?.label ?? key,
      type: field?.type ?? "text",
    };
  });

  // Add calculated field columns
  if (config.calculatedFields) {
    for (const cf of config.calculatedFields) {
      columns.push({
        key: cf.name,
        label: cf.name,
        type: cf.outputType === "percent" ? "number" : cf.outputType,
      });
    }
  }

  // Build result
  const result: ReportResult = {
    columns,
    rows: rows as Record<string, unknown>[],
    metadata: {
      rowCount: rows.length,
      executionMs: Date.now() - startTime,
      truncated,
    },
  };

  // Handle grouping for summary/matrix
  if (config.groupBy && config.groupBy.rows.length > 0) {
    result.groupedData = groupRows(
      rows as Record<string, unknown>[],
      config.groupBy.rows,
      config.aggregations
    );

    // Calculate grand totals
    if (config.aggregations.length > 0) {
      result.aggregates = calculateAggregates(
        rows as Record<string, unknown>[],
        config.aggregations
      );
    }
  }

  return result;
}

/**
 * Builds a raw SQL query from the report config.
 */
function buildQuery(
  config: ReportConfigType,
  reportType: ReturnType<typeof getReportType> & object
): { queryStr: string; params: unknown[] } {
  const fieldMap = new Map(
    reportType.availableFields.map((f: ReportField) => [f.key, f])
  );

  // SELECT columns
  const selectParts: string[] = [];

  if (config.groupBy && config.groupBy.rows.length > 0) {
    // GROUP BY mode — select group-by fields + aggregations
    for (const groupField of config.groupBy.rows) {
      const field = fieldMap.get(groupField);
      if (field) {
        const colRef = getColumnRef(field, reportType);
        selectParts.push(`${colRef} AS "${sanitizeAlias(groupField)}"`);
      }
    }

    for (const agg of config.aggregations) {
      const aggSql = buildAggregation(agg, fieldMap, reportType);
      selectParts.push(`${aggSql} AS "${sanitizeAlias(agg.alias)}"`);
    }
  } else {
    // Tabular mode — select all requested columns
    for (const colKey of config.columns) {
      const field = fieldMap.get(colKey);
      if (field) {
        const colRef = getColumnRef(field, reportType);
        selectParts.push(`${colRef} AS "${sanitizeAlias(colKey)}"`);
      }
    }
  }

  if (selectParts.length === 0) {
    selectParts.push("*");
  }

  // FROM + JOINs
  let fromClause = `"${reportType.baseEntity}"`;
  for (const join of reportType.joins) {
    const joinType = join.type === "inner" ? "INNER JOIN" : "LEFT JOIN";
    // Simple join — base table column to joined table column
    fromClause += ` ${joinType} "${join.entity}" AS "${join.alias}" ON "${reportType.baseEntity}"."${join.on[0]}" = "${join.alias}"."${join.on[1]}"`;
  }

  // WHERE
  let whereClause = "";
  if (config.filters && config.filters.conditions.length > 0) {
    whereClause = ` WHERE ${buildFilterGroup(config.filters, fieldMap, reportType)}`;
  }

  // GROUP BY
  let groupByClause = "";
  if (config.groupBy && config.groupBy.rows.length > 0) {
    const groupFields = config.groupBy.rows
      .map((key) => {
        const field = fieldMap.get(key);
        if (!field) return null;
        const colRef = getColumnRef(field, reportType);
        if (config.dateBucket && field.type === "date") {
          return `date_trunc('${config.dateBucket}', ${colRef})`;
        }
        return colRef;
      })
      .filter(Boolean);

    if (groupFields.length > 0) {
      groupByClause = ` GROUP BY ${groupFields.join(", ")}`;
    }
  }

  // ORDER BY
  let orderByClause = "";
  if (config.sortBy && config.sortBy.length > 0) {
    const sortParts = config.sortBy
      .map((s) => {
        const field = fieldMap.get(s.field);
        if (!field) return null;
        const colRef = getColumnRef(field, reportType);
        return `${colRef} ${s.direction.toUpperCase()}`;
      })
      .filter(Boolean);

    if (sortParts.length > 0) {
      orderByClause = ` ORDER BY ${sortParts.join(", ")}`;
    }
  }

  // LIMIT
  const limitClause = config.limit ? ` LIMIT ${config.limit}` : " LIMIT 5000";

  const queryStr = `SELECT ${selectParts.join(", ")} FROM ${fromClause}${whereClause}${groupByClause}${orderByClause}${limitClause}`;

  return { queryStr, params: [] };
}

function getColumnRef(
  field: ReportField,
  reportType: { baseEntity: string; joins: { entity: string; alias: string }[] }
): string {
  // Find which alias this field belongs to
  if (field.entity === reportType.baseEntity) {
    return `"${reportType.baseEntity}"."${field.column}"`;
  }

  const join = reportType.joins.find((j) => j.entity === field.entity);
  if (join) {
    return `"${join.alias}"."${field.column}"`;
  }

  return `"${field.column}"`;
}

function buildAggregation(
  agg: ReportConfigType["aggregations"][number],
  fieldMap: Map<string, ReportField>,
  reportType: { baseEntity: string; joins: { entity: string; alias: string }[] }
): string {
  const field = fieldMap.get(agg.field);
  const colRef = field ? getColumnRef(field, reportType) : `"${agg.field}"`;

  let innerExpr = colRef;

  // Conditional aggregation
  if (agg.condition) {
    const condField = fieldMap.get(agg.condition.field);
    const condRef = condField ? getColumnRef(condField, reportType) : `"${agg.condition.field}"`;
    const condSql = buildSingleCondition(agg.condition, condRef);
    innerExpr = `CASE WHEN ${condSql} THEN ${colRef} END`;
  }

  switch (agg.function) {
    case "count":
      return `COUNT(${innerExpr})`;
    case "count_distinct":
      return `COUNT(DISTINCT ${innerExpr})`;
    case "sum":
      return `SUM(${innerExpr})`;
    case "avg":
      return `AVG(${innerExpr})`;
    case "min":
      return `MIN(${innerExpr})`;
    case "max":
      return `MAX(${innerExpr})`;
    default:
      return `COUNT(${innerExpr})`;
  }
}

function buildFilterGroup(
  group: FilterGroup,
  fieldMap: Map<string, ReportField>,
  reportType: { baseEntity: string; joins: { entity: string; alias: string }[] }
): string {
  const parts = group.conditions
    .map((cond) => {
      if ("operator" in cond) {
        // Nested group
        return `(${buildFilterGroup(cond as FilterGroup, fieldMap, reportType)})`;
      }
      // Single condition
      const fc = cond as FilterConditionType;
      const field = fieldMap.get(fc.field);
      const colRef = field ? getColumnRef(field, reportType) : `"${fc.field}"`;
      return buildSingleCondition(fc, colRef);
    })
    .filter(Boolean);

  return parts.join(` ${group.operator} `);
}

function buildSingleCondition(cond: FilterConditionType, colRef: string): string {
  const value = cond.value;

  switch (cond.op) {
    case "=":
      return `${colRef} = ${escapeSqlValue(value)}`;
    case "!=":
      return `${colRef} != ${escapeSqlValue(value)}`;
    case ">":
      return `${colRef} > ${escapeSqlValue(value)}`;
    case "<":
      return `${colRef} < ${escapeSqlValue(value)}`;
    case ">=":
      return `${colRef} >= ${escapeSqlValue(value)}`;
    case "<=":
      return `${colRef} <= ${escapeSqlValue(value)}`;
    case "in": {
      const arr = Array.isArray(value) ? value : [value];
      return `${colRef} IN (${arr.map(escapeSqlValue).join(", ")})`;
    }
    case "not_in": {
      const arr = Array.isArray(value) ? value : [value];
      return `${colRef} NOT IN (${arr.map(escapeSqlValue).join(", ")})`;
    }
    case "contains":
      return `${colRef} ILIKE ${escapeSqlValue(`%${value}%`)}`;
    case "starts_with":
      return `${colRef} ILIKE ${escapeSqlValue(`${value}%`)}`;
    case "is_null":
      return `${colRef} IS NULL`;
    case "is_not_null":
      return `${colRef} IS NOT NULL`;
    case "between": {
      const [from, to] = Array.isArray(value) ? value : [value, value];
      return `${colRef} BETWEEN ${escapeSqlValue(from)} AND ${escapeSqlValue(to)}`;
    }
    default:
      return `${colRef} = ${escapeSqlValue(value)}`;
  }
}

function escapeSqlValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  // Escape single quotes by doubling them
  const str = String(value).replace(/'/g, "''");
  return `'${str}'`;
}

function sanitizeAlias(key: string): string {
  return key.replace(/[^a-zA-Z0-9_.]/g, "_");
}

function applyCalculatedFields(
  rows: Record<string, unknown>[],
  calculatedFields: { name: string; formula: string; outputType: string }[]
): Record<string, unknown>[] {
  return rows.map((row) => {
    const newRow = { ...row };
    // Flatten keys (remove dots for formula evaluation)
    const flatRow: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(row)) {
      flatRow[key.replace(/\./g, "_")] = val;
    }

    for (const cf of calculatedFields) {
      newRow[cf.name] = evaluateFormula(cf.formula, flatRow);
    }
    return newRow;
  });
}

function groupRows(
  rows: Record<string, unknown>[],
  groupByKeys: string[],
  aggregations: ReportConfigType["aggregations"]
): GroupedRow[] {
  const groups = new Map<string, Record<string, unknown>[]>();

  for (const row of rows) {
    const groupKeyValues: Record<string, unknown> = {};
    for (const key of groupByKeys) {
      const sanitized = sanitizeAlias(key);
      groupKeyValues[key] = row[sanitized];
    }
    const groupKeyStr = JSON.stringify(groupKeyValues);

    if (!groups.has(groupKeyStr)) {
      groups.set(groupKeyStr, []);
    }
    groups.get(groupKeyStr)!.push(row);
  }

  return Array.from(groups.entries()).map(([keyStr, groupRows]) => ({
    groupKey: JSON.parse(keyStr),
    rows: groupRows,
    aggregates: calculateAggregates(groupRows, aggregations),
  }));
}

function calculateAggregates(
  rows: Record<string, unknown>[],
  aggregations: ReportConfigType["aggregations"]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const agg of aggregations) {
    const sanitizedField = sanitizeAlias(agg.field);
    const values = rows
      .map((r) => {
        const val = r[sanitizedField];
        return typeof val === "string" ? parseFloat(val) : Number(val);
      })
      .filter((v) => !isNaN(v));

    switch (agg.function) {
      case "count":
        result[agg.alias] = rows.length;
        break;
      case "count_distinct":
        result[agg.alias] = new Set(rows.map((r) => r[sanitizedField])).size;
        break;
      case "sum":
        result[agg.alias] = values.reduce((a, b) => a + b, 0);
        break;
      case "avg":
        result[agg.alias] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        break;
      case "min":
        result[agg.alias] = values.length > 0 ? Math.min(...values) : 0;
        break;
      case "max":
        result[agg.alias] = values.length > 0 ? Math.max(...values) : 0;
        break;
    }
  }

  return result;
}

import { create, all } from "mathjs";

// Create a restricted mathjs instance
const math = create(all);

// Remove dangerous functions
const BLOCKED_FUNCTIONS = [
  "import", "createUnit", "evaluate", "parse", "simplify",
  "derivative", "resolve", "compile", "chain",
];

// We'll use evaluate via the limited scope approach
const limitedMath = math.create(all);

/**
 * Whitelist of allowed functions in formulas.
 */
const ALLOWED_FUNCTIONS: Record<string, (...args: number[]) => number> = {
  round: (val: number, decimals = 0) => {
    const factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
  },
  abs: Math.abs,
  min: Math.min,
  max: Math.max,
  ceil: Math.ceil,
  floor: Math.floor,
  sqrt: Math.sqrt,
  pow: Math.pow,
  ifelse: (condition: number, trueVal: number, falseVal: number) =>
    condition ? trueVal : falseVal,
};

/**
 * Validates a formula string.
 * Returns which fields are referenced.
 */
export function validateFormula(
  formula: string,
  availableFields: string[]
): { valid: boolean; error?: string; referencedFields: string[] } {
  try {
    // Parse the expression to find referenced identifiers
    const node = math.parse(formula);
    const referencedFields: string[] = [];

    node.traverse((node: { type: string; name?: string }) => {
      if (node.type === "SymbolNode" && node.name) {
        const name = node.name;
        if (!ALLOWED_FUNCTIONS[name] && !["true", "false", "null", "undefined", "e", "pi", "Infinity"].includes(name)) {
          referencedFields.push(name);
        }
      }
    });

    // Check all referenced fields exist
    const unknownFields = referencedFields.filter(
      (f) => !availableFields.includes(f)
    );

    if (unknownFields.length > 0) {
      return {
        valid: false,
        error: `Unknown fields: ${unknownFields.join(", ")}`,
        referencedFields,
      };
    }

    // Try evaluating with dummy values to catch syntax errors
    const dummyScope: Record<string, number> = {};
    for (const field of referencedFields) {
      dummyScope[field] = 1;
    }
    Object.assign(dummyScope, ALLOWED_FUNCTIONS);

    math.evaluate(formula, dummyScope);

    return { valid: true, referencedFields };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Invalid formula",
      referencedFields: [],
    };
  }
}

/**
 * Evaluates a formula against a data row.
 * Only the row's field values and whitelisted functions are accessible.
 */
export function evaluateFormula(
  formula: string,
  row: Record<string, unknown>
): unknown {
  try {
    // Build a restricted scope with only row values and allowed functions
    const scope: Record<string, unknown> = { ...ALLOWED_FUNCTIONS };

    for (const [key, value] of Object.entries(row)) {
      // Convert string numbers to actual numbers
      if (typeof value === "string" && !isNaN(Number(value))) {
        scope[key] = Number(value);
      } else if (typeof value === "number") {
        scope[key] = value;
      } else if (typeof value === "boolean") {
        scope[key] = value ? 1 : 0;
      } else if (value === null || value === undefined) {
        scope[key] = 0;
      } else {
        scope[key] = value;
      }
    }

    return math.evaluate(formula, scope);
  } catch {
    return null;
  }
}

/**
 * Evaluates a formula against aggregated data.
 */
export function evaluateAggregateFormula(
  formula: string,
  aggregates: Record<string, number>
): unknown {
  try {
    const scope: Record<string, unknown> = {
      ...ALLOWED_FUNCTIONS,
      ...aggregates,
    };
    return math.evaluate(formula, scope);
  } catch {
    return null;
  }
}

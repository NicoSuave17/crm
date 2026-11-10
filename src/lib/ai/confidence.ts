/**
 * Confidence scoring and zone routing for gatekeeper decisions.
 */

export type ConfidenceZone = "auto_apply" | "review" | "reject";

interface ConfidenceThresholds {
  autoApply: number; // Above this → auto-apply
  review: number;    // Above this → review queue (between review and autoApply)
  // Below review → reject
}

const DEFAULT_THRESHOLDS: ConfidenceThresholds = {
  autoApply: 95,
  review: 70,
};

function getThresholds(): ConfidenceThresholds {
  return {
    autoApply: Number(process.env.GATEKEEPER_AUTO_APPLY_THRESHOLD) || DEFAULT_THRESHOLDS.autoApply,
    review: Number(process.env.GATEKEEPER_REVIEW_THRESHOLD) || DEFAULT_THRESHOLDS.review,
  };
}

/**
 * Calculate overall confidence from chain results.
 * Uses minimum of all chain confidences (weakest link principle).
 */
export function calculateConfidence(scores: {
  normalization?: number;
  entityResolution?: number;
  semanticValidation?: number;
}): number {
  const values = Object.values(scores).filter((v): v is number => v !== undefined && v !== null);
  if (values.length === 0) return 100; // No chains ran = no issues found
  return Math.min(...values);
}

/**
 * Map a confidence score to a zone.
 */
export function getZone(confidence: number): ConfidenceZone {
  const thresholds = getThresholds();
  if (confidence >= thresholds.autoApply) return "auto_apply";
  if (confidence >= thresholds.review) return "review";
  return "reject";
}

/**
 * Calculate normalization confidence based on changes made.
 */
export function normalizationConfidence(
  totalFields: number,
  changesCount: number,
  hasErrors: boolean
): number {
  if (hasErrors) return 50;
  if (totalFields === 0) return 100;
  // More changes = less confidence (data was messier)
  const changeRatio = changesCount / totalFields;
  return Math.max(60, Math.round(100 - changeRatio * 30));
}

/**
 * Calculate entity resolution confidence.
 * If no duplicates found: 100 (clean record)
 * If duplicates found with high AI confidence: uses AI confidence
 * If duplicates found with low AI confidence: routes to review
 */
export function entityResolutionConfidence(
  duplicatesFound: boolean,
  aiConfidence?: number
): number {
  if (!duplicatesFound) return 100;
  return aiConfidence ?? 50;
}

/**
 * Calculate semantic validation confidence.
 */
export function semanticValidationConfidence(
  issues: { severity: "error" | "warning" | "info" }[]
): number {
  if (issues.length === 0) return 100;

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;

  if (errors > 0) return Math.max(20, 60 - errors * 20);
  if (warnings > 0) return Math.max(60, 90 - warnings * 10);
  return 95; // Info-only issues
}

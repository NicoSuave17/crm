/**
 * Whop Brand Color System
 *
 * All semantic color mappings for the CRM.
 * These replace hardcoded Tailwind color classes with brand-aligned values.
 *
 * Brand palette:
 *   Dragon Fire  #FA4616  — primary accent, CTAs
 *   Midnight     #141212  — sidebar, headings
 *   Snow         #FCF6F5  — backgrounds
 *   Byzantine    #1754D8  — links, info
 *   Viridian     #00876D  — success
 *   Burnt Sienna #E86644  — destructive/error
 *   Lemon Lime   #DBF505  — warning/caution
 *   True Purple  #8160CE  — secondary accent
 */

// ── Hex values (for inline styles, charts, DB defaults) ─────────────

export const BRAND_HEX = {
  dragonFire: "#FA4616",
  midnight: "#141212",
  snow: "#FCF6F5",
  byzantine: "#1754D8",
  viridian: "#00876D",
  burntSienna: "#E86644",
  lemonLime: "#DBF505",
  truePurple: "#8160CE",
  thulianPink: "#E26394",
  oxfordBlue: "#09142E",
  body: "#3D3534",
  muted: "#8A7E7D",
  border: "#EDE7E6",
} as const;

// ── Chart color sequence (for Recharts, pie charts, etc.) ───────────

export const CHART_COLORS = [
  BRAND_HEX.dragonFire,   // #FA4616
  BRAND_HEX.byzantine,    // #1754D8
  BRAND_HEX.viridian,     // #00876D
  BRAND_HEX.burntSienna,  // #E86644
  BRAND_HEX.truePurple,   // #8160CE
  BRAND_HEX.thulianPink,  // #E26394
  BRAND_HEX.midnight,     // #141212
  BRAND_HEX.muted,        // #8A7E7D
] as const;

// ── Pipeline stage default colors ───────────────────────────────────

export const STAGE_COLORS = {
  lead: BRAND_HEX.muted,         // #8A7E7D
  qualified: BRAND_HEX.byzantine, // #1754D8
  demo: BRAND_HEX.truePurple,    // #8160CE
  proposal: BRAND_HEX.dragonFire, // #FA4616
  won: BRAND_HEX.viridian,       // #00876D
  lost: BRAND_HEX.burntSienna,   // #E86644
} as const;

export const STAGE_FALLBACK = BRAND_HEX.muted;

// ── Priority badge classes ──────────────────────────────────────────

export const PRIORITY_COLORS: Record<string, string> = {
  urgent:
    "bg-[#E86644]/10 text-[#E86644] dark:bg-[#E86644]/20 dark:text-[#E86644]",
  high:
    "bg-[#FA4616]/10 text-[#FA4616] dark:bg-[#FA4616]/20 dark:text-[#FA4616]",
  medium:
    "bg-[#1754D8]/10 text-[#1754D8] dark:bg-[#1754D8]/20 dark:text-[#1754D8]",
  low:
    "bg-[#EDE7E6] text-[#8A7E7D] dark:bg-[#3D3534]/30 dark:text-[#8A7E7D]",
};

// ── Health score badge classes ──────────────────────────────────────

export const HEALTH_COLORS = {
  good: "bg-[#00876D]/10 text-[#00876D] dark:bg-[#00876D]/20 dark:text-[#00876D]",
  fair: "bg-[#FA4616]/10 text-[#FA4616] dark:bg-[#FA4616]/20 dark:text-[#FA4616]",
  poor: "bg-[#E86644]/10 text-[#E86644] dark:bg-[#E86644]/20 dark:text-[#E86644]",
} as const;

// ── Churn risk badge classes ────────────────────────────────────────

export const CHURN_RISK_COLORS: Record<string, string> = {
  low: "bg-[#00876D]/10 text-[#00876D] dark:bg-[#00876D]/20 dark:text-[#00876D]",
  medium:
    "bg-[#FA4616]/10 text-[#FA4616] dark:bg-[#FA4616]/20 dark:text-[#FA4616]",
  high:
    "bg-[#E86644]/10 text-[#E86644] dark:bg-[#E86644]/20 dark:text-[#E86644]",
  critical:
    "bg-[#E86644]/15 text-[#E86644] dark:bg-[#E86644]/25 dark:text-[#E86644]",
};

// ── Alert / notification severity ───────────────────────────────────

export const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-[#E86644] dark:text-[#E86644]",
  warning: "text-[#FA4616] dark:text-[#FA4616]",
  info: "text-[#1754D8] dark:text-[#1754D8]",
};

// ── Vertical badge classes ──────────────────────────────────────────

export const VERTICAL_COLORS: Record<string, string> = {
  sports_picks:
    "bg-[#00876D]/10 text-[#00876D] dark:bg-[#00876D]/20 dark:text-[#00876D]",
  crypto_trading:
    "bg-[#FA4616]/10 text-[#FA4616] dark:bg-[#FA4616]/20 dark:text-[#FA4616]",
  coaching_courses:
    "bg-[#1754D8]/10 text-[#1754D8] dark:bg-[#1754D8]/20 dark:text-[#1754D8]",
  communities:
    "bg-[#8160CE]/10 text-[#8160CE] dark:bg-[#8160CE]/20 dark:text-[#8160CE]",
  software_saas:
    "bg-[#09142E]/10 text-[#09142E] dark:bg-[#09142E]/20 dark:text-[#FCF6F5]",
  templates:
    "bg-[#E26394]/10 text-[#E26394] dark:bg-[#E26394]/20 dark:text-[#E26394]",
  agency:
    "bg-[#E86644]/10 text-[#E86644] dark:bg-[#E86644]/20 dark:text-[#E86644]",
  content_media:
    "bg-[#1754D8]/15 text-[#1754D8] dark:bg-[#1754D8]/25 dark:text-[#1754D8]",
  affiliate_networks:
    "bg-[#FA4616]/15 text-[#FA4616] dark:bg-[#FA4616]/25 dark:text-[#FA4616]",
};

// ── Health chart hex values (for portfolio API / Recharts) ──────────

export const HEALTH_CHART_COLORS = {
  critical: BRAND_HEX.burntSienna, // #E86644
  poor: BRAND_HEX.dragonFire,      // #FA4616
  fair: BRAND_HEX.truePurple,      // #8160CE  (neutral mid-range)
  good: BRAND_HEX.viridian,        // #00876D
} as const;

// ── Stage color picker palette ──────────────────────────────────────

export const STAGE_PICKER_COLORS = [
  BRAND_HEX.burntSienna,  // #E86644
  BRAND_HEX.dragonFire,   // #FA4616
  BRAND_HEX.truePurple,   // #8160CE
  BRAND_HEX.viridian,     // #00876D
  BRAND_HEX.byzantine,    // #1754D8
  BRAND_HEX.thulianPink,  // #E26394
  BRAND_HEX.muted,        // #8A7E7D
  BRAND_HEX.midnight,     // #141212
] as const;

// ── Success / warning / danger utility classes ──────────────────────

export const STATUS_TEXT = {
  success: "text-[#00876D]",
  warning: "text-[#FA4616]",
  danger: "text-[#E86644]",
  info: "text-[#1754D8]",
} as const;

/**
 * Domain normalization — used for storage AND matching.
 * Strips protocol, www, paths, lowercases.
 *
 * "https://www.whop.com/pricing" → "whop.com"
 * "HTTP://WWW.WHOP.COM"         → "whop.com"
 * ""                            → null
 * null                          → null
 */
export function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;

  let domain = raw.trim().toLowerCase();
  if (!domain) return null;

  // Strip protocol
  domain = domain.replace(/^https?:\/\//, "");

  // Strip www.
  domain = domain.replace(/^www\./, "");

  // Strip path, query, hash
  domain = domain.split("/")[0].split("?")[0].split("#")[0];

  // Final trim
  domain = domain.trim();

  return domain || null;
}

/**
 * Company name normalization — used for MATCHING ONLY, not storage.
 * Strips common suffixes, lowercases, removes punctuation.
 *
 * "Whop Inc"     → "whop"
 * "Whop, Inc."   → "whop"
 * "WHOP LLC"     → "whop"
 * "The Whop Co." → "whop"
 */
export function normalizeCompanyName(raw: string): string {
  if (!raw || typeof raw !== "string") return "";

  let name = raw.trim().toLowerCase();

  // Strip leading "the "
  name = name.replace(/^the\s+/i, "");

  // Strip common suffixes (order matters — longer first)
  const suffixes = [
    "incorporated",
    "corporation",
    "limited",
    "company",
    "holdings",
    "group",
    "corp",
    "inc",
    "llc",
    "ltd",
    "co",
    "&",
  ];

  for (const suffix of suffixes) {
    // Match suffix at end of string, optionally preceded by comma/space and followed by period
    const pattern = new RegExp(`[,\\s]+${suffix}\\.?\\s*$`, "i");
    name = name.replace(pattern, "");
  }

  // Strip trailing punctuation and whitespace
  name = name.replace(/[.,;:!?&]+$/, "").trim();

  return name;
}

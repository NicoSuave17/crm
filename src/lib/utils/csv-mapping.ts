export interface ImportField {
  key: string;
  label: string;
  required: boolean;
  aliases: string[];
  /** Group for UI display: "contact" | "company" */
  group?: "contact" | "company";
  /** If this field is a custom field, this is the definition ID */
  customFieldId?: string;
  /** Custom field type for value coercion */
  customFieldType?: string;
}

/**
 * Convert custom field definitions (from the DB) into ImportField entries.
 * These get merged with the built-in fields so they appear in the mapping dropdown.
 */
export function customFieldsToImportFields(
  definitions: {
    id: string;
    name: string;
    label: string;
    fieldType: string;
    isRequired?: boolean | null;
  }[],
  group?: "contact" | "company"
): ImportField[] {
  return definitions.map((def) => ({
    key: `cf_${def.name}`,
    label: def.label,
    required: !!def.isRequired,
    aliases: [
      def.name.toLowerCase(),
      def.label.toLowerCase(),
      // Also match with underscores/spaces swapped
      def.name.toLowerCase().replace(/_/g, " "),
      def.label.toLowerCase().replace(/\s+/g, "_"),
    ],
    group,
    customFieldId: def.id,
    customFieldType: def.fieldType,
  }));
}

export const CONTACT_IMPORT_FIELDS: ImportField[] = [
  // ─── Contact Fields ──────────────────────────────────────────
  {
    key: "firstName",
    label: "First Name",
    required: true,
    group: "contact",
    aliases: ["first name", "first_name", "firstname", "first", "name"],
  },
  {
    key: "lastName",
    label: "Last Name",
    required: false,
    group: "contact",
    aliases: ["last name", "last_name", "lastname", "last", "surname"],
  },
  {
    key: "email",
    label: "Email",
    required: false,
    group: "contact",
    aliases: ["email", "email address", "email_address", "e-mail", "email business", "business email", "work email", "corporate email"],
  },
  {
    key: "phone",
    label: "Phone",
    required: false,
    group: "contact",
    aliases: [
      "phone", "phone number", "phone_number", "tel", "telephone",
      "mobile", "mobile phone", "mobile_phone", "cell", "cell phone",
      "cell_phone", "cellphone", "mob", "mobile number",
    ],
  },
  {
    key: "title",
    label: "Title",
    required: false,
    group: "contact",
    aliases: ["title", "job title", "job_title", "position", "role"],
  },
  {
    key: "address",
    label: "Address",
    required: false,
    group: "contact",
    aliases: ["address", "street", "street address", "address line"],
  },
  {
    key: "city",
    label: "City",
    required: false,
    group: "contact",
    aliases: ["city", "town"],
  },
  {
    key: "state",
    label: "State",
    required: false,
    group: "contact",
    aliases: ["state", "province", "region", "state/province"],
  },
  {
    key: "country",
    label: "Country",
    required: false,
    group: "contact",
    aliases: ["country", "nation"],
  },
  {
    key: "type",
    label: "Type",
    required: true,
    group: "contact",
    aliases: ["type", "contact type", "contact_type"],
  },
  {
    key: "status",
    label: "Status",
    required: false,
    group: "contact",
    aliases: ["status", "contact status", "contact_status"],
  },
  {
    key: "tier",
    label: "Tier",
    required: false,
    group: "contact",
    aliases: ["tier", "level"],
  },
  {
    key: "source",
    label: "Source",
    required: false,
    group: "contact",
    aliases: ["source", "lead source", "lead_source"],
  },
  {
    key: "linkedinUrl",
    label: "LinkedIn URL",
    required: false,
    group: "contact",
    aliases: ["linkedin", "linkedin url", "linkedin_url", "linkedin link", "person linkedin url", "person linkedin"],
  },
  {
    key: "twitterUrl",
    label: "Twitter URL",
    required: false,
    group: "contact",
    aliases: ["twitter", "twitter url", "twitter_url", "x url"],
  },
  {
    key: "websiteUrl",
    label: "Website URL",
    required: false,
    group: "contact",
    aliases: ["website", "website url", "website_url", "url", "web"],
  },
  {
    key: "whopUsername",
    label: "Whop Username",
    required: false,
    group: "contact",
    aliases: ["whop username", "whop_username", "whop", "username"],
  },
  {
    key: "ownerEmail",
    label: "Owner Email",
    required: false,
    group: "contact",
    aliases: ["owner email", "owner_email", "assigned to", "owner"],
  },
  {
    key: "vertical",
    label: "Vertical",
    required: false,
    group: "contact",
    aliases: ["vertical", "archetype", "category", "niche"],
  },

  // ─── Company Fields (drive company record creation/linking) ──
  {
    key: "companyName",
    label: "Company Name",
    required: false,
    group: "company",
    aliases: ["company name", "company_name", "company", "organization", "org", "org name"],
  },
  {
    key: "companyDomain",
    label: "Company Domain",
    required: false,
    group: "company",
    aliases: [
      "company domain", "company_domain", "org domain",
      "company website", "company_website", "company url", "company_url",
      "company site", "company web",
    ],
  },
  {
    key: "companyIndustry",
    label: "Company Industry",
    required: false,
    group: "company",
    aliases: ["industry", "sector", "company industry", "company_industry"],
  },
  {
    key: "companySize",
    label: "Company Size",
    required: false,
    group: "company",
    aliases: ["size", "company size", "company_size", "employees", "# employees", "employee count"],
  },
  {
    key: "companyDescription",
    label: "Company Description",
    required: false,
    group: "company",
    aliases: ["company description", "company_description", "company about", "company bio"],
  },
  {
    key: "companyLinkedinUrl",
    label: "Company LinkedIn",
    required: false,
    group: "company",
    aliases: ["company linkedin", "company_linkedin", "org linkedin", "company linkedin url"],
  },
  {
    key: "companyWebsiteUrl",
    label: "Company Website URL",
    required: false,
    group: "company",
    aliases: ["company website url", "company_website_url"],
  },
  {
    key: "companyVertical",
    label: "Company Vertical",
    required: false,
    group: "company",
    aliases: ["company vertical", "company_vertical", "company category"],
  },
  {
    key: "companyAddress",
    label: "Company Address",
    required: false,
    group: "company",
    aliases: ["company address", "1st company location address", "company location"],
  },
  {
    key: "companyCity",
    label: "Company City",
    required: false,
    group: "company",
    aliases: ["company city"],
  },
  {
    key: "companyState",
    label: "Company State",
    required: false,
    group: "company",
    aliases: ["company state"],
  },
  {
    key: "companyCountry",
    label: "Company Country",
    required: false,
    group: "company",
    aliases: ["company country"],
  },
];

export const COMPANY_IMPORT_FIELDS: ImportField[] = [
  {
    key: "name",
    label: "Name",
    required: true,
    aliases: ["name", "company name", "company_name", "company"],
  },
  {
    key: "domain",
    label: "Domain",
    required: false,
    aliases: ["domain", "website domain", "company_domain"],
  },
  {
    key: "industry",
    label: "Industry",
    required: false,
    aliases: ["industry", "sector"],
  },
  {
    key: "size",
    label: "Size",
    required: false,
    aliases: ["size", "company size", "company_size", "employees"],
  },
  {
    key: "description",
    label: "Description",
    required: false,
    aliases: ["description", "about", "bio"],
  },
  {
    key: "linkedinUrl",
    label: "LinkedIn URL",
    required: false,
    aliases: ["linkedin", "linkedin url", "linkedin_url", "linkedin link"],
  },
  {
    key: "websiteUrl",
    label: "Website URL",
    required: false,
    aliases: ["website", "website url", "website_url", "url", "web"],
  },
  {
    key: "vertical",
    label: "Vertical",
    required: false,
    aliases: ["vertical", "archetype", "category", "niche"],
  },
  {
    key: "address",
    label: "Address",
    required: false,
    aliases: ["address", "company address", "hq address", "headquarters"],
  },
  {
    key: "city",
    label: "City",
    required: false,
    aliases: ["city", "company city", "hq city"],
  },
  {
    key: "state",
    label: "State",
    required: false,
    aliases: ["state", "company state", "hq state"],
  },
  {
    key: "country",
    label: "Country",
    required: false,
    aliases: ["country", "company country", "hq country"],
  },
];

/**
 * Auto-map CSV headers to import fields using alias matching.
 * Generic version that works with any fields array.
 * Returns a mapping of { csvHeader -> importFieldKey | null }.
 */
export function autoMapColumnsForFields(
  csvHeaders: string[],
  fields: ImportField[]
): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  const usedFields = new Set<string>();

  for (const header of csvHeaders) {
    const normalized = header.toLowerCase().trim();
    let matched = false;

    for (const field of fields) {
      if (usedFields.has(field.key)) continue;
      if (
        field.aliases.includes(normalized) ||
        normalized === field.key.toLowerCase()
      ) {
        mapping[header] = field.key;
        usedFields.add(field.key);
        matched = true;
        break;
      }
    }

    if (!matched) {
      mapping[header] = null;
    }
  }

  return mapping;
}

/**
 * Auto-map CSV headers to contact import fields using alias matching.
 * Returns a mapping of { csvHeader -> importFieldKey | null }.
 */
export function autoMapColumns(
  csvHeaders: string[]
): Record<string, string | null> {
  return autoMapColumnsForFields(csvHeaders, CONTACT_IMPORT_FIELDS);
}

/**
 * Transform a raw CSV row into a contact data object using the column mapping.
 * Only includes mapped, non-empty values.
 */
export function transformRow(
  csvRow: Record<string, string>,
  mapping: Record<string, string | null>
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [csvHeader, fieldKey] of Object.entries(mapping)) {
    if (
      fieldKey &&
      csvRow[csvHeader] !== undefined &&
      csvRow[csvHeader] !== ""
    ) {
      let value = csvRow[csvHeader].trim();

      // Auto-prepend https:// to URL fields missing a protocol
      if (fieldKey.endsWith("Url") && value && !/^https?:\/\//i.test(value)) {
        value = `https://${value}`;
      }

      result[fieldKey] = value;
    }
  }

  return result;
}

const VALID_TYPES = ["creator", "lead", "enterprise_prospect", "partner"];
const VALID_STATUSES = ["active", "churned", "at_risk", "prospect", "closed_lost"];
const VALID_TIERS = ["enterprise", "premium", "standard", "starter"];
const VALID_VERTICALS = [
  "sports_picks", "crypto_trading", "coaching_courses", "communities",
  "software_saas", "templates", "agency", "content_media", "affiliate_networks",
];
const VALID_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"];

// Maps human-readable / common variants to exact enum values
const VERTICAL_MAP: Record<string, string> = {
  "sports picks": "sports_picks", "sports": "sports_picks", "picks": "sports_picks",
  "crypto trading": "crypto_trading", "crypto": "crypto_trading", "trading": "crypto_trading",
  "coaching courses": "coaching_courses", "coaching": "coaching_courses", "courses": "coaching_courses",
  "communities": "communities", "community": "communities",
  "software saas": "software_saas", "software": "software_saas", "saas": "software_saas",
  "templates": "templates", "template": "templates",
  "agency": "agency", "agencies": "agency",
  "content media": "content_media", "content": "content_media", "media": "content_media",
  "affiliate networks": "affiliate_networks", "affiliate": "affiliate_networks", "affiliates": "affiliate_networks",
};

const STATUS_MAP: Record<string, string> = {
  "active": "active", "churned": "churned", "at risk": "at_risk", "at_risk": "at_risk",
  "prospect": "prospect", "closed lost": "closed_lost", "closed_lost": "closed_lost", "lost": "closed_lost",
};

const TIER_MAP: Record<string, string> = {
  "enterprise": "enterprise", "premium": "premium", "standard": "standard", "starter": "starter",
  "basic": "starter", "pro": "premium",
};

const TYPE_MAP: Record<string, string> = {
  "creator": "creator", "lead": "lead",
  "enterprise prospect": "enterprise_prospect", "enterprise_prospect": "enterprise_prospect",
  "enterprise": "enterprise_prospect", "prospect": "lead",
  "partner": "partner",
};

/** Normalize an enum value: lowercase, check map, check valid list, or delete. */
function normalizeEnum(value: string | undefined, validValues: string[], aliasMap: Record<string, string>): string | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase().trim();
  if (validValues.includes(lower)) return lower;
  if (aliasMap[lower]) return aliasMap[lower];
  // Strip underscores/hyphens and try again
  const stripped = lower.replace(/[-_]/g, " ");
  if (aliasMap[stripped]) return aliasMap[stripped];
  return undefined; // Invalid — drop it so DB defaults apply
}

/** Normalize company size from freeform text/number to enum. */
function normalizeSize(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase().trim();
  if (VALID_SIZES.includes(lower)) return lower;

  // Try numeric
  const num = parseInt(lower.replace(/[^0-9]/g, ""), 10);
  if (!isNaN(num)) {
    if (num <= 10) return "1-10";
    if (num <= 50) return "11-50";
    if (num <= 200) return "51-200";
    if (num <= 1000) return "201-1000";
    return "1000+";
  }

  // Try text labels
  const sizeTextMap: Record<string, string> = {
    "small": "1-10", "micro": "1-10",
    "medium": "51-200", "mid": "51-200",
    "large": "201-1000", "big": "201-1000",
    "enterprise": "1000+", "very large": "1000+",
  };
  return sizeTextMap[lower] || undefined;
}

/**
 * Apply defaults to a transformed row:
 * - type defaults to "lead" if missing or invalid
 * - source is always set to "import"
 * - normalize enum fields (vertical, status, tier, type)
 */
export function applyDefaults(row: Record<string, string>): Record<string, string> {
  const result = { ...row };

  // Normalize type
  const normalizedType = normalizeEnum(result.type, VALID_TYPES, TYPE_MAP);
  result.type = normalizedType || "lead";

  // Normalize optional enums — delete if invalid so Zod doesn't reject
  if (result.status) {
    const norm = normalizeEnum(result.status, VALID_STATUSES, STATUS_MAP);
    if (norm) result.status = norm; else delete result.status;
  }
  if (result.tier) {
    const norm = normalizeEnum(result.tier, VALID_TIERS, TIER_MAP);
    if (norm) result.tier = norm; else delete result.tier;
  }
  if (result.vertical) {
    const norm = normalizeEnum(result.vertical, VALID_VERTICALS, VERTICAL_MAP);
    if (norm) result.vertical = norm; else delete result.vertical;
  }

  // All imported contacts get source: "import"
  result.source = "import";

  return result;
}

/**
 * Apply defaults to a transformed company row:
 * - normalize enum fields (vertical, size)
 */
export function applyCompanyDefaults(row: Record<string, string>): Record<string, string> {
  const result = { ...row };

  if (result.vertical) {
    const norm = normalizeEnum(result.vertical, VALID_VERTICALS, VERTICAL_MAP);
    if (norm) result.vertical = norm; else delete result.vertical;
  }
  if (result.size) {
    const norm = normalizeSize(result.size);
    if (norm) result.size = norm; else delete result.size;
  }

  return result;
}

/**
 * Extract company fields from a transformed row into a separate companyData object.
 * Returns { contactData, companyData } where contactData has company* keys removed.
 */
export function separateCompanyData(
  data: Record<string, unknown>
): { contactData: Record<string, unknown>; companyData: Record<string, string> | null } {
  const contactData: Record<string, unknown> = {};
  const companyData: Record<string, string> = {};

  const COMPANY_KEY_MAP: Record<string, string> = {
    companyName: "name",
    companyDomain: "domain",
    companyIndustry: "industry",
    companySize: "size",
    companyDescription: "description",
    companyLinkedinUrl: "linkedinUrl",
    companyWebsiteUrl: "websiteUrl",
    companyVertical: "vertical",
    companyAddress: "address",
    companyCity: "city",
    companyState: "state",
    companyCountry: "country",
  };

  for (const [key, value] of Object.entries(data)) {
    const companyField = COMPANY_KEY_MAP[key];
    if (companyField && value && String(value).trim()) {
      companyData[companyField] = String(value).trim();
    } else if (!COMPANY_KEY_MAP[key]) {
      contactData[key] = value;
    }
  }

  const hasCompanyData = Object.keys(companyData).length > 0;
  return { contactData, companyData: hasCompanyData ? companyData : null };
}

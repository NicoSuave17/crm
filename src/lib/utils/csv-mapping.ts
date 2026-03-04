export interface ImportField {
  key: string;
  label: string;
  required: boolean;
  aliases: string[];
}

export const CONTACT_IMPORT_FIELDS: ImportField[] = [
  {
    key: "firstName",
    label: "First Name",
    required: true,
    aliases: ["first name", "first_name", "firstname", "first", "name"],
  },
  {
    key: "lastName",
    label: "Last Name",
    required: false,
    aliases: ["last name", "last_name", "lastname", "last", "surname"],
  },
  {
    key: "email",
    label: "Email",
    required: false,
    aliases: ["email", "email address", "email_address", "e-mail"],
  },
  {
    key: "phone",
    label: "Phone",
    required: false,
    aliases: ["phone", "phone number", "phone_number", "tel", "telephone", "mobile"],
  },
  {
    key: "type",
    label: "Type",
    required: true,
    aliases: ["type", "contact type", "contact_type", "category"],
  },
  {
    key: "status",
    label: "Status",
    required: false,
    aliases: ["status", "contact status", "contact_status"],
  },
  {
    key: "tier",
    label: "Tier",
    required: false,
    aliases: ["tier", "level"],
  },
  {
    key: "source",
    label: "Source",
    required: false,
    aliases: ["source", "lead source", "lead_source"],
  },
  {
    key: "linkedinUrl",
    label: "LinkedIn URL",
    required: false,
    aliases: ["linkedin", "linkedin url", "linkedin_url", "linkedin link"],
  },
  {
    key: "twitterUrl",
    label: "Twitter URL",
    required: false,
    aliases: ["twitter", "twitter url", "twitter_url", "x url"],
  },
  {
    key: "websiteUrl",
    label: "Website URL",
    required: false,
    aliases: ["website", "website url", "website_url", "url", "web"],
  },
  {
    key: "whopUsername",
    label: "Whop Username",
    required: false,
    aliases: ["whop username", "whop_username", "whop", "username"],
  },
];

/**
 * Auto-map CSV headers to contact import fields using alias matching.
 * Returns a mapping of { csvHeader -> importFieldKey | null }.
 */
export function autoMapColumns(
  csvHeaders: string[]
): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  const usedFields = new Set<string>();

  for (const header of csvHeaders) {
    const normalized = header.toLowerCase().trim();
    let matched = false;

    for (const field of CONTACT_IMPORT_FIELDS) {
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
      result[fieldKey] = csvRow[csvHeader].trim();
    }
  }

  return result;
}

const VALID_TYPES = ["creator", "lead", "enterprise_prospect", "partner"];

/**
 * Apply defaults to a transformed row:
 * - type defaults to "lead" if missing or invalid
 * - source is always set to "import"
 */
export function applyDefaults(row: Record<string, string>): Record<string, string> {
  const result = { ...row };

  if (!result.type || !VALID_TYPES.includes(result.type)) {
    result.type = "lead";
  }

  // All imported contacts get source: "import"
  result.source = "import";

  return result;
}

export interface TemplateContext {
  // Contact fields
  firstName?: string;
  lastName?: string;
  email?: string;
  whopUsername?: string;
  tier?: string;
  status?: string;
  // Company fields (from primary company link)
  companyName?: string;
  companyDomain?: string;
  // Deal fields
  dealTitle?: string;
  dealValue?: string;
  // User fields (current user / sender)
  senderFirstName?: string;
  senderLastName?: string;
  senderEmail?: string;
}

/**
 * Available template variables with descriptions for the UI.
 */
export const TEMPLATE_VARIABLES = [
  { key: "firstName", label: "First Name", example: "John" },
  { key: "lastName", label: "Last Name", example: "Doe" },
  { key: "email", label: "Email", example: "john@example.com" },
  { key: "whopUsername", label: "Whop Username", example: "johndoe" },
  { key: "tier", label: "Tier", example: "premium" },
  { key: "companyName", label: "Company Name", example: "Acme Inc" },
  { key: "companyDomain", label: "Company Domain", example: "acme.com" },
  { key: "dealTitle", label: "Deal Title", example: "Enterprise Plan" },
  { key: "dealValue", label: "Deal Value", example: "$10,000" },
  { key: "senderFirstName", label: "Sender First Name", example: "Jane" },
  { key: "senderLastName", label: "Sender Last Name", example: "Smith" },
  { key: "senderEmail", label: "Sender Email", example: "jane@whop.com" },
] as const;

/**
 * Interpolates {{variable}} tokens in a template string with values from the context.
 * Unmatched variables are left as-is (e.g., {{unknownVar}} stays in the output).
 */
export function interpolateTemplate(
  template: string,
  context: TemplateContext
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName: string) => {
    const key = varName as keyof TemplateContext;
    const value = context[key];
    return value !== undefined && value !== null && value !== ""
      ? value
      : match;
  });
}

/**
 * Extracts all {{variable}} tokens from a template string.
 * Returns unique variable names.
 */
export function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g) ?? [];
  const vars = matches.map((m) => m.replace(/\{\{|\}\}/g, ""));
  return [...new Set(vars)];
}

/**
 * Preview a template with example data (for template editor preview).
 */
export function previewTemplate(template: string): string {
  const exampleContext: TemplateContext = {};
  for (const v of TEMPLATE_VARIABLES) {
    (exampleContext as Record<string, string>)[v.key] = v.example;
  }
  return interpolateTemplate(template, exampleContext);
}

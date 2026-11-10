import { z } from "zod";

export const createContactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  type: z.enum(["creator", "lead", "enterprise_prospect", "partner"]),
  status: z
    .enum(["active", "churned", "at_risk", "prospect", "closed_lost"])
    .optional(),
  tier: z.enum(["enterprise", "premium", "standard", "starter"]).optional(),
  vertical: z
    .enum([
      "sports_picks", "crypto_trading", "coaching_courses", "communities",
      "software_saas", "templates", "agency", "content_media", "affiliate_networks",
    ])
    .optional(),
  source: z
    .enum(["whop_api_sync", "manual", "linkedin", "referral", "inbound", "import"])
    .optional(),
  title: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  twitterUrl: z.string().url().optional().or(z.literal("")),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  ownerId: z.string().uuid().optional(),
  sourceDetails: z.string().optional(),
  whopUsername: z.string().optional(),
});

export const updateContactSchema = createContactSchema.partial().extend({
  healthScore: z.number().int().min(0).max(100).optional().nullable(),
  whopUsername: z.string().optional().nullable(),
  sourceDetails: z.string().optional().nullable(),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

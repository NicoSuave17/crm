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
  source: z
    .enum(["whop_api_sync", "manual", "linkedin", "referral", "inbound", "import"])
    .optional(),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  twitterUrl: z.string().url().optional().or(z.literal("")),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  ownerId: z.string().uuid().optional(),
});

export const updateContactSchema = createContactSchema.partial().extend({
  healthScore: z.number().int().min(0).max(100).optional().nullable(),
  whopUsername: z.string().optional().nullable(),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

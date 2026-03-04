import { z } from "zod";

export const linkContactCompanySchema = z.object({
  companyId: z.string().uuid("Invalid company ID"),
  role: z.string().optional(),
});

export type LinkContactCompanyInput = z.infer<typeof linkContactCompanySchema>;

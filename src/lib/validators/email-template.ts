import { z } from "zod";

export const createEmailTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  subject: z.string().min(1, "Subject is required").max(200),
  body: z.string().min(1, "Body is required").max(10000),
  category: z.string().max(50).optional(),
  isShared: z.boolean().optional(),
});

export const updateEmailTemplateSchema = createEmailTemplateSchema.partial();

export type CreateEmailTemplateInput = z.infer<typeof createEmailTemplateSchema>;
export type UpdateEmailTemplateInput = z.infer<typeof updateEmailTemplateSchema>;

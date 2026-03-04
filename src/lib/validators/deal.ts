import { z } from "zod";

export const createDealSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  pipelineId: z.string().uuid(),
  stageId: z.string().uuid(),
  contactId: z.string().uuid(),
  companyId: z.string().uuid().optional(),
  value: z.string().optional(),
  expectedMrr: z.string().optional(),
  expectedCloseDate: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
});

export const updateDealSchema = createDealSchema.partial().extend({
  lostReason: z.string().optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
});

export const moveDealSchema = z.object({
  stageId: z.string().uuid(),
});

export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;

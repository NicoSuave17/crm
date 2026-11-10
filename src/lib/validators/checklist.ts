import { z } from "zod";

export const createChecklistSchema = z.object({
  stageId: z.string().uuid(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  isRequired: z.boolean().optional().default(false),
  position: z.number().int().min(0).optional(),
});

export const updateChecklistSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  isRequired: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

export const toggleChecklistItemSchema = z.object({
  dealId: z.string().uuid(),
  checklistId: z.string().uuid(),
  completed: z.boolean(),
});

export type CreateChecklistInput = z.infer<typeof createChecklistSchema>;
export type UpdateChecklistInput = z.infer<typeof updateChecklistSchema>;
export type ToggleChecklistItemInput = z.infer<typeof toggleChecklistItemSchema>;

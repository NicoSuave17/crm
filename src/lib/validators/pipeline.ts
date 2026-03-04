import { z } from "zod";

export const createPipelineSchema = z.object({
  name: z.string().min(1, "Pipeline name is required").max(100),
  description: z.string().max(500).optional(),
  type: z.enum(["seller_onboarding", "enterprise", "partnerships", "custom"]),
});

export const updatePipelineSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  type: z
    .enum(["seller_onboarding", "enterprise", "partnerships", "custom"])
    .optional(),
});

export const createStageSchema = z
  .object({
    name: z.string().min(1, "Stage name is required").max(100),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color")
      .optional()
      .nullable(),
    probability: z.number().int().min(0).max(100).optional().nullable(),
    isWon: z.boolean().optional().default(false),
    isLost: z.boolean().optional().default(false),
    position: z.number().int().min(0).optional(),
    // position is optional on create — if omitted, append to end
  })
  .refine((data) => !(data.isWon && data.isLost), {
    message: "A stage cannot be both won and lost",
  });

export const updateStageSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional()
      .nullable(),
    probability: z.number().int().min(0).max(100).optional().nullable(),
    isWon: z.boolean().optional(),
    isLost: z.boolean().optional(),
  })
  .refine((data) => !(data.isWon && data.isLost), {
    message: "A stage cannot be both won and lost",
  });

export const reorderStagesSchema = z.object({
  stageIds: z.array(z.string().uuid()).min(1, "At least one stage ID required"),
  // Array of stage IDs in new order. Position is derived from array index.
});

export type CreatePipelineInput = z.infer<typeof createPipelineSchema>;
export type UpdatePipelineInput = z.infer<typeof updatePipelineSchema>;
export type CreateStageInput = z.infer<typeof createStageSchema>;
export type UpdateStageInput = z.infer<typeof updateStageSchema>;
export type ReorderStagesInput = z.infer<typeof reorderStagesSchema>;

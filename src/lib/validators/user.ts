import { z } from "zod";

export const updateUserRoleSchema = z.object({
  role: z.enum(["admin", "manager", "account_manager", "ae", "enterprise_sales"]),
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export const updateUserSchema = z.object({
  role: z.enum(["admin", "manager", "account_manager", "ae", "enterprise_sales"]).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

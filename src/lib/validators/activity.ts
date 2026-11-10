import { z } from "zod";

export const createActivitySchema = z.object({
  type: z.enum([
    "note",
    "call",
    "email_sent",
    "email_received",
    "meeting",
    "linkedin_message",
  ]),
  subject: z.string().optional(),
  body: z.string().optional(),
  contactId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  occurredAt: z.string().datetime().optional(),
  duration: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  outcome: z
    .enum([
      "connected", "no_answer", "left_voicemail", "rescheduled",
      "positive", "negative", "neutral", "follow_up_needed",
    ])
    .optional(),
  nextFollowUpDate: z.string().optional(),
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;

export const updateActivitySchema = z.object({
  type: z.enum([
    "note", "call", "email_sent", "email_received",
    "meeting", "linkedin_message",
  ]).optional(),
  subject: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  duration: z.number().int().positive().nullable().optional(),
});

export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;

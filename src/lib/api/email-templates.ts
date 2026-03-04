import { db } from "@/lib/db";
import { emailTemplates, users } from "@/lib/db/schema";
import { eq, desc, or, and } from "drizzle-orm";

export interface CreateTemplateInput {
  name: string;
  subject: string;
  body: string;
  category?: string;
  isShared?: boolean;
}

export interface UpdateTemplateInput {
  name?: string;
  subject?: string;
  body?: string;
  category?: string;
  isShared?: boolean;
}

export async function listEmailTemplates(userId: string) {
  return db
    .select({
      id: emailTemplates.id,
      name: emailTemplates.name,
      subject: emailTemplates.subject,
      body: emailTemplates.body,
      category: emailTemplates.category,
      isShared: emailTemplates.isShared,
      createdBy: emailTemplates.createdBy,
      creatorFirstName: users.firstName,
      creatorLastName: users.lastName,
      createdAt: emailTemplates.createdAt,
      updatedAt: emailTemplates.updatedAt,
    })
    .from(emailTemplates)
    .leftJoin(users, eq(emailTemplates.createdBy, users.id))
    .where(
      or(
        eq(emailTemplates.isShared, true),
        eq(emailTemplates.createdBy, userId)
      )
    )
    .orderBy(desc(emailTemplates.updatedAt));
}

export async function getEmailTemplate(id: string) {
  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.id, id))
    .limit(1);
  return template;
}

export async function createEmailTemplate(
  data: CreateTemplateInput,
  userId: string
) {
  const [template] = await db
    .insert(emailTemplates)
    .values({
      ...data,
      createdBy: userId,
    })
    .returning();
  return template;
}

export async function updateEmailTemplate(
  id: string,
  userId: string,
  data: UpdateTemplateInput
) {
  const [updated] = await db
    .update(emailTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(eq(emailTemplates.id, id), eq(emailTemplates.createdBy, userId))
    )
    .returning();
  return updated;
}

export async function deleteEmailTemplate(id: string, userId: string) {
  const result = await db
    .delete(emailTemplates)
    .where(
      and(eq(emailTemplates.id, id), eq(emailTemplates.createdBy, userId))
    )
    .returning({ id: emailTemplates.id });
  return result.length > 0;
}

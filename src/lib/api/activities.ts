import { db } from "@/lib/db";
import { activities, users } from "@/lib/db/schema";
import { eq, desc, and, type SQL } from "drizzle-orm";
import type { CreateActivityInput, UpdateActivityInput } from "@/lib/validators/activity";

export interface ActivityListParams {
  contactId?: string;
  dealId?: string;
  companyId?: string;
  limit?: number;
  offset?: number;
}

export async function listActivities(params: ActivityListParams) {
  const { contactId, dealId, companyId, limit = 50, offset = 0 } = params;
  const conditions: SQL[] = [];

  if (contactId) conditions.push(eq(activities.contactId, contactId));
  if (dealId) conditions.push(eq(activities.dealId, dealId));
  if (companyId) conditions.push(eq(activities.companyId, companyId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const data = await db
    .select({
      id: activities.id,
      type: activities.type,
      subject: activities.subject,
      body: activities.body,
      metadata: activities.metadata,
      contactId: activities.contactId,
      dealId: activities.dealId,
      companyId: activities.companyId,
      userId: activities.userId,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userAvatarUrl: users.avatarUrl,
      occurredAt: activities.occurredAt,
      duration: activities.duration,
      createdAt: activities.createdAt,
    })
    .from(activities)
    .leftJoin(users, eq(activities.userId, users.id))
    .where(where)
    .orderBy(desc(activities.occurredAt))
    .limit(limit)
    .offset(offset);

  return data;
}

export async function createActivity(
  data: CreateActivityInput,
  userId: string
) {
  const [activity] = await db
    .insert(activities)
    .values({
      ...data,
      userId,
      occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
    })
    .returning();

  return activity;
}

export async function updateActivity(
  id: string,
  userId: string,
  data: UpdateActivityInput
) {
  const [updated] = await db
    .update(activities)
    .set(data)
    .where(and(eq(activities.id, id), eq(activities.userId, userId)))
    .returning();
  return updated; // undefined if not found or not owned
}

export async function deleteActivity(id: string, userId: string) {
  const result = await db
    .delete(activities)
    .where(and(eq(activities.id, id), eq(activities.userId, userId)))
    .returning({ id: activities.id });
  return result.length > 0;
}

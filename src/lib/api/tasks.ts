import { db } from "@/lib/db";
import { tasks, users, contacts, companies, deals } from "@/lib/db/schema";
import { eq, and, desc, asc, lte, gte, isNull, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

const creators = alias(users, "creators");
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/validators/task";

export interface TaskListParams {
  assigneeId?: string;
  contactId?: string;
  dealId?: string;
  companyId?: string;
  status?: string;
  priority?: string;
  dueFilter?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export async function listTasks(params: TaskListParams = {}) {
  const conditions: SQL[] = [];

  if (params.assigneeId === "unassigned") {
    conditions.push(isNull(tasks.assigneeId));
  } else if (params.assigneeId) {
    conditions.push(eq(tasks.assigneeId, params.assigneeId));
  }
  if (params.contactId) conditions.push(eq(tasks.contactId, params.contactId));
  if (params.dealId) conditions.push(eq(tasks.dealId, params.dealId));
  if (params.companyId) conditions.push(eq(tasks.companyId, params.companyId));
  if (params.status) {
    conditions.push(eq(tasks.status, params.status as typeof tasks.status.enumValues[number]));
  }
  if (params.priority) {
    conditions.push(eq(tasks.priority, params.priority as typeof tasks.priority.enumValues[number]));
  }
  if (params.dueFilter) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    if (params.dueFilter === "overdue") {
      conditions.push(lte(tasks.dueDate, now));
      // Only show non-completed overdue tasks
      conditions.push(eq(tasks.status, "pending"));
    } else if (params.dueFilter === "today") {
      conditions.push(gte(tasks.dueDate, today));
      conditions.push(lte(tasks.dueDate, tomorrow));
    } else if (params.dueFilter === "week") {
      const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      conditions.push(gte(tasks.dueDate, today));
      conditions.push(lte(tasks.dueDate, weekEnd));
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      assigneeId: tasks.assigneeId,
      assigneeFirstName: users.firstName,
      assigneeLastName: users.lastName,
      creatorId: tasks.creatorId,
      creatorFirstName: creators.firstName,
      creatorLastName: creators.lastName,
      contactId: tasks.contactId,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      dealId: tasks.dealId,
      dealTitle: deals.title,
      companyId: tasks.companyId,
      companyName: companies.name,
      dueDate: tasks.dueDate,
      completedAt: tasks.completedAt,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .leftJoin(creators, eq(tasks.creatorId, creators.id))
    .leftJoin(contacts, eq(tasks.contactId, contacts.id))
    .leftJoin(companies, eq(tasks.companyId, companies.id))
    .leftJoin(deals, eq(tasks.dealId, deals.id))
    .where(where)
    .orderBy(asc(tasks.dueDate), desc(tasks.createdAt));
}

export async function getTask(id: string) {
  const [task] = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      assigneeId: tasks.assigneeId,
      assigneeFirstName: users.firstName,
      assigneeLastName: users.lastName,
      creatorId: tasks.creatorId,
      contactId: tasks.contactId,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      dealId: tasks.dealId,
      companyId: tasks.companyId,
      companyName: companies.name,
      dueDate: tasks.dueDate,
      completedAt: tasks.completedAt,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .leftJoin(contacts, eq(tasks.contactId, contacts.id))
    .leftJoin(companies, eq(tasks.companyId, companies.id))
    .where(eq(tasks.id, id))
    .limit(1);

  return task ?? null;
}

export async function createTask(data: CreateTaskInput, creatorId: string) {
  const [task] = await db
    .insert(tasks)
    .values({
      title: data.title,
      description: data.description,
      priority: data.priority ?? "medium",
      assigneeId: data.assigneeId ?? creatorId,
      creatorId,
      contactId: data.contactId ?? null,
      dealId: data.dealId ?? null,
      companyId: data.companyId ?? null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    })
    .returning();

  // Audit: record creation
  const { recordAudit } = await import("./record-audit");
  await recordAudit({
    entityType: "task",
    entityId: task.id,
    action: "create",
    userId: creatorId,
    snapshot: task as unknown as Record<string, unknown>,
  });

  return task;
}

export async function updateTask(id: string, data: UpdateTaskInput, userId?: string) {
  // Get old values for change history
  const [oldTask] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);

  const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };

  if (data.status === "completed") {
    updateData.completedAt = new Date();
  }
  if (data.dueDate) {
    updateData.dueDate = new Date(data.dueDate);
  }
  if (data.dueDate === null) {
    updateData.dueDate = null;
  }

  const [task] = await db
    .update(tasks)
    .set(updateData)
    .where(eq(tasks.id, id))
    .returning();

  // Record field changes
  if (oldTask && userId) {
    const { recordFieldChanges } = await import("./change-history");
    await recordFieldChanges("task", id, oldTask as Record<string, unknown>, data as Record<string, unknown>, userId);

    const { recordAudit, diffChanges } = await import("./record-audit");
    const changes = diffChanges(oldTask as Record<string, unknown>, data as Record<string, unknown>);
    if (changes) {
      await recordAudit({
        entityType: "task",
        entityId: id,
        action: "update",
        userId,
        changes,
      });
    }
  }

  return task;
}

export async function deleteTask(id: string, userId?: string) {
  const [existing] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);

  await db.delete(tasks).where(eq(tasks.id, id));

  if (existing && userId) {
    const { recordAudit } = await import("./record-audit");
    await recordAudit({
      entityType: "task",
      entityId: id,
      action: "delete",
      userId,
      snapshot: existing as unknown as Record<string, unknown>,
    });
  }
}

export async function getOverdueTasks(userId?: string) {
  const conditions: SQL[] = [
    lte(tasks.dueDate, new Date()),
    eq(tasks.status, "pending"),
  ];
  if (userId) conditions.push(eq(tasks.assigneeId, userId));

  return db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(asc(tasks.dueDate));
}

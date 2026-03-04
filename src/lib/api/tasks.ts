import { db } from "@/lib/db";
import { tasks, users, contacts } from "@/lib/db/schema";
import { eq, and, desc, asc, lte, type SQL } from "drizzle-orm";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/validators/task";

export interface TaskListParams {
  assigneeId?: string;
  contactId?: string;
  dealId?: string;
  status?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export async function listTasks(params: TaskListParams = {}) {
  const conditions: SQL[] = [];

  if (params.assigneeId) conditions.push(eq(tasks.assigneeId, params.assigneeId));
  if (params.contactId) conditions.push(eq(tasks.contactId, params.contactId));
  if (params.dealId) conditions.push(eq(tasks.dealId, params.dealId));
  if (params.status) {
    conditions.push(eq(tasks.status, params.status as typeof tasks.status.enumValues[number]));
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
      contactId: tasks.contactId,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      dealId: tasks.dealId,
      dueDate: tasks.dueDate,
      completedAt: tasks.completedAt,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .leftJoin(contacts, eq(tasks.contactId, contacts.id))
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
      dueDate: tasks.dueDate,
      completedAt: tasks.completedAt,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .leftJoin(contacts, eq(tasks.contactId, contacts.id))
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
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    })
    .returning();

  return task;
}

export async function updateTask(id: string, data: UpdateTaskInput) {
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

  return task;
}

export async function deleteTask(id: string) {
  await db.delete(tasks).where(eq(tasks.id, id));
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

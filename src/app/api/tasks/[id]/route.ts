import { NextResponse } from "next/server";
import { withDetailPermission } from "@/lib/auth/with-permission";
import { getTask, updateTask, deleteTask } from "@/lib/api/tasks";
import type { UpdateTaskInput } from "@/lib/validators/task";
import { stripRestrictedFields } from "@/lib/auth/permissions";

export const GET = withDetailPermission("task", "read", async (_request, { user, scope, params }) => {
  const task = await getTask(params.id);
  if (!task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (scope === "own" && task.assigneeId !== user.id) {
    return NextResponse.json({ error: "You don't have permission to view this task" }, { status: 403 });
  }

  return NextResponse.json(task);
});

export const PATCH = withDetailPermission("task", "update", async (request, { user, scope, params }) => {
  const existing = await getTask(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (scope === "own" && existing.assigneeId !== user.id) {
    return NextResponse.json({ error: "You don't have permission to update this task" }, { status: 403 });
  }

  const body = await request.json();

  // Enforce field-level permissions — strip readonly/hidden fields
  const { cleaned, rejected } = await stripRestrictedFields(
    user.role,
    "task",
    body as Record<string, unknown>
  );

  if (Object.keys(cleaned).length === 0) {
    return NextResponse.json(
      { error: "No editable fields in request", rejectedFields: rejected },
      { status: 403 }
    );
  }

  const task = await updateTask(params.id, cleaned as UpdateTaskInput, user.id);
  return NextResponse.json({ ...task, _rejectedFields: rejected.length > 0 ? rejected : undefined });
});

export const DELETE = withDetailPermission("task", "delete", async (_request, { user, scope, params }) => {
  const existing = await getTask(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (scope === "own" && existing.assigneeId !== user.id) {
    return NextResponse.json({ error: "You don't have permission to delete this task" }, { status: 403 });
  }

  await deleteTask(params.id, user.id);
  return NextResponse.json({ success: true });
});

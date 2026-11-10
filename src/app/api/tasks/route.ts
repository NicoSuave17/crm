import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/lib/auth/with-permission";
import { listTasks, createTask } from "@/lib/api/tasks";
import { createTaskSchema } from "@/lib/validators/task";

export const GET = withPermission("task", "read", async (request, { user, scope }) => {
  try {
    const { searchParams } = new URL(request.url);

    let assigneeId = searchParams.get("assigneeId") || undefined;
    if (!assigneeId && scope === "own") {
      assigneeId = user.id;
    }

    const data = await listTasks({
      assigneeId,
      contactId: searchParams.get("contactId") || undefined,
      dealId: searchParams.get("dealId") || undefined,
      companyId: searchParams.get("companyId") || undefined,
      status: searchParams.get("status") || undefined,
      priority: searchParams.get("priority") || undefined,
      dueFilter: searchParams.get("dueFilter") || undefined,
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/tasks error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const POST = withPermission("task", "create", async (request, { user }) => {
  try {
    const body = await request.json();
    const parsed = createTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const task = await createTask(parsed.data, user.id);
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("POST /api/tasks error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

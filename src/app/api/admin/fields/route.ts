import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/helpers";
import { logAuditEvent } from "@/lib/api/audit-log";
import { db } from "@/lib/db";
import { customFieldDefinitions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// GET — all custom field definitions, optionally filtered by entityType
export async function GET(request: NextRequest) {
  try {
    await requireRole(["admin"]);

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType");

    let query = db.select().from(customFieldDefinitions);
    if (entityType) {
      const validTypes = ["contact", "deal", "company"] as const;
      if (validTypes.includes(entityType as typeof validTypes[number])) {
        query = query.where(
          eq(
            customFieldDefinitions.entityType,
            entityType as "contact" | "deal" | "company"
          )
        ) as typeof query;
      }
    }

    const fields = await query;
    return NextResponse.json(fields);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — create a custom field
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(["admin"]);

    const body = await request.json();
    const {
      entityType,
      name,
      label,
      fieldType,
      options,
      isRequired,
      position,
      isVisibleInList,
    } = body;

    const [field] = await db
      .insert(customFieldDefinitions)
      .values({
        entityType,
        name,
        label,
        fieldType,
        options: options ?? null,
        isRequired: isRequired ?? false,
        position: position ?? 0,
        isVisibleInList: isVisibleInList ?? false,
      })
      .returning();

    await logAuditEvent(user.id, { action: "create_field_definition", entityType: "field_definition", entityId: field.id });

    return NextResponse.json(field, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("POST /api/admin/fields error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT — update a custom field
export async function PUT(request: NextRequest) {
  try {
    const user = await requireRole(["admin"]);

    const body = await request.json();
    const { id, label, options, isRequired, position, isVisibleInList } = body;

    const [updated] = await db
      .update(customFieldDefinitions)
      .set({
        label,
        options: options ?? null,
        isRequired,
        position,
        isVisibleInList,
      })
      .where(eq(customFieldDefinitions.id, id))
      .returning();

    await logAuditEvent(user.id, { action: "update_field_definition", entityType: "field_definition", entityId: id });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("PUT /api/admin/fields error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE — delete a custom field
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireRole(["admin"]);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await db.delete(customFieldDefinitions).where(eq(customFieldDefinitions.id, id));

    await logAuditEvent(user.id, { action: "delete_field_definition", entityType: "field_definition", entityId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

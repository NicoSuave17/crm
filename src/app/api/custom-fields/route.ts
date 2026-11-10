import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import {
  listFieldDefinitions,
  createFieldDefinition,
  getFieldValues,
  setFieldValue,
} from "@/lib/api/custom-fields";

export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType") || undefined;
    const entityId = searchParams.get("entityId");

    // Get field values for a specific entity
    if (entityId) {
      const values = await getFieldValues(entityId);
      return NextResponse.json(values);
    }

    // Get field definitions
    const fields = await listFieldDefinitions(entityType);
    return NextResponse.json(fields);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireUser();
    const body = await request.json();

    // Set field value
    if (body.fieldDefinitionId && body.entityId) {
      const value = await setFieldValue(body.fieldDefinitionId, body.entityId, {
        textValue: body.textValue,
        numberValue: body.numberValue,
        dateValue: body.dateValue ? new Date(body.dateValue) : undefined,
        booleanValue: body.booleanValue,
      });
      return NextResponse.json(value);
    }

    // Create field definition
    if (body.name && body.label && body.fieldType && body.entityType) {
      const field = await createFieldDefinition(body);
      return NextResponse.json(field, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/custom-fields error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { customFieldDefinitions, customFieldValues } from "@/lib/db/schema";
import { eq, inArray, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    await requireUser();

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType");
    const entityIdsParam = searchParams.get("entityIds");

    if (!entityType || !entityIdsParam) {
      return NextResponse.json(
        { error: "entityType and entityIds are required" },
        { status: 400 }
      );
    }

    const entityIds = entityIdsParam.split(",").filter(Boolean);
    if (entityIds.length === 0) {
      return NextResponse.json({});
    }

    // Get field definitions for this entity type
    const defs = await db
      .select()
      .from(customFieldDefinitions)
      .where(
        eq(
          customFieldDefinitions.entityType,
          entityType as "contact" | "deal" | "company"
        )
      );

    if (defs.length === 0) {
      return NextResponse.json({});
    }

    const defIds = defs.map((d) => d.id);

    // Get all values for these entities and field definitions
    const values = await db
      .select({
        entityId: customFieldValues.entityId,
        fieldDefinitionId: customFieldValues.fieldDefinitionId,
        textValue: customFieldValues.textValue,
        numberValue: customFieldValues.numberValue,
        dateValue: customFieldValues.dateValue,
        booleanValue: customFieldValues.booleanValue,
      })
      .from(customFieldValues)
      .where(
        and(
          inArray(customFieldValues.entityId, entityIds),
          inArray(customFieldValues.fieldDefinitionId, defIds)
        )
      );

    // Build lookup: defId -> { name, label, fieldType }
    const defMap = new Map(defs.map((d) => [d.id, d]));

    // Build result: Record<entityId, Record<fieldName, displayValue>>
    const result: Record<string, Record<string, string>> = {};

    for (const v of values) {
      const def = defMap.get(v.fieldDefinitionId);
      if (!def) continue;

      if (!result[v.entityId]) result[v.entityId] = {};

      let displayValue = "";
      switch (def.fieldType) {
        case "boolean":
          displayValue = v.booleanValue ? "Yes" : "No";
          break;
        case "number":
        case "currency":
          displayValue = v.numberValue ?? "";
          break;
        case "date":
          displayValue = v.dateValue
            ? new Date(v.dateValue).toLocaleDateString()
            : "";
          break;
        default:
          displayValue = v.textValue ?? "";
          break;
      }

      result[v.entityId][def.name] = displayValue;
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

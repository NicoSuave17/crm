import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { companies, activities, deals, contactCompanies, companyTags } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const mergeSchema = z.object({
  masterId: z.string().uuid(),
  duplicateId: z.string().uuid(),
  fieldResolution: z.record(z.string(), z.enum(["master", "duplicate"])).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const body = await request.json();
    const parsed = mergeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    const { masterId, duplicateId, fieldResolution } = parsed.data;
    if (masterId === duplicateId) {
      return NextResponse.json({ error: "Cannot merge a record with itself" }, { status: 400 });
    }

    const [master] = await db.select().from(companies).where(eq(companies.id, masterId)).limit(1);
    const [duplicate] = await db.select().from(companies).where(eq(companies.id, duplicateId)).limit(1);

    if (!master || !duplicate) {
      return NextResponse.json({ error: "One or both companies not found" }, { status: 404 });
    }

    // Build merged field values
    const mergedFields: Record<string, unknown> = {};
    if (fieldResolution) {
      for (const [field, source] of Object.entries(fieldResolution)) {
        if (field in master && field in duplicate) {
          mergedFields[field] = source === "duplicate"
            ? (duplicate as Record<string, unknown>)[field]
            : (master as Record<string, unknown>)[field];
        }
      }
    }

    // Execute all merge operations in a transaction
    await db.transaction(async (tx) => {
      // Re-link activities
      await tx.update(activities).set({ companyId: masterId }).where(eq(activities.companyId, duplicateId));

      // Re-link deals
      await tx.update(deals).set({ companyId: masterId }).where(eq(deals.companyId, duplicateId));

      // Merge contact associations
      const dupContacts = await tx.select().from(contactCompanies).where(eq(contactCompanies.companyId, duplicateId));
      for (const cc of dupContacts) {
        await tx.insert(contactCompanies)
          .values({ contactId: cc.contactId, companyId: masterId, role: cc.role, isPrimary: false })
          .onConflictDoNothing();
      }

      // Merge tags
      const dupTags = await tx.select().from(companyTags).where(eq(companyTags.companyId, duplicateId));
      for (const tag of dupTags) {
        await tx.insert(companyTags)
          .values({ companyId: masterId, tagId: tag.tagId })
          .onConflictDoNothing();
      }

      // Update master fields
      if (Object.keys(mergedFields).length > 0) {
        await tx.update(companies).set({ ...mergedFields, updatedAt: new Date() }).where(eq(companies.id, masterId));
      }

      // Delete duplicate
      await tx.delete(companies).where(eq(companies.id, duplicateId));

      // Log activity
      await tx.insert(activities).values({
        type: "system_event",
        subject: `Merged company "${duplicate.name}" into this record`,
        companyId: masterId,
        userId: user.id,
      });
    });

    return NextResponse.json({ success: true, masterId });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/companies/merge error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { contacts, activities, tasks, deals, contactTags, contactCompanies } from "@/lib/db/schema";
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

    // Get both contacts
    const [master] = await db.select().from(contacts).where(eq(contacts.id, masterId)).limit(1);
    const [duplicate] = await db.select().from(contacts).where(eq(contacts.id, duplicateId)).limit(1);

    if (!master || !duplicate) {
      return NextResponse.json({ error: "One or both contacts not found" }, { status: 404 });
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
      // Re-link activities from duplicate to master
      await tx.update(activities).set({ contactId: masterId }).where(eq(activities.contactId, duplicateId));

      // Re-link tasks from duplicate to master
      await tx.update(tasks).set({ contactId: masterId }).where(eq(tasks.contactId, duplicateId));

      // Re-link deals from duplicate to master
      await tx.update(deals).set({ contactId: masterId }).where(eq(deals.contactId, duplicateId));

      // Merge tags (add duplicate's tags to master, ignore conflicts)
      const dupTags = await tx.select().from(contactTags).where(eq(contactTags.contactId, duplicateId));
      for (const tag of dupTags) {
        await tx.insert(contactTags)
          .values({ contactId: masterId, tagId: tag.tagId })
          .onConflictDoNothing();
      }

      // Merge company associations
      const dupCompanies = await tx.select().from(contactCompanies).where(eq(contactCompanies.contactId, duplicateId));
      for (const cc of dupCompanies) {
        await tx.insert(contactCompanies)
          .values({ contactId: masterId, companyId: cc.companyId, role: cc.role, isPrimary: false })
          .onConflictDoNothing();
      }

      // Update master with selected field values
      if (Object.keys(mergedFields).length > 0) {
        await tx.update(contacts).set({ ...mergedFields, updatedAt: new Date() }).where(eq(contacts.id, masterId));
      }

      // Delete the duplicate
      await tx.delete(contacts).where(eq(contacts.id, duplicateId));

      // Log merge activity
      await tx.insert(activities).values({
        type: "system_event",
        subject: `Merged contact "${duplicate.firstName} ${duplicate.lastName ?? ""}" into this record`,
        contactId: masterId,
        userId: user.id,
      });
    });

    return NextResponse.json({ success: true, masterId });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/contacts/merge error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

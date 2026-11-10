import { db } from "@/lib/db";
import { savedViews, savedViewRoleAccess } from "@/lib/db/schema";
import { eq, and, or, inArray } from "drizzle-orm";
import type { UserRole } from "@/lib/auth/helpers";

export async function listSavedViews(
  userId: string,
  entityType?: string,
  userRole?: UserRole
) {
  const conditions = [
    or(eq(savedViews.userId, userId), eq(savedViews.isShared, true)),
  ];

  if (entityType) {
    conditions.push(
      eq(savedViews.entityType, entityType as "contact" | "deal" | "company" | "task")
    );
  }

  const userViews = await db
    .select()
    .from(savedViews)
    .where(and(...conditions));

  // Also fetch admin views accessible to this user's role
  if (userRole) {
    const roleAccessRows = await db
      .select({ savedViewId: savedViewRoleAccess.savedViewId })
      .from(savedViewRoleAccess)
      .where(eq(savedViewRoleAccess.role, userRole));

    const adminViewIds = roleAccessRows.map((r) => r.savedViewId);

    if (adminViewIds.length > 0) {
      const adminViewConditions = [
        inArray(savedViews.id, adminViewIds),
        eq(savedViews.isAdminView, true),
      ];

      if (entityType) {
        adminViewConditions.push(
          eq(savedViews.entityType, entityType as "contact" | "deal" | "company" | "task")
        );
      }

      const adminViews = await db
        .select()
        .from(savedViews)
        .where(and(...adminViewConditions));

      // Merge, deduplicate by ID
      const existingIds = new Set(userViews.map((v) => v.id));
      for (const av of adminViews) {
        if (!existingIds.has(av.id)) {
          userViews.push(av);
        }
      }
    }
  }

  return userViews;
}

export async function createSavedView(
  userId: string,
  data: {
    name: string;
    entityType: "contact" | "deal" | "company" | "task";
    filters: Record<string, unknown>[];
    sortBy?: { field: string; direction: "asc" | "desc" }[];
    columns?: string[];
    isShared?: boolean;
  }
) {
  const [view] = await db
    .insert(savedViews)
    .values({ ...data, userId })
    .returning();
  return view;
}

export async function updateSavedView(
  id: string,
  userId: string,
  data: Partial<{
    name: string;
    filters: Record<string, unknown>[];
    sortBy: { field: string; direction: "asc" | "desc" }[];
    columns: string[];
    isShared: boolean;
    isDefault: boolean;
  }>
) {
  const [view] = await db
    .update(savedViews)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(savedViews.id, id), eq(savedViews.userId, userId)))
    .returning();
  return view;
}

export async function deleteSavedView(id: string, userId: string) {
  await db
    .delete(savedViews)
    .where(and(eq(savedViews.id, id), eq(savedViews.userId, userId)));
}

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { teams, teamMembers, users } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";

const updateTeamSchema = z.object({
  name: z.string().min(1).optional(),
  managerId: z.string().uuid().nullable().optional(),
  memberIds: z.array(z.string().uuid()).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["admin"]);

    const { id } = await params;
    const body = await request.json();
    const parsed = updateTeamSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, managerId, memberIds } = parsed.data;

    // Verify team exists
    const [existing] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Update team fields
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (managerId !== undefined) updateData.managerId = managerId;

    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = new Date();
      await db.update(teams).set(updateData).where(eq(teams.id, id));
    }

    // Sync members if provided
    if (memberIds !== undefined) {
      // Get current members
      const currentMembers = await db
        .select({ userId: teamMembers.userId })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, id));

      const currentMemberIds = currentMembers.map((m) => m.userId);

      // Remove old members
      if (currentMemberIds.length > 0) {
        await db
          .delete(teamMembers)
          .where(eq(teamMembers.teamId, id));

        // Clear teamId for removed users
        const removedIds = currentMemberIds.filter(
          (uid) => !memberIds.includes(uid)
        );
        if (removedIds.length > 0) {
          await db
            .update(users)
            .set({ teamId: null })
            .where(
              and(inArray(users.id, removedIds), eq(users.teamId, id))
            );
        }
      }

      // Insert new members
      if (memberIds.length > 0) {
        await db
          .insert(teamMembers)
          .values(memberIds.map((userId) => ({ teamId: id, userId })));

        // Update users' teamId
        for (const userId of memberIds) {
          await db
            .update(users)
            .set({ teamId: id })
            .where(eq(users.id, userId));
        }
      }
    }

    // Return updated team
    const [updated] = await db
      .select({
        id: teams.id,
        name: teams.name,
        managerId: teams.managerId,
        createdAt: teams.createdAt,
      })
      .from(teams)
      .where(eq(teams.id, id));

    return NextResponse.json(updated);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" || error.message === "Forbidden")
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Failed to update team:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["admin"]);

    const { id } = await params;

    // Verify team exists
    const [existing] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Clear teamId for all users in this team
    await db
      .update(users)
      .set({ teamId: null })
      .where(eq(users.teamId, id));

    // Delete all team members
    await db.delete(teamMembers).where(eq(teamMembers.teamId, id));

    // Delete the team
    await db.delete(teams).where(eq(teams.id, id));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" || error.message === "Forbidden")
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Failed to delete team:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

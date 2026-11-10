import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { teams, teamMembers, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const createTeamSchema = z.object({
  name: z.string().min(1),
  managerId: z.string().uuid().optional(),
  memberIds: z.array(z.string().uuid()).optional(),
});

export async function GET() {
  try {
    await requireRole(["admin", "manager"]);

    const allTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        managerId: teams.managerId,
        managerFirstName: users.firstName,
        managerLastName: users.lastName,
        createdAt: teams.createdAt,
      })
      .from(teams)
      .leftJoin(users, eq(teams.managerId, users.id))
      .orderBy(teams.name);

    // Get members for each team
    const result = await Promise.all(
      allTeams.map(async (team) => {
        const members = await db
          .select({
            userId: teamMembers.userId,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          })
          .from(teamMembers)
          .innerJoin(users, eq(teamMembers.userId, users.id))
          .where(eq(teamMembers.teamId, team.id));
        return { ...team, members };
      })
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(["admin"]);

    const body = await request.json();
    const parsed = createTeamSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, managerId, memberIds } = parsed.data;

    const [team] = await db
      .insert(teams)
      .values({ name, managerId: managerId ?? null })
      .returning();

    // Add members
    if (memberIds && memberIds.length > 0) {
      await db
        .insert(teamMembers)
        .values(memberIds.map((userId) => ({ teamId: team.id, userId })));
      // Update users' teamId
      for (const userId of memberIds) {
        await db
          .update(users)
          .set({ teamId: team.id })
          .where(eq(users.id, userId));
      }
    }

    return NextResponse.json(team, { status: 201 });
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

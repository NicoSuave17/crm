import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getCurrentUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (user) return user;

  // Auto-create CRM user on first login
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  // Check if any admin exists — if not, auto-promote first user
  const [existingAdmin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);

  try {
    const [newUser] = await db
      .insert(users)
      .values({
        clerkId,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
        firstName: clerkUser.firstName ?? "Unknown",
        lastName: clerkUser.lastName ?? "",
        avatarUrl: clerkUser.imageUrl,
        // If no admin exists, make this user the admin
        ...(existingAdmin ? {} : { role: "admin" }),
      })
      .onConflictDoNothing({ target: users.clerkId })
      .returning();

    if (newUser) return newUser;
  } catch {
    // Ignore insert errors (race condition with concurrent requests)
  }

  // Re-query — the user was created by a concurrent request
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  return existingUser ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export type UserRole = (typeof users.$inferSelect)["role"];

export async function requireRole(roles: UserRole[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new Error("Forbidden");
  }
  return user;
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { adminRoleConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET — current user's role config (any authenticated user)
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [config] = await db
      .select()
      .from(adminRoleConfig)
      .where(eq(adminRoleConfig.role, user.role))
      .limit(1);

    if (!config) {
      return NextResponse.json({
        role: user.role,
        landingPage: "/dashboard",
        dashboardWidgets: [],
        fieldLabels: {},
      });
    }

    return NextResponse.json(config);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

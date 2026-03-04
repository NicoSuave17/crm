import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { listUsers } from "@/lib/api/users";

export async function GET() {
  try {
    await requireUser();

    const users = await listUsers();
    return NextResponse.json(users);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/users error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

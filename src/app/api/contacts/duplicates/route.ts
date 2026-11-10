import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { findDuplicateContacts } from "@/lib/api/duplicates";

export async function GET(request: NextRequest) {
  try {
    await requireUser();

    const { searchParams } = new URL(request.url);
    const firstName = searchParams.get("firstName");
    const lastName = searchParams.get("lastName");
    const email = searchParams.get("email");
    const phone = searchParams.get("phone");
    const excludeId = searchParams.get("excludeId");

    if (!firstName) {
      return NextResponse.json({ error: "firstName is required" }, { status: 400 });
    }

    const duplicates = await findDuplicateContacts({
      firstName,
      lastName: lastName || undefined,
      email: email || undefined,
      phone: phone || undefined,
      excludeId: excludeId || undefined,
    });

    return NextResponse.json({ duplicates });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

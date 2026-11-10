import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { removeTagFromContact } from "@/lib/api/tags";

export async function DELETE(request: NextRequest) {
  try {
    await requireUser();
    const body = await request.json();

    if (!body.contactId || !body.tagId) {
      return NextResponse.json({ error: "contactId and tagId required" }, { status: 400 });
    }

    await removeTagFromContact(body.contactId, body.tagId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

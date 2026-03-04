import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { listTags, createTag, addTagToContact, addTagToDeal } from "@/lib/api/tags";

export async function GET() {
  try {
    await requireUser();
    const data = await listTags();
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireUser();
    const body = await request.json();

    // Create tag
    if (body.name) {
      const tag = await createTag(body.name, body.color ?? "#6B7280");
      return NextResponse.json(tag, { status: 201 });
    }

    // Assign tag to contact
    if (body.contactId && body.tagId) {
      await addTagToContact(body.contactId, body.tagId);
      return NextResponse.json({ success: true });
    }

    // Assign tag to deal
    if (body.dealId && body.tagId) {
      await addTagToDeal(body.dealId, body.tagId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

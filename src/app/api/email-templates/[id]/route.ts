import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import {
  updateEmailTemplate,
  deleteEmailTemplate,
} from "@/lib/api/email-templates";
import { updateEmailTemplateSchema } from "@/lib/validators/email-template";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json();
    const parsed = updateEmailTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const updated = await updateEmailTemplate(id, user.id, parsed.data);
    if (!updated) {
      return NextResponse.json(
        { error: "Template not found or not owned by you" },
        { status: 404 }
      );
    }
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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
    const user = await requireUser();
    const { id } = await params;
    const deleted = await deleteEmailTemplate(id, user.id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Template not found or not owned by you" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

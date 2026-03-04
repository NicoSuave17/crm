import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import {
  listEmailTemplates,
  createEmailTemplate,
} from "@/lib/api/email-templates";
import { createEmailTemplateSchema } from "@/lib/validators/email-template";

export async function GET() {
  try {
    const user = await requireUser();
    const data = await listEmailTemplates(user.id);
    return NextResponse.json(data);
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

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = createEmailTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const template = await createEmailTemplate(parsed.data, user.id);
    return NextResponse.json(template, { status: 201 });
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

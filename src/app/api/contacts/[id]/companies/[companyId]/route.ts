import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { unlinkContactCompany } from "@/lib/api/contact-companies";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; companyId: string }> }
) {
  try {
    await requireUser();
    const { id, companyId } = await params;

    await unlinkContactCompany(id, companyId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("DELETE /api/contacts/[id]/companies/[companyId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

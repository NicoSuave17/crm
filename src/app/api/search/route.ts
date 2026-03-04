import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { contacts, deals, companies, tasks } from "@/lib/db/schema";
import { ilike, or } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    await requireUser();

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    if (!q || q.length < 2) {
      return NextResponse.json({ contacts: [], deals: [], companies: [], tasks: [] });
    }

    const pattern = `%${q}%`;

    const [contactResults, dealResults, companyResults, taskResults] = await Promise.all([
      db
        .select({
          id: contacts.id,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          email: contacts.email,
          type: contacts.type,
        })
        .from(contacts)
        .where(
          or(
            ilike(contacts.firstName, pattern),
            ilike(contacts.lastName, pattern),
            ilike(contacts.email, pattern),
            ilike(contacts.whopUsername, pattern)
          )
        )
        .limit(5),
      db
        .select({
          id: deals.id,
          title: deals.title,
        })
        .from(deals)
        .where(ilike(deals.title, pattern))
        .limit(5),
      db
        .select({
          id: companies.id,
          name: companies.name,
          domain: companies.domain,
        })
        .from(companies)
        .where(
          or(
            ilike(companies.name, pattern),
            ilike(companies.domain, pattern)
          )
        )
        .limit(5),
      db
        .select({
          id: tasks.id,
          title: tasks.title,
          status: tasks.status,
        })
        .from(tasks)
        .where(ilike(tasks.title, pattern))
        .limit(5),
    ]);

    return NextResponse.json({
      contacts: contactResults,
      deals: dealResults,
      companies: companyResults,
      tasks: taskResults,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

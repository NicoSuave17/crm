import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { getRecordScope } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { contacts, deals, companies, tasks, activities, customFieldValues, customFieldDefinitions } from "@/lib/db/schema";
import { ilike, or, eq, and, type SQL } from "drizzle-orm";

/**
 * Compute relevance score: exact match (3) > starts-with (2) > contains (1)
 */
function relevanceScore(fieldValue: string | null, query: string): number {
  if (!fieldValue) return 0;
  const lower = fieldValue.toLowerCase();
  const q = query.toLowerCase();
  if (lower === q) return 3;
  if (lower.startsWith(q)) return 2;
  if (lower.includes(q)) return 1;
  return 0;
}

function sortByRelevance<T>(
  items: T[],
  query: string,
  getFields: (item: T) => (string | null)[]
): T[] {
  return [...items].sort((a, b) => {
    const scoreA = Math.max(...getFields(a).map((f) => relevanceScore(f, query)));
    const scoreB = Math.max(...getFields(b).map((f) => relevanceScore(f, query)));
    return scoreB - scoreA;
  });
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    if (!q || q.length < 2) {
      return NextResponse.json({ contacts: [], deals: [], companies: [], tasks: [], activities: [] });
    }

    const pattern = `%${q}%`;

    // Get permission scopes for each entity type
    const [contactScope, dealScope, companyScope, taskScope] = await Promise.all([
      getRecordScope(user.role, "contact"),
      getRecordScope(user.role, "deal"),
      getRecordScope(user.role, "company"),
      getRecordScope(user.role, "task"),
    ]);

    // Build scoped conditions
    const contactSearchCondition = or(
      ilike(contacts.firstName, pattern),
      ilike(contacts.lastName, pattern),
      ilike(contacts.email, pattern),
      ilike(contacts.whopUsername, pattern)
    )!;
    const contactConditions: SQL[] = [contactSearchCondition];
    if (contactScope === "own") contactConditions.push(eq(contacts.ownerId, user.id));

    const dealSearchCondition = ilike(deals.title, pattern);
    const dealConditions: SQL[] = [dealSearchCondition];
    if (dealScope === "own") dealConditions.push(eq(deals.ownerId, user.id));

    const companySearchCondition = or(
      ilike(companies.name, pattern),
      ilike(companies.domain, pattern)
    )!;
    const companyConditions: SQL[] = [companySearchCondition];
    if (companyScope === "own") companyConditions.push(eq(companies.ownerId, user.id));

    const taskSearchCondition = ilike(tasks.title, pattern);
    const taskConditions: SQL[] = [taskSearchCondition];
    if (taskScope === "own") taskConditions.push(eq(tasks.assigneeId, user.id));

    // Activity search: search subject and body
    const activitySearchCondition = or(
      ilike(activities.subject, pattern),
      ilike(activities.body, pattern)
    )!;

    const [contactResults, dealResults, companyResults, taskResults, activityResults] = await Promise.all([
      db
        .select({
          id: contacts.id,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          email: contacts.email,
          type: contacts.type,
        })
        .from(contacts)
        .where(and(...contactConditions))
        .limit(8),
      db
        .select({
          id: deals.id,
          title: deals.title,
        })
        .from(deals)
        .where(and(...dealConditions))
        .limit(8),
      db
        .select({
          id: companies.id,
          name: companies.name,
          domain: companies.domain,
        })
        .from(companies)
        .where(and(...companyConditions))
        .limit(8),
      db
        .select({
          id: tasks.id,
          title: tasks.title,
          status: tasks.status,
        })
        .from(tasks)
        .where(and(...taskConditions))
        .limit(8),
      db
        .select({
          id: activities.id,
          type: activities.type,
          subject: activities.subject,
          contactId: activities.contactId,
          dealId: activities.dealId,
          occurredAt: activities.occurredAt,
        })
        .from(activities)
        .where(activitySearchCondition)
        .limit(5),
    ]);

    // Search custom field values for additional matches
    const cfResults = await db
      .select({
        entityId: customFieldValues.entityId,
        entityType: customFieldDefinitions.entityType,
      })
      .from(customFieldValues)
      .innerJoin(
        customFieldDefinitions,
        eq(customFieldValues.fieldDefinitionId, customFieldDefinitions.id)
      )
      .where(ilike(customFieldValues.textValue, pattern))
      .limit(10);

    // Merge custom field matches into results (deduplicate by ID)
    const contactIds = new Set(contactResults.map((c) => c.id));
    const dealIds = new Set(dealResults.map((d) => d.id));
    const companyIds = new Set(companyResults.map((c) => c.id));

    for (const cf of cfResults) {
      if (cf.entityType === "contact" && !contactIds.has(cf.entityId) && contactResults.length < 8) {
        const [c] = await db
          .select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName, email: contacts.email, type: contacts.type })
          .from(contacts)
          .where(eq(contacts.id, cf.entityId))
          .limit(1);
        if (c) { contactResults.push(c); contactIds.add(c.id); }
      }
      if (cf.entityType === "deal" && !dealIds.has(cf.entityId) && dealResults.length < 8) {
        const [d] = await db
          .select({ id: deals.id, title: deals.title })
          .from(deals)
          .where(eq(deals.id, cf.entityId))
          .limit(1);
        if (d) { dealResults.push(d); dealIds.add(d.id); }
      }
      if (cf.entityType === "company" && !companyIds.has(cf.entityId) && companyResults.length < 8) {
        const [co] = await db
          .select({ id: companies.id, name: companies.name, domain: companies.domain })
          .from(companies)
          .where(eq(companies.id, cf.entityId))
          .limit(1);
        if (co) { companyResults.push(co); companyIds.add(co.id); }
      }
    }

    // Sort by relevance: exact match > starts-with > contains
    const sortedContacts = sortByRelevance(
      contactResults,
      q,
      (c) => [c.firstName, c.lastName, c.email]
    ).slice(0, 5);

    const sortedDeals = sortByRelevance(
      dealResults,
      q,
      (d) => [d.title]
    ).slice(0, 5);

    const sortedCompanies = sortByRelevance(
      companyResults,
      q,
      (c) => [c.name, c.domain]
    ).slice(0, 5);

    const sortedTasks = sortByRelevance(
      taskResults,
      q,
      (t) => [t.title]
    ).slice(0, 5);

    const sortedActivities = sortByRelevance(
      activityResults,
      q,
      (a) => [a.subject]
    ).slice(0, 5);

    return NextResponse.json({
      contacts: sortedContacts.map((c) => ({ ...c, _type: "contact" as const })),
      deals: sortedDeals.map((d) => ({ ...d, _type: "deal" as const })),
      companies: sortedCompanies.map((c) => ({ ...c, _type: "company" as const })),
      tasks: sortedTasks.map((t) => ({ ...t, _type: "task" as const })),
      activities: sortedActivities.map((a) => ({ ...a, _type: "activity" as const })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

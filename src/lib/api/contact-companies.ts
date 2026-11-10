import { db } from "@/lib/db";
import { contactCompanies, contacts, companies, deals, users } from "@/lib/db/schema";
import { eq, and, isNull, ne, inArray } from "drizzle-orm";

export async function getContactCompanies(contactId: string) {
  return db
    .select({
      companyId: contactCompanies.companyId,
      name: companies.name,
      domain: companies.domain,
      industry: companies.industry,
      role: contactCompanies.role,
      isPrimary: contactCompanies.isPrimary,
    })
    .from(contactCompanies)
    .innerJoin(companies, eq(contactCompanies.companyId, companies.id))
    .where(eq(contactCompanies.contactId, contactId));
}

export async function getCompanyContacts(companyId: string) {
  return db
    .select({
      contactId: contactCompanies.contactId,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      email: contacts.email,
      avatarUrl: contacts.avatarUrl,
      type: contacts.type,
      role: contactCompanies.role,
      isPrimary: contactCompanies.isPrimary,
    })
    .from(contactCompanies)
    .innerJoin(contacts, eq(contactCompanies.contactId, contacts.id))
    .where(eq(contactCompanies.companyId, companyId));
}

export interface OwnershipConflict {
  contactId: string;
  contactName: string;
  currentOwnerId: string;
  currentOwnerName: string;
  companyOwnerId: string;
  companyOwnerName: string;
}

export interface LinkContactCompanyResult {
  link: typeof contactCompanies.$inferSelect;
  ownershipConflicts: OwnershipConflict[];
  autoAssigned: boolean;
}

export async function linkContactCompany(
  contactId: string,
  companyId: string,
  role?: string
): Promise<LinkContactCompanyResult> {
  const [result] = await db
    .insert(contactCompanies)
    .values({ contactId, companyId, role: role ?? null })
    .onConflictDoUpdate({
      target: [contactCompanies.contactId, contactCompanies.companyId],
      set: { role: role ?? null },
    })
    .returning();

  // Backfill deals for this contact that have no company set
  await db
    .update(deals)
    .set({ companyId })
    .where(
      and(
        eq(deals.contactId, contactId),
        isNull(deals.companyId)
      )
    );

  // Check company owner and contact owner for assignment/conflict
  let autoAssigned = false;
  const ownershipConflicts: OwnershipConflict[] = [];

  try {
    const [company] = await db
      .select({ ownerId: companies.ownerId })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    const companyOwnerId = company?.ownerId;
    console.log("[linkContactCompany] companyId:", companyId, "company row:", JSON.stringify(company), "companyOwnerId:", companyOwnerId);

    if (companyOwnerId) {
      const [contact] = await db
        .select({
          ownerId: contacts.ownerId,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
        })
        .from(contacts)
        .where(eq(contacts.id, contactId))
        .limit(1);

      console.log("[linkContactCompany] contact.ownerId:", contact?.ownerId, "match:", contact?.ownerId === companyOwnerId);

      if (!contact?.ownerId) {
        // No owner — auto-assign silently
        await db
          .update(contacts)
          .set({ ownerId: companyOwnerId, updatedAt: new Date() })
          .where(eq(contacts.id, contactId));
        autoAssigned = true;
      } else if (contact.ownerId !== companyOwnerId) {
        // Different owner — return conflict info for the frontend to handle
        const [currentOwner, companyOwner] = await Promise.all([
          db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
            .from(users).where(eq(users.id, contact.ownerId)).then(r => r[0]),
          db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
            .from(users).where(eq(users.id, companyOwnerId)).then(r => r[0]),
        ]);

        if (currentOwner && companyOwner) {
          ownershipConflicts.push({
            contactId,
            contactName: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
            currentOwnerId: currentOwner.id,
            currentOwnerName: [currentOwner.firstName, currentOwner.lastName].filter(Boolean).join(" "),
            companyOwnerId: companyOwner.id,
            companyOwnerName: [companyOwner.firstName, companyOwner.lastName].filter(Boolean).join(" "),
          });
        }
      }
    }
  } catch (err) {
    console.error("[linkContactCompany] ownership check error:", err);
  }

  return { link: result, ownershipConflicts, autoAssigned };
}

/**
 * Bulk link contacts to a company and return ownership conflicts.
 * Used by the bulk actions flow.
 */
export async function bulkLinkContactsCompany(
  contactIds: string[],
  companyId: string
): Promise<{ count: number; ownershipConflicts: OwnershipConflict[] }> {
  // Insert links
  const rows = contactIds.map((contactId) => ({ contactId, companyId }));
  await db.insert(contactCompanies).values(rows).onConflictDoNothing();

  // Get company owner
  const [company] = await db
    .select({ ownerId: companies.ownerId })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  const ownershipConflicts: OwnershipConflict[] = [];

  try {
    const companyOwnerId = company?.ownerId;
    console.log("[bulkLinkContactsCompany] companyOwnerId:", companyOwnerId);

    if (companyOwnerId) {
      // Auto-assign contacts with no owner
      await db
        .update(contacts)
        .set({ ownerId: companyOwnerId, updatedAt: new Date() })
        .where(
          and(
            inArray(contacts.id, contactIds),
            isNull(contacts.ownerId)
          )
        );

      // Find contacts that have a different owner (conflicts)
      const conflictContacts = await db
        .select({
          id: contacts.id,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          ownerId: contacts.ownerId,
          ownerFirstName: users.firstName,
          ownerLastName: users.lastName,
        })
        .from(contacts)
        .innerJoin(users, eq(contacts.ownerId, users.id))
        .where(
          and(
            inArray(contacts.id, contactIds),
            ne(contacts.ownerId, companyOwnerId)
          )
        );

      console.log("[bulkLinkContactsCompany] conflicts found:", conflictContacts.length);

      if (conflictContacts.length > 0) {
        // Get company owner name
        const [companyOwner] = await db
          .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, companyOwnerId));

        if (companyOwner) {
          for (const c of conflictContacts) {
            ownershipConflicts.push({
              contactId: c.id,
              contactName: [c.firstName, c.lastName].filter(Boolean).join(" "),
              currentOwnerId: c.ownerId!,
              currentOwnerName: [c.ownerFirstName, c.ownerLastName].filter(Boolean).join(" "),
              companyOwnerId: companyOwner.id,
              companyOwnerName: [companyOwner.firstName, companyOwner.lastName].filter(Boolean).join(" "),
            });
          }
        }
      }
    }
  } catch (err) {
    console.error("[bulkLinkContactsCompany] ownership check error:", err);
  }

  return { count: contactIds.length, ownershipConflicts };
}

export async function unlinkContactCompany(
  contactId: string,
  companyId: string
) {
  await db
    .delete(contactCompanies)
    .where(
      and(
        eq(contactCompanies.contactId, contactId),
        eq(contactCompanies.companyId, companyId)
      )
    );
}

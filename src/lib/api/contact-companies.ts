import { db } from "@/lib/db";
import { contactCompanies, contacts, companies } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

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

export async function linkContactCompany(
  contactId: string,
  companyId: string,
  role?: string
) {
  const [result] = await db
    .insert(contactCompanies)
    .values({ contactId, companyId, role: role ?? null })
    .onConflictDoUpdate({
      target: [contactCompanies.contactId, contactCompanies.companyId],
      set: { role: role ?? null },
    })
    .returning();

  return result;
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

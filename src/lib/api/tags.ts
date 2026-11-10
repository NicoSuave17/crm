import { db } from "@/lib/db";
import { tags, contactTags, dealTags, companyTags } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function listTags() {
  return db.select().from(tags).orderBy(tags.name);
}

export async function createTag(name: string, color: string) {
  const [tag] = await db
    .insert(tags)
    .values({ name, color })
    .returning();
  return tag;
}

export async function deleteTag(id: string) {
  await db.delete(tags).where(eq(tags.id, id));
}

export async function addTagToContact(contactId: string, tagId: string) {
  await db
    .insert(contactTags)
    .values({ contactId, tagId })
    .onConflictDoNothing();
}

export async function removeTagFromContact(contactId: string, tagId: string) {
  await db
    .delete(contactTags)
    .where(
      and(eq(contactTags.contactId, contactId), eq(contactTags.tagId, tagId))
    );
}

export async function removeTagFromDeal(dealId: string, tagId: string) {
  await db
    .delete(dealTags)
    .where(
      and(eq(dealTags.dealId, dealId), eq(dealTags.tagId, tagId))
    );
}

export async function getDealTags(dealId: string) {
  return db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(dealTags)
    .innerJoin(tags, eq(dealTags.tagId, tags.id))
    .where(eq(dealTags.dealId, dealId));
}

export async function addTagToDeal(dealId: string, tagId: string) {
  await db
    .insert(dealTags)
    .values({ dealId, tagId })
    .onConflictDoNothing();
}

export async function getContactTags(contactId: string) {
  return db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(contactTags)
    .innerJoin(tags, eq(contactTags.tagId, tags.id))
    .where(eq(contactTags.contactId, contactId));
}

export async function addTagToCompany(companyId: string, tagId: string) {
  await db
    .insert(companyTags)
    .values({ companyId, tagId })
    .onConflictDoNothing();
}

export async function removeTagFromCompany(companyId: string, tagId: string) {
  await db
    .delete(companyTags)
    .where(
      and(eq(companyTags.companyId, companyId), eq(companyTags.tagId, tagId))
    );
}

export async function getCompanyTags(companyId: string) {
  return db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(companyTags)
    .innerJoin(tags, eq(companyTags.tagId, tags.id))
    .where(eq(companyTags.companyId, companyId));
}

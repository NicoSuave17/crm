import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { contacts, companies, deals, contactTags, dealTags, contactCompanies, gatekeeperDecisionLog } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { logAuditEvent } from "@/lib/api/audit-log";
import { randomUUID } from "crypto";

const MAX_BULK_IDS = 500;

const VALID_CONTACT_STATUSES = ["active", "churned", "at_risk", "prospect", "closed_lost"];

function validateIds(ids: unknown, label: string): string[] | NextResponse {
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: `${label} must be a non-empty array` }, { status: 400 });
  }
  if (ids.length > MAX_BULK_IDS) {
    return NextResponse.json(
      { error: `Too many items selected (max ${MAX_BULK_IDS})` },
      { status: 400 }
    );
  }
  return ids as string[];
}

// Bulk operations
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();

    // Log bulk operations through gatekeeper decision log for audit trail
    const logBulkDecision = async (action: string, entityType: string, count: number) => {
      try {
        await db.insert(gatekeeperDecisionLog).values({
          decisionId: randomUUID(),
          source: "bulk",
          operation: "bulk_update",
          entityType: entityType as "contact" | "company" | "deal",
          confidence: "100",
          zone: "auto_apply",
          analysis: { action, count },
          modelUsed: "none",
          tokensUsed: 0,
          latencyMs: 0,
          userId: user.id,
        });
      } catch { /* non-critical */ }
    };

    if (body.action === "reassign_contacts" && body.contactIds && body.newOwnerId) {
      await db
        .update(contacts)
        .set({ ownerId: body.newOwnerId, updatedAt: new Date() })
        .where(inArray(contacts.id, body.contactIds));

      await logAuditEvent(user.id, {
        action: "bulk_reassign",
        entityType: "contact",
        entityId: "bulk",
        metadata: {
          contactIds: body.contactIds,
          newOwnerId: body.newOwnerId,
          count: body.contactIds.length,
        },
      });
      await logBulkDecision("reassign_contacts", "contact", body.contactIds.length);

      return NextResponse.json({ success: true, count: body.contactIds.length });
    }

    if (body.action === "bulk_stage_change" && body.dealIds && body.stageId) {
      await db
        .update(deals)
        .set({ stageId: body.stageId, updatedAt: new Date() })
        .where(inArray(deals.id, body.dealIds));

      await logAuditEvent(user.id, {
        action: "bulk_stage_change",
        entityType: "deal",
        entityId: "bulk",
        metadata: {
          dealIds: body.dealIds,
          stageId: body.stageId,
          count: body.dealIds.length,
        },
      });
      await logBulkDecision("bulk_stage_change", "deal", body.dealIds.length);

      return NextResponse.json({ success: true, count: body.dealIds.length });
    }

    // Bulk change status for contacts
    if (body.action === "change_status_contacts") {
      const ids = validateIds(body.contactIds, "contactIds");
      if (ids instanceof NextResponse) return ids;
      if (!body.status || !VALID_CONTACT_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      await db
        .update(contacts)
        .set({
          status: body.status as (typeof contacts.status.enumValues)[number],
          updatedAt: new Date(),
        })
        .where(inArray(contacts.id, ids));

      await logAuditEvent(user.id, {
        action: "bulk_status_change",
        entityType: "contact",
        entityId: "bulk",
        metadata: { contactIds: ids, status: body.status, count: ids.length },
      });

      return NextResponse.json({ success: true, count: ids.length });
    }

    // Bulk add tag to contacts
    if (body.action === "add_tag_contacts") {
      const ids = validateIds(body.contactIds, "contactIds");
      if (ids instanceof NextResponse) return ids;
      if (!body.tagId) {
        return NextResponse.json({ error: "tagId is required" }, { status: 400 });
      }
      const rows = ids.map((contactId) => ({ contactId, tagId: body.tagId as string }));
      await db.insert(contactTags).values(rows).onConflictDoNothing();

      await logAuditEvent(user.id, {
        action: "bulk_add_tag",
        entityType: "contact",
        entityId: "bulk",
        metadata: { contactIds: ids, tagId: body.tagId, count: ids.length },
      });

      return NextResponse.json({ success: true, count: ids.length });
    }

    // Bulk delete contacts
    if (body.action === "delete_contacts") {
      const ids = validateIds(body.contactIds, "contactIds");
      if (ids instanceof NextResponse) return ids;

      await db.delete(contacts).where(inArray(contacts.id, ids));

      await logAuditEvent(user.id, {
        action: "bulk_delete",
        entityType: "contact",
        entityId: "bulk",
        metadata: { contactIds: ids, count: ids.length },
      });

      return NextResponse.json({ success: true, count: ids.length });
    }

    // Bulk add tag to deals
    if (body.action === "add_tag_deals") {
      const ids = validateIds(body.dealIds, "dealIds");
      if (ids instanceof NextResponse) return ids;
      if (!body.tagId) {
        return NextResponse.json({ error: "tagId is required" }, { status: 400 });
      }
      const rows = ids.map((dealId) => ({ dealId, tagId: body.tagId as string }));
      await db.insert(dealTags).values(rows).onConflictDoNothing();

      await logAuditEvent(user.id, {
        action: "bulk_add_tag",
        entityType: "deal",
        entityId: "bulk",
        metadata: { dealIds: ids, tagId: body.tagId, count: ids.length },
      });

      return NextResponse.json({ success: true, count: ids.length });
    }

    // Bulk delete deals
    if (body.action === "delete_deals") {
      const ids = validateIds(body.dealIds, "dealIds");
      if (ids instanceof NextResponse) return ids;

      await db.delete(deals).where(inArray(deals.id, ids));

      await logAuditEvent(user.id, {
        action: "bulk_delete",
        entityType: "deal",
        entityId: "bulk",
        metadata: { dealIds: ids, count: ids.length },
      });

      return NextResponse.json({ success: true, count: ids.length });
    }

    // Bulk reassign companies
    if (body.action === "reassign_companies" && body.companyIds && body.newOwnerId) {
      const ids = validateIds(body.companyIds, "companyIds");
      if (ids instanceof NextResponse) return ids;

      await db
        .update(companies)
        .set({ ownerId: body.newOwnerId, updatedAt: new Date() })
        .where(inArray(companies.id, ids));

      await logAuditEvent(user.id, {
        action: "bulk_reassign",
        entityType: "company",
        entityId: "bulk",
        metadata: { companyIds: ids, newOwnerId: body.newOwnerId, count: ids.length },
      });
      await logBulkDecision("reassign_companies", "company", ids.length);

      return NextResponse.json({ success: true, count: ids.length });
    }

    // Bulk delete companies
    if (body.action === "delete_companies") {
      const ids = validateIds(body.companyIds, "companyIds");
      if (ids instanceof NextResponse) return ids;

      await db.delete(companies).where(inArray(companies.id, ids));

      await logAuditEvent(user.id, {
        action: "bulk_delete",
        entityType: "company",
        entityId: "bulk",
        metadata: { companyIds: ids, count: ids.length },
      });
      await logBulkDecision("delete_companies", "company", ids.length);

      return NextResponse.json({ success: true, count: ids.length });
    }

    // Bulk reassign deals
    if (body.action === "reassign_deals" && body.dealIds && body.newOwnerId) {
      const ids = validateIds(body.dealIds, "dealIds");
      if (ids instanceof NextResponse) return ids;

      await db
        .update(deals)
        .set({ ownerId: body.newOwnerId, updatedAt: new Date() })
        .where(inArray(deals.id, ids));

      await logAuditEvent(user.id, {
        action: "bulk_reassign",
        entityType: "deal",
        entityId: "bulk",
        metadata: { dealIds: ids, newOwnerId: body.newOwnerId, count: ids.length },
      });
      await logBulkDecision("reassign_deals", "deal", ids.length);

      return NextResponse.json({ success: true, count: ids.length });
    }

    // Bulk link contacts to a company
    if (body.action === "link_contacts_company" && body.contactIds && body.companyId) {
      const ids = validateIds(body.contactIds, "contactIds");
      if (ids instanceof NextResponse) return ids;

      const rows = ids.map((contactId) => ({ contactId, companyId: body.companyId as string, isPrimary: false }));
      await db.insert(contactCompanies).values(rows).onConflictDoNothing();

      await logAuditEvent(user.id, {
        action: "bulk_link_company",
        entityType: "contact",
        entityId: "bulk",
        metadata: { contactIds: ids, companyId: body.companyId, count: ids.length },
      });

      return NextResponse.json({ success: true, count: ids.length });
    }

    // Round robin: distribute entities evenly across users
    if (body.action === "round_robin" && body.entityIds && body.userIds && body.entityType) {
      const entityIds = validateIds(body.entityIds, "entityIds");
      if (entityIds instanceof NextResponse) return entityIds;
      const userIds = body.userIds as string[];
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return NextResponse.json({ error: "userIds must be a non-empty array" }, { status: 400 });
      }

      const table = body.entityType === "contact" ? contacts : body.entityType === "company" ? companies : deals;

      // Assign round-robin
      for (let i = 0; i < entityIds.length; i++) {
        const assignedUserId = userIds[i % userIds.length];
        await db
          .update(table)
          .set({ ownerId: assignedUserId, updatedAt: new Date() })
          .where(inArray(table.id, [entityIds[i]]));
      }

      await logAuditEvent(user.id, {
        action: "round_robin",
        entityType: body.entityType,
        entityId: "bulk",
        metadata: { entityIds, userIds, count: entityIds.length },
      });
      await logBulkDecision("round_robin", body.entityType, entityIds.length);

      return NextResponse.json({ success: true, count: entityIds.length });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PATCH /api/bulk error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// CSV export contacts
export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType") || "contact";

    if (entityType === "contact") {
      const rows = await db
        .select({
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          email: contacts.email,
          phone: contacts.phone,
          type: contacts.type,
          status: contacts.status,
          tier: contacts.tier,
          whopUsername: contacts.whopUsername,
          currentGmv: contacts.currentGmv,
          currentMrr: contacts.currentMrr,
          memberCount: contacts.memberCount,
          healthScore: contacts.healthScore,
          linkedinUrl: contacts.linkedinUrl,
          source: contacts.source,
        })
        .from(contacts);

      const headers = Object.keys(rows[0] || {});
      const csvLines = [
        headers.join(","),
        ...rows.map((row) =>
          headers
            .map((h) => {
              const val = (row as Record<string, unknown>)[h];
              if (val === null || val === undefined) return "";
              const str = String(val);
              return str.includes(",") ? `"${str}"` : str;
            })
            .join(",")
        ),
      ];

      return new NextResponse(csvLines.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename=contacts-export-${new Date().toISOString().slice(0, 10)}.csv`,
        },
      });
    }

    return NextResponse.json({ error: "Unsupported entity type" }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

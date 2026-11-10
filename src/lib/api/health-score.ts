import { db } from "@/lib/db";
import { contacts, activities, deals, pipelineStages } from "@/lib/db/schema";
import { eq, and, gte, desc, count } from "drizzle-orm";

/**
 * Calculate and update a contact's health score based on:
 * - Activity recency (40 weight): Days since last activity
 * - Activity frequency (30 weight): Number of activities in last 30 days
 * - Deal velocity (30 weight): Active/won deals status
 *
 * If the score changes by >= 15 points, a health_score_change activity is created.
 */
export async function calculateHealthScore(contactId: string): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Get contact's current score
  const [contact] = await db
    .select({ healthScore: contacts.healthScore })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);

  if (!contact) return 0;
  const oldScore = contact.healthScore ?? 50;

  // 1. Activity recency (40 weight)
  // 0 days = 40pts, 30+ days = 0pts (linear interpolation)
  const [latestActivity] = await db
    .select({ createdAt: activities.createdAt })
    .from(activities)
    .where(eq(activities.contactId, contactId))
    .orderBy(desc(activities.createdAt))
    .limit(1);

  let recencyScore = 0;
  if (latestActivity) {
    const daysSince = Math.floor(
      (Date.now() - new Date(latestActivity.createdAt).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    recencyScore = Math.max(0, Math.round(40 * (1 - daysSince / 30)));
  }

  // 2. Activity frequency (30 weight)
  // 10+ = 30pts, 5-9 = 20pts, 1-4 = 10pts, 0 = 0pts
  const [activityCount] = await db
    .select({ count: count() })
    .from(activities)
    .where(
      and(
        eq(activities.contactId, contactId),
        gte(activities.createdAt, thirtyDaysAgo)
      )
    );

  const actCount = activityCount?.count ?? 0;
  let frequencyScore = 0;
  if (actCount >= 10) frequencyScore = 30;
  else if (actCount >= 5) frequencyScore = 20;
  else if (actCount >= 1) frequencyScore = 10;

  // 3. Deal velocity (30 weight)
  // Won deals in last 90 days = 30pts, active deals = 20pts, stale only = 5pts, none = 0pts
  const contactDeals = await db
    .select({
      id: deals.id,
      updatedAt: deals.updatedAt,
      closedAt: deals.closedAt,
      isWon: pipelineStages.isWon,
      isLost: pipelineStages.isLost,
    })
    .from(deals)
    .innerJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
    .where(eq(deals.contactId, contactId));

  let velocityScore = 0;
  const hasRecentWon = contactDeals.some(
    (d) =>
      d.isWon && d.closedAt && new Date(d.closedAt) >= ninetyDaysAgo
  );
  const hasActive = contactDeals.some((d) => !d.isWon && !d.isLost);

  if (hasRecentWon) velocityScore = 30;
  else if (hasActive) velocityScore = 20;
  else if (contactDeals.length > 0) velocityScore = 5;

  const newScore = Math.min(100, recencyScore + frequencyScore + velocityScore);

  // Update contact
  await db
    .update(contacts)
    .set({
      healthScore: newScore,
      lastActiveAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(contacts.id, contactId));

  // If significant change (>= 15 points), create activity
  if (Math.abs(newScore - oldScore) >= 15) {
    await db.insert(activities).values({
      contactId,
      type: "health_score_change",
      subject: `Health score ${newScore > oldScore ? "increased" : "decreased"}: ${oldScore} -> ${newScore}`,
      body: `Automated health score recalculation. Previous: ${oldScore}, New: ${newScore}. Recency: ${recencyScore}/40, Frequency: ${frequencyScore}/30, Velocity: ${velocityScore}/30.`,
    });
  }

  return newScore;
}

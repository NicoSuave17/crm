"use client";

import { useActivities } from "@/lib/hooks/use-activities";
import { useCurrentUser } from "@/lib/hooks/use-users";
import { ActivityItem } from "./activity-item";
import { ActivityForm } from "./activity-form";
import { Skeleton } from "@/components/ui/skeleton";
import type { TemplateContext } from "@/lib/utils/template-interpolation";

interface ActivityTimelineProps {
  contactId?: string;
  dealId?: string;
  companyId?: string;
  templateContext?: TemplateContext;
}

export function ActivityTimeline({ contactId, dealId, companyId, templateContext }: ActivityTimelineProps) {
  const { data: currentUser } = useCurrentUser();
  const { data: activities, isLoading } = useActivities(
    dealId ? { dealId } : companyId ? { companyId } : { contactId: contactId! }
  );

  return (
    <div className="space-y-4">
      <ActivityForm contactId={contactId} dealId={dealId} companyId={companyId} templateContext={templateContext} />

      <div className="border-t pt-4">
        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && activities?.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No activities yet. Log a note or call above.
          </p>
        )}

        {activities?.map(
          (activity: {
            id: string;
            type: string;
            subject: string | null;
            body: string | null;
            userId: string | null;
            userFirstName: string | null;
            userLastName: string | null;
            userAvatarUrl: string | null;
            occurredAt: string;
            duration: number | null;
            metadata: Record<string, unknown> | null;
            nextFollowUpDate: string | null;
          }) => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              currentUserId={currentUser?.id}
            />
          )
        )}
      </div>
    </div>
  );
}

"use client";

import { useActivities } from "@/lib/hooks/use-activities";
import { ActivityItem } from "./activity-item";
import { ActivityForm } from "./activity-form";
import { Skeleton } from "@/components/ui/skeleton";

interface ActivityTimelineProps {
  contactId?: string;
  dealId?: string;
}

export function ActivityTimeline({ contactId, dealId }: ActivityTimelineProps) {
  const { data: activities, isLoading } = useActivities(
    dealId ? { dealId } : { contactId: contactId! }
  );

  return (
    <div className="space-y-4">
      <ActivityForm contactId={contactId} dealId={dealId} />

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
            userFirstName: string | null;
            userLastName: string | null;
            userAvatarUrl: string | null;
            occurredAt: string;
            duration: number | null;
          }) => (
            <ActivityItem key={activity.id} activity={activity} />
          )
        )}
      </div>
    </div>
  );
}

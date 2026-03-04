"use client";

import { use, useState } from "react";
import { useDeal } from "@/lib/hooks/use-deals";
import { EditDealDialog } from "@/components/deals/edit-deal-dialog";
import { formatCurrency } from "@/lib/utils/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  Pencil,
  TrendingUp,
  User,
} from "lucide-react";
import Link from "next/link";

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

function getInitials(firstName: string | null, lastName: string | null): string {
  const first = firstName?.[0] ?? "";
  const last = lastName?.[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

export default function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: deal, isLoading } = useDeal(id);
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="lg:col-span-3">
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-lg text-muted-foreground">Deal not found</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/deals">Back to Deals</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button + Edit */}
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/pipeline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Pipeline
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left column - Deal Profile */}
        <div className="lg:col-span-2 space-y-4">
          {/* Deal info card */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">{deal.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {deal.pipelineName}
                  </p>
                </div>

                {/* Stage badge */}
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    style={{
                      borderColor: deal.stageColor ?? undefined,
                      color: deal.stageColor ?? undefined,
                    }}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full mr-1.5"
                      style={{
                        backgroundColor: deal.stageColor ?? "#6B7280",
                      }}
                    />
                    {deal.stageName}
                  </Badge>
                  {deal.priority && (
                    <Badge
                      className={
                        priorityColors[deal.priority] ?? priorityColors.medium
                      }
                      variant="secondary"
                    >
                      {deal.priority}
                    </Badge>
                  )}
                </div>

                <Separator />

                {/* Financial info */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Value
                      </span>
                    </div>
                    <span className="font-medium">
                      {formatCurrency(deal.value)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Expected MRR
                      </span>
                    </div>
                    <span className="font-medium">
                      {formatCurrency(deal.expectedMrr)}
                    </span>
                  </div>
                  {deal.expectedCloseDate && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Expected Close
                        </span>
                      </div>
                      <span className="text-sm">
                        {new Date(deal.expectedCloseDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {deal.stageProbability !== null &&
                    deal.stageProbability !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Probability
                        </span>
                        <span className="text-sm font-medium">
                          {deal.stageProbability}%
                        </span>
                      </div>
                    )}
                </div>

                {/* Description */}
                {deal.description && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Description
                      </p>
                      <p className="text-sm whitespace-pre-wrap">
                        {deal.description}
                      </p>
                    </div>
                  </>
                )}

                {/* Lost Reason */}
                {deal.stageIsLost && deal.lostReason && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Lost Reason
                      </p>
                      <p className="text-sm whitespace-pre-wrap text-destructive">
                        {deal.lostReason}
                      </p>
                    </div>
                  </>
                )}

                {/* Owner */}
                {deal.ownerFirstName && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Owner
                      </p>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage
                            src={deal.ownerAvatarUrl ?? undefined}
                          />
                          <AvatarFallback className="text-xs">
                            {getInitials(
                              deal.ownerFirstName,
                              deal.ownerLastName
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">
                          {deal.ownerFirstName} {deal.ownerLastName ?? ""}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contact card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Contact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href={`/contacts/${deal.contactId}`}
                className="flex items-center gap-3 hover:bg-muted/50 rounded-md p-2 -m-2 transition-colors"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={deal.contactAvatarUrl ?? undefined}
                  />
                  <AvatarFallback className="text-xs">
                    {getInitials(
                      deal.contactFirstName,
                      deal.contactLastName
                    )}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">
                    {deal.contactFirstName} {deal.contactLastName ?? ""}
                  </p>
                  {deal.contactEmail && (
                    <p className="text-xs text-muted-foreground">
                      {deal.contactEmail}
                    </p>
                  )}
                </div>
              </Link>
            </CardContent>
          </Card>

          {/* Company card */}
          {deal.companyId && deal.companyName && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Company
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/companies/${deal.companyId}`}
                  className="flex items-center gap-3 hover:bg-muted/50 rounded-md p-2 -m-2 transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{deal.companyName}</p>
                    {deal.companyDomain && (
                      <p className="text-xs text-muted-foreground">
                        {deal.companyDomain}
                      </p>
                    )}
                  </div>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column - Tabs */}
        <div className="lg:col-span-3">
          <Tabs defaultValue="timeline">
            <TabsList>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="stage-history">Stage History</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Activity Timeline</CardTitle>
                  <CardDescription>
                    All activities related to this deal
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Timeline will be populated in a future update.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stage-history" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Stage History</CardTitle>
                  <CardDescription>
                    Track how this deal has moved through stages
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Stage history will be populated in a future update.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <EditDealDialog
        deal={deal}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}

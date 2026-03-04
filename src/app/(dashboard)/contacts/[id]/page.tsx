"use client";

import { use, useState } from "react";
import { useContact } from "@/lib/hooks/use-contacts";
import { useContactCompanies, useUnlinkCompany } from "@/lib/hooks/use-contact-companies";
import { ActivityTimeline } from "@/components/activities/activity-timeline";
import { ContactDealsTab } from "@/components/contacts/contact-deals-tab";
import { ContactTasksTab } from "@/components/contacts/contact-tasks-tab";
import { EditContactDialog } from "@/components/contacts/edit-contact-dialog";
import { LinkCompanyDialog } from "@/components/contacts/link-company-dialog";
import { HealthScoreBadge } from "@/components/contacts/health-score-badge";
import { TagSelector } from "@/components/contacts/tag-selector";
import { CustomFieldsDisplay } from "@/components/contacts/custom-fields-display";
import { formatCurrency, formatNumber, getInitials } from "@/lib/utils/format";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Globe,
  Linkedin,
  Users,
  DollarSign,
  TrendingUp,
  ExternalLink,
  Pencil,
  X,
} from "lucide-react";
import Link from "next/link";

export default function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: contact, isLoading } = useContact(id);
  const { data: linkedCompanies } = useContactCompanies(id);
  const unlinkCompany = useUnlinkCompany();
  const [editOpen, setEditOpen] = useState(false);
  const [linkCompanyOpen, setLinkCompanyOpen] = useState(false);

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

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-lg text-muted-foreground">Contact not found</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/contacts">Back to Contacts</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button + Edit */}
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/contacts">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Contacts
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left column - Profile */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-20 w-20 mb-4">
                  <AvatarImage src={contact.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-xl">
                    {getInitials(contact.firstName, contact.lastName)}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-xl font-semibold">
                  {contact.firstName} {contact.lastName}
                </h2>
                {contact.whopUsername && (
                  <p className="text-sm text-muted-foreground">
                    @{contact.whopUsername}
                  </p>
                )}
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">{contact.type.replace("_", " ")}</Badge>
                  <Badge
                    variant={
                      contact.status === "active"
                        ? "default"
                        : contact.status === "at_risk"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {contact.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Contact info */}
              <div className="space-y-3">
                {contact.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${contact.email}`} className="hover:underline">
                      {contact.email}
                    </a>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{contact.phone}</span>
                  </div>
                )}
                {contact.linkedinUrl && (
                  <div className="flex items-center gap-3 text-sm">
                    <Linkedin className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={contact.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline flex items-center gap-1"
                    >
                      LinkedIn <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {contact.websiteUrl && (
                  <div className="flex items-center gap-3 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={contact.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline flex items-center gap-1"
                    >
                      Website <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* Owner */}
              {contact.owner && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Assigned to
                    </p>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={contact.owner.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(
                            contact.owner.firstName,
                            contact.owner.lastName
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">
                        {contact.owner.firstName} {contact.owner.lastName}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Tags */}
              <Separator className="my-4" />
              <TagSelector
                contactId={id}
                currentTags={contact.tags ?? []}
              />

              {/* Companies */}
              <Separator className="my-4" />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground font-medium">
                    Companies
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setLinkCompanyOpen(true)}
                  >
                    Link
                  </Button>
                </div>
                {linkedCompanies && linkedCompanies.length > 0 ? (
                  <div className="space-y-2">
                    {linkedCompanies.map((lc) => (
                      <div
                        key={lc.companyId}
                        className="flex items-center justify-between group"
                      >
                        <Link
                          href={`/companies/${lc.companyId}`}
                          className="flex items-center gap-2 text-sm hover:underline min-w-0 flex-1"
                        >
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="truncate font-medium">{lc.name}</span>
                          {lc.role && (
                            <span className="text-xs text-muted-foreground truncate">
                              ({lc.role})
                            </span>
                          )}
                        </Link>
                        {lc.domain && (
                          <span className="text-xs text-muted-foreground mr-1 hidden sm:inline truncate max-w-[80px]">
                            {lc.domain}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 shrink-0"
                          onClick={() => {
                            if (
                              confirm(
                                `Unlink ${lc.name} from this contact?`
                              )
                            ) {
                              unlinkCompany.mutate({
                                contactId: id,
                                companyId: lc.companyId,
                              });
                            }
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No companies linked.
                  </p>
                )}
              </div>

              {/* Custom Fields */}
              <Separator className="my-4" />
              <CustomFieldsDisplay entityId={id} />
            </CardContent>
          </Card>

          {/* Health & Metrics Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Health & Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Health Score
                </span>
                <HealthScoreBadge score={contact.healthScore} size="md" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Current GMV
                  </span>
                </div>
                <span className="font-medium">
                  {formatCurrency(contact.currentGmv)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Current MRR
                  </span>
                </div>
                <span className="font-medium">
                  {formatCurrency(contact.currentMrr)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Lifetime GMV
                  </span>
                </div>
                <span className="font-medium">
                  {formatCurrency(contact.lifetimeGmv)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Members</span>
                </div>
                <span className="font-medium">
                  {formatNumber(contact.memberCount)}
                </span>
              </div>
              {contact.churnRisk && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Churn Risk
                  </span>
                  <Badge
                    variant={
                      contact.churnRisk === "critical" ||
                      contact.churnRisk === "high"
                        ? "destructive"
                        : contact.churnRisk === "medium"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {contact.churnRisk}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column - Tabs */}
        <div className="lg:col-span-3">
          <Tabs defaultValue="timeline">
            <TabsList>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="deals">Deals</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Activity Timeline</CardTitle>
                  <CardDescription>
                    All interactions with this contact
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ActivityTimeline contactId={id} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="deals" className="mt-4">
              <ContactDealsTab contactId={id} />
            </TabsContent>

            <TabsContent value="tasks" className="mt-4">
              <ContactTasksTab contactId={id} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <EditContactDialog
        contact={contact}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <LinkCompanyDialog
        contactId={id}
        open={linkCompanyOpen}
        onOpenChange={setLinkCompanyOpen}
      />
    </div>
  );
}

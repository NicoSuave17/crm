"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useCompany, useDeleteCompany } from "@/lib/hooks/use-companies";
import { ActivityTimeline } from "@/components/activities/activity-timeline";
import { CompanyDealsTab } from "@/components/companies/company-deals-tab";
import { EditCompanyDialog } from "@/components/companies/edit-company-dialog";
import { CustomFieldsDisplay } from "@/components/contacts/custom-fields-display";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Building2,
  Calendar,
  ExternalLink,
  Globe,
  Linkedin,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { format } from "date-fns";

function getOwnerInitials(firstName: string, lastName: string): string {
  return ((firstName?.[0] ?? "") + (lastName?.[0] ?? "")).toUpperCase() || "?";
}

export default function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: company, isLoading } = useCompany(id);
  const deleteCompany = useDeleteCompany();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function handleDelete() {
    deleteCompany.mutate(id, {
      onSuccess: () => {
        toast.success("Company deleted");
        router.push("/companies");
      },
      onError: () => toast.error("Failed to delete company"),
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="lg:col-span-3">
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-lg text-muted-foreground">Company not found</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/companies">Back to Companies</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/companies">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Companies
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left column - Profile */}
        <div className="lg:col-span-2 space-y-4">
          {/* Profile card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-4">
                  <Building2 className="h-10 w-10 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold">{company.name}</h2>
                {company.domain && (
                  <a
                    href={
                      company.domain.startsWith("http")
                        ? company.domain
                        : `https://${company.domain}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:underline flex items-center gap-1 mt-1"
                  >
                    {company.domain}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <div className="flex gap-2 mt-3">
                  {company.industry && (
                    <Badge variant="outline">{company.industry}</Badge>
                  )}
                  {company.size && (
                    <Badge variant="secondary">{company.size} employees</Badge>
                  )}
                </div>
              </div>

              {/* Description */}
              {company.description && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Description
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {company.description}
                    </p>
                  </div>
                </>
              )}

              <Separator className="my-4" />

              {/* Links */}
              <div className="space-y-3">
                {company.websiteUrl && (
                  <div className="flex items-center gap-3 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={company.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline flex items-center gap-1"
                    >
                      Website <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {company.linkedinUrl && (
                  <div className="flex items-center gap-3 text-sm">
                    <Linkedin className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={company.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline flex items-center gap-1"
                    >
                      LinkedIn <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {!company.websiteUrl && !company.linkedinUrl && (
                  <p className="text-sm text-muted-foreground">
                    No links added yet.
                  </p>
                )}
              </div>

              {/* Owner */}
              {company.owner && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Assigned to
                    </p>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage
                          src={company.owner.avatarUrl ?? undefined}
                        />
                        <AvatarFallback className="text-xs">
                          {getOwnerInitials(
                            company.owner.firstName,
                            company.owner.lastName
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">
                        {company.owner.firstName} {company.owner.lastName}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Custom Fields */}
              <Separator className="my-4" />
              <CustomFieldsDisplay entityId={id} />
            </CardContent>
          </Card>

          {/* Stats card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Related Entities
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Linked Contacts
                  </span>
                </div>
                <span className="font-medium">{company.contactCount ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Created</span>
                </div>
                <span className="text-sm">
                  {format(new Date(company.createdAt), "MMM d, yyyy")}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column - Tabs */}
        <div className="lg:col-span-3">
          <Tabs defaultValue="timeline">
            <TabsList>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="deals">Deals</TabsTrigger>
              <TabsTrigger value="contacts">Contacts</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Activity Timeline
                  </CardTitle>
                  <CardDescription>
                    All interactions for this company
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ActivityTimeline companyId={id} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="deals" className="mt-4">
              <CompanyDealsTab companyId={id} />
            </TabsContent>

            <TabsContent value="contacts" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Linked Contacts</CardTitle>
                  <CardDescription>
                    Contacts associated with this company
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Linked contacts will appear here once contact-company
                    linking is implemented.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Edit dialog */}
      <EditCompanyDialog
        company={company}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &ldquo;{company.name}&rdquo;? This will unlink all
              contacts and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteCompany.isPending}
            >
              {deleteCompany.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

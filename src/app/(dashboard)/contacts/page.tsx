"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useContacts, useDeleteContact } from "@/lib/hooks/use-contacts";
import { useRowSelection } from "@/lib/hooks/use-row-selection";
import { BulkActionBar } from "@/components/bulk/bulk-action-bar";
import { ContactsBulkActions } from "@/components/bulk/contacts-bulk-actions";
import { Checkbox } from "@/components/ui/checkbox";
import { ContactForm } from "@/components/contacts/contact-form";
import { EditContactDialog } from "@/components/contacts/edit-contact-dialog";
import { HealthScoreBadge } from "@/components/contacts/health-score-badge";
import { formatCurrency, getInitials } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Search,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Save,
  Bookmark,
  Pencil,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ImportWizardDialog } from "@/components/import/import-wizard-dialog";
import { useSavedViews, useCreateSavedView, useDeleteSavedView } from "@/lib/hooks/use-saved-views";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const typeLabels: Record<string, string> = {
  creator: "Creator",
  lead: "Lead",
  enterprise_prospect: "Enterprise",
  partner: "Partner",
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  prospect: "secondary",
  at_risk: "destructive",
  churned: "destructive",
  closed_lost: "outline",
};

export default function ContactsPage() {
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<{
    id: string;
    firstName: string;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    type: string;
    status: string;
    tier: string | null;
    ownerId: string | null;
    healthScore: number | null;
    whopUsername: string | null;
    twitterUrl: string | null;
    websiteUrl: string | null;
  } | null>(null);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const selection = useRowSelection();
  const prevFilterKey = useRef("");

  const { data, isLoading } = useContacts({
    page,
    search: search || undefined,
    type: typeFilter !== "all" ? typeFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const currentPageIds = data?.data?.map((c: { id: string }) => c.id) ?? [];

  // Clear selection when filters or page change
  const filterKey = `${search}|${typeFilter}|${statusFilter}|${page}`;
  useEffect(() => {
    if (prevFilterKey.current && prevFilterKey.current !== filterKey) {
      selection.clear();
    }
    prevFilterKey.current = filterKey;
  }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle ?create=true from command palette quick action
  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setCreateOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("create");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  const deleteContact = useDeleteContact();
  const { data: savedViews } = useSavedViews("contact");
  const createView = useCreateSavedView();
  const deleteView = useDeleteSavedView();

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    deleteContact.mutate(id, {
      onSuccess: () => toast.success(`${name} deleted`),
      onError: () => toast.error("Failed to delete contact"),
    });
  }

  async function handleEdit(contactId: string) {
    try {
      const res = await fetch(`/api/contacts/${contactId}`);
      if (!res.ok) throw new Error("Failed to fetch contact");
      const contact = await res.json();
      setEditingContact(contact);
    } catch {
      toast.error("Failed to load contact for editing");
    }
  }

  function handleSaveView(e: React.FormEvent) {
    e.preventDefault();
    if (!viewName.trim()) return;
    const filters: Record<string, unknown>[] = [];
    if (typeFilter !== "all") filters.push({ field: "type", value: typeFilter });
    if (statusFilter !== "all") filters.push({ field: "status", value: statusFilter });
    if (search) filters.push({ field: "search", value: search });

    createView.mutate(
      { name: viewName.trim(), entityType: "contact", filters },
      {
        onSuccess: () => {
          toast.success("View saved");
          setSaveViewOpen(false);
          setViewName("");
        },
      }
    );
  }

  function handleLoadView(view: { filters: Record<string, unknown>[] }) {
    setPage(1);
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    for (const f of view.filters) {
      if (f.field === "type") setTypeFilter(f.value as string);
      if (f.field === "status") setStatusFilter(f.value as string);
      if (f.field === "search") setSearch(f.value as string);
    }
  }

  function handleExportCsv() {
    window.open("/api/bulk?entityType=contact", "_blank");
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            Manage creators, leads, and enterprise prospects.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Saved Views */}
      {savedViews && savedViews.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto">
          <Bookmark className="h-4 w-4 text-muted-foreground shrink-0" />
          {savedViews.map((view: { id: string; name: string; filters: Record<string, unknown>[] }) => (
            <div key={view.id} className="flex items-center gap-0.5">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 rounded-r-none"
                onClick={() => handleLoadView(view)}
              >
                {view.name}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 px-1.5 rounded-l-none border-l-0"
                onClick={() => {
                  deleteView.mutate(view.id, {
                    onSuccess: () => toast.success("View deleted"),
                    onError: () => toast.error("Failed to delete view"),
                  });
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="creator">Creator</SelectItem>
            <SelectItem value="lead">Lead</SelectItem>
            <SelectItem value="enterprise_prospect">Enterprise</SelectItem>
            <SelectItem value="partner">Partner</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="prospect">Prospect</SelectItem>
            <SelectItem value="at_risk">At Risk</SelectItem>
            <SelectItem value="churned">Churned</SelectItem>
            <SelectItem value="closed_lost">Closed Lost</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSaveViewOpen(true)}
          title="Save current filters as a view"
        >
          <Save className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={
                    selection.isAllSelected(currentPageIds)
                      ? true
                      : selection.isSomeSelected(currentPageIds)
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={() => selection.toggleAll(currentPageIds)}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Health</TableHead>
              <TableHead>GMV</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="w-[40px]"><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell />
                </TableRow>
              ))}

            {!isLoading && data?.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  No contacts found. Create one to get started.
                </TableCell>
              </TableRow>
            )}

            {data?.data?.map(
              (contact: {
                id: string;
                firstName: string;
                lastName: string | null;
                email: string | null;
                avatarUrl: string | null;
                type: string;
                status: string;
                healthScore: number | null;
                currentGmv: string | null;
                ownerFirstName: string | null;
                ownerLastName: string | null;
              }) => (
                <TableRow key={contact.id} data-selected={selection.isSelected(contact.id) || undefined}>
                  <TableCell className="w-[40px]">
                    <Checkbox
                      checked={selection.isSelected(contact.id)}
                      onCheckedChange={() => selection.toggle(contact.id)}
                      aria-label={`Select ${contact.firstName}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="flex items-center gap-3 hover:underline"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={contact.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(contact.firstName, contact.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {contact.firstName} {contact.lastName}
                        </p>
                        {contact.email && (
                          <p className="text-xs text-muted-foreground">
                            {contact.email}
                          </p>
                        )}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {typeLabels[contact.type] ?? contact.type}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariants[contact.status] ?? "outline"}>
                      {contact.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <HealthScoreBadge score={contact.healthScore} />
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(contact.currentGmv)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {contact.ownerFirstName
                      ? `${contact.ownerFirstName} ${contact.ownerLastName ?? ""}`
                      : "Unassigned"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/contacts/${contact.id}`}>View</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(contact.id)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            handleDelete(
                              contact.id,
                              `${contact.firstName} ${contact.lastName ?? ""}`
                            )
                          }
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * 25 + 1}–
            {Math.min(page * 25, data.pagination.total)} of{" "}
            {data.pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {page} of {data.pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.pagination.totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {selection.count > 0 && (
        <BulkActionBar selectedCount={selection.count} onClear={selection.clear}>
          <ContactsBulkActions
            selectedIds={Array.from(selection.selectedIds)}
            onComplete={selection.clear}
          />
        </BulkActionBar>
      )}

      <ContactForm open={createOpen} onOpenChange={setCreateOpen} />

      {editingContact && (
        <EditContactDialog
          contact={editingContact}
          open={!!editingContact}
          onOpenChange={(open) => {
            if (!open) setEditingContact(null);
          }}
        />
      )}

      <ImportWizardDialog open={importOpen} onOpenChange={setImportOpen} />

      {/* Save View Dialog */}
      <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save View</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveView} className="space-y-4">
            <Input
              placeholder="View name"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              required
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSaveViewOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createView.isPending}>
                {createView.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

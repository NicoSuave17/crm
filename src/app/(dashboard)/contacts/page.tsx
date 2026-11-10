"use client";

import { Suspense, useState, useEffect, useRef } from "react";
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
import { OwnerFilter, resolveOwnerFilter, type OwnerFilterValue } from "@/components/filters/owner-filter";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { CompanyPicker } from "@/components/pickers/company-picker";
import { VERTICALS, VERTICAL_COLORS } from "@/lib/constants/verticals";
import { useSavedViews, useCreateSavedView, useDeleteSavedView } from "@/lib/hooks/use-saved-views";
import { useVisibleCustomFields, useCustomFieldValues } from "@/lib/hooks/use-custom-field-columns";
import { useFieldLabels } from "@/lib/hooks/use-field-labels";
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

export default function ContactsPageWrapper() {
  return (
    <Suspense>
      <ContactsPage />
    </Suspense>
  );
}

const ALL_CONTACT_COLUMNS = [
  "type", "status", "health", "gmv", "company", "phone",
  "tier", "vertical", "mrr", "owner", "createdAt",
];

function ContactsPage() {
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
    vertical: string | null;
    twitterUrl: string | null;
    websiteUrl: string | null;
    linkedinUrl: string | null;
    title: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    source: string | null;
    sourceDetails: string | null;
  } | null>(null);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<string[] | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [verticalFilter, setVerticalFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectAllLoading, setSelectAllLoading] = useState(false);

  const { user: currentUser, isAdminOrManager } = useCurrentUser();
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilterValue>("all");
  // Default non-admins to "my" once user loads
  const ownerFilterInitialized = useRef(false);
  useEffect(() => {
    if (currentUser && !ownerFilterInitialized.current) {
      ownerFilterInitialized.current = true;
      if (!isAdminOrManager) {
        setOwnerFilter("my");
      }
    }
  }, [currentUser, isAdminOrManager]);

  const selection = useRowSelection();
  const prevFilterKey = useRef("");

  const resolvedOwnerId = resolveOwnerFilter(ownerFilter, currentUser?.id);

  const { data, isLoading } = useContacts({
    page,
    limit: pageSize,
    search: search || undefined,
    type: typeFilter !== "all" ? typeFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    vertical: verticalFilter !== "all" ? verticalFilter : undefined,
    ownerId: resolvedOwnerId,
    companyId: companyFilter || undefined,
  });

  const currentPageIds = data?.data?.map((c: { id: string }) => c.id) ?? [];

  const { data: customFieldDefs } = useVisibleCustomFields("contact");
  const { data: customFieldVals } = useCustomFieldValues("contact", currentPageIds);
  const { getLabel } = useFieldLabels();

  const colVisible = (key: string) => !visibleColumns || visibleColumns.includes(key);

  // Clear selection when filters or page change
  const filterKey = `${search}|${typeFilter}|${statusFilter}|${verticalFilter}|${ownerFilter}|${companyFilter}|${page}|${pageSize}`;
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
    if (verticalFilter !== "all") filters.push({ field: "vertical", value: verticalFilter });
    if (search) filters.push({ field: "search", value: search });

    // Compute hidden columns so new columns added later show by default
    const hiddenCols = visibleColumns
      ? ALL_CONTACT_COLUMNS.filter((c) => !visibleColumns.includes(c))
      : [];
    if (hiddenCols.length > 0) {
      filters.push({ field: "__hiddenColumns", value: hiddenCols });
    }

    createView.mutate(
      { name: viewName.trim(), entityType: "contact", filters, columns: visibleColumns ?? undefined },
      {
        onSuccess: () => {
          toast.success("View saved");
          setSaveViewOpen(false);
          setViewName("");
        },
      }
    );
  }

  function handleLoadView(view: { filters: Record<string, unknown>[]; columns?: string[] }) {
    setPage(1);
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    setVerticalFilter("all");

    // Check for hiddenColumns convention (new views) vs columns (legacy views)
    const hiddenColsFilter = view.filters.find((f) => f.field === "__hiddenColumns");
    if (hiddenColsFilter && Array.isArray(hiddenColsFilter.value)) {
      const hidden = new Set(hiddenColsFilter.value as string[]);
      setVisibleColumns(ALL_CONTACT_COLUMNS.filter((c) => !hidden.has(c)));
    } else {
      setVisibleColumns(view.columns?.length ? view.columns : null);
    }

    for (const f of view.filters) {
      if (f.field === "type") setTypeFilter(f.value as string);
      if (f.field === "status") setStatusFilter(f.value as string);
      if (f.field === "vertical") setVerticalFilter(f.value as string);
      if (f.field === "search") setSearch(f.value as string);
    }
  }

  const totalMatching = data?.pagination?.total ?? 0;
  const allCurrentPageSelected = currentPageIds.length > 0 && selection.isAllSelected(currentPageIds);
  const hasMoreThanPage = totalMatching > currentPageIds.length;
  const showSelectAllBanner = allCurrentPageSelected && hasMoreThanPage && selection.count === currentPageIds.length;

  async function handleSelectAllMatching() {
    setSelectAllLoading(true);
    try {
      const params = new URLSearchParams({ idsOnly: "true" });
      if (search) params.set("search", search);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (verticalFilter !== "all") params.set("vertical", verticalFilter);
      if (resolvedOwnerId) params.set("ownerId", resolvedOwnerId);
      if (companyFilter) params.set("companyId", companyFilter);
      const res = await fetch(`/api/contacts?${params}`);
      if (res.ok) {
        const { ids } = await res.json();
        selection.selectMany(ids);
      }
    } catch {
      toast.error("Failed to select all matching");
    } finally {
      setSelectAllLoading(false);
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
        <Select
          value={verticalFilter}
          onValueChange={(v) => {
            setVerticalFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Vertical" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Verticals</SelectItem>
            {VERTICALS.map((v) => (
              <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="w-[200px]">
          <CompanyPicker
            value={companyFilter}
            onChange={(v) => {
              setCompanyFilter(v);
              setPage(1);
            }}
            placeholder="All Companies"
            className="h-9"
          />
        </div>
        <OwnerFilter
          value={ownerFilter}
          onChange={(v) => {
            setOwnerFilter(v);
            setPage(1);
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSaveViewOpen(true)}
          title="Save current filters as a view"
        >
          <Save className="h-4 w-4" />
        </Button>
        {visibleColumns && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVisibleColumns(null)}
            title="Reset columns to default"
          >
            <X className="mr-1 h-3 w-3" />
            Reset columns
          </Button>
        )}
      </div>

      {/* Select All Banner */}
      {showSelectAllBanner && (
        <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 px-4 py-2 text-sm text-center">
          All {currentPageIds.length} contacts on this page are selected.{" "}
          <button
            className="text-blue-600 dark:text-blue-400 font-medium hover:underline disabled:opacity-50"
            onClick={handleSelectAllMatching}
            disabled={selectAllLoading}
          >
            {selectAllLoading
              ? "Loading..."
              : `Select all ${totalMatching > 500 ? "500" : totalMatching} matching contacts`}
          </button>
        </div>
      )}

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
              <TableHead>{getLabel("name", "Name")}</TableHead>
              {colVisible("type") && <TableHead>{getLabel("type", "Type")}</TableHead>}
              {colVisible("status") && <TableHead>{getLabel("status", "Status")}</TableHead>}
              {colVisible("health") && <TableHead>{getLabel("healthScore", "Health")}</TableHead>}
              {colVisible("gmv") && <TableHead>{getLabel("currentGmv", "GMV")}</TableHead>}
              {colVisible("company") && <TableHead>Company</TableHead>}
              {colVisible("phone") && <TableHead>{getLabel("phone", "Phone")}</TableHead>}
              {colVisible("tier") && <TableHead>{getLabel("tier", "Tier")}</TableHead>}
              {colVisible("vertical") && <TableHead>Vertical</TableHead>}
              {colVisible("mrr") && <TableHead>{getLabel("currentMrr", "MRR")}</TableHead>}
              {colVisible("owner") && <TableHead>{getLabel("owner", "Owner")}</TableHead>}
              {colVisible("createdAt") && <TableHead>Created</TableHead>}
              {customFieldDefs?.map((cf) => (
                <TableHead key={cf.id}>{cf.label}</TableHead>
              ))}
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
                crmId: string;
                firstName: string;
                lastName: string | null;
                email: string | null;
                phone: string | null;
                avatarUrl: string | null;
                type: string;
                status: string;
                tier: string | null;
                vertical: string | null;
                healthScore: number | null;
                currentGmv: string | null;
                currentMrr: string | null;
                ownerFirstName: string | null;
                ownerLastName: string | null;
                companyId: string | null;
                companyName: string | null;
                createdAt: string;
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
                          <span className="ml-2 text-[10px] font-normal text-muted-foreground">{contact.crmId}</span>
                        </p>
                        {contact.email && (
                          <p className="text-xs text-muted-foreground">
                            {contact.email}
                          </p>
                        )}
                      </div>
                    </Link>
                  </TableCell>
                  {colVisible("type") && (
                    <TableCell>
                      <span className="text-sm">
                        {typeLabels[contact.type] ?? contact.type}
                      </span>
                    </TableCell>
                  )}
                  {colVisible("status") && (
                    <TableCell>
                      <Badge variant={statusVariants[contact.status] ?? "outline"}>
                        {contact.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                  )}
                  {colVisible("health") && (
                    <TableCell>
                      <HealthScoreBadge score={contact.healthScore} />
                    </TableCell>
                  )}
                  {colVisible("gmv") && (
                    <TableCell className="font-medium">
                      {formatCurrency(contact.currentGmv)}
                    </TableCell>
                  )}
                  {colVisible("company") && (
                    <TableCell className="text-sm">
                      {contact.companyId ? (
                        <Link href={`/companies/${contact.companyId}`} className="hover:underline">
                          {contact.companyName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                  )}
                  {colVisible("phone") && (
                    <TableCell className="text-sm text-muted-foreground">
                      {contact.phone || "--"}
                    </TableCell>
                  )}
                  {colVisible("tier") && (
                    <TableCell className="text-sm">
                      {contact.tier ? <Badge variant="outline">{contact.tier}</Badge> : <span className="text-muted-foreground">--</span>}
                    </TableCell>
                  )}
                  {colVisible("vertical") && (
                    <TableCell className="text-sm text-muted-foreground">
                      {contact.vertical ? (VERTICALS.find(v => v.value === contact.vertical)?.label ?? contact.vertical) : "--"}
                    </TableCell>
                  )}
                  {colVisible("mrr") && (
                    <TableCell className="text-sm font-medium">
                      {formatCurrency(contact.currentMrr)}
                    </TableCell>
                  )}
                  {colVisible("owner") && (
                    <TableCell className="text-sm text-muted-foreground">
                      {contact.ownerFirstName
                        ? `${contact.ownerFirstName} ${contact.ownerLastName ?? ""}`
                        : "Unassigned"}
                    </TableCell>
                  )}
                  {colVisible("createdAt") && (
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(contact.createdAt).toLocaleDateString()}
                    </TableCell>
                  )}
                  {customFieldDefs?.map((cf) => (
                    <TableCell key={cf.id} className="text-sm">
                      {customFieldVals?.[contact.id]?.[cf.name] ?? ""}
                    </TableCell>
                  ))}
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
      {data?.pagination && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, data.pagination.total)} of{" "}
              {data.pagination.total}
            </p>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 / page</SelectItem>
                <SelectItem value="50">50 / page</SelectItem>
                <SelectItem value="100">100 / page</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {data.pagination.totalPages > 1 && (
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
          )}
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

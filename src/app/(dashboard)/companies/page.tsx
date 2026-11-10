"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useCompanies, useDeleteCompany } from "@/lib/hooks/use-companies";
import { useSavedViews, useCreateSavedView, useDeleteSavedView } from "@/lib/hooks/use-saved-views";
import { CompanyForm } from "@/components/companies/company-form";
import { EditCompanyDialog } from "@/components/companies/edit-company-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Search,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Building2,
  Save,
  Bookmark,
  X,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useRowSelection } from "@/lib/hooks/use-row-selection";
import { BulkActionBar } from "@/components/bulk/bulk-action-bar";
import { CompaniesBulkActions } from "@/components/bulk/companies-bulk-actions";
import { ImportWizardDialog } from "@/components/import/import-wizard-dialog";
import { OwnerFilter, resolveOwnerFilter, type OwnerFilterValue } from "@/components/filters/owner-filter";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { VERTICALS, VERTICAL_COLORS } from "@/lib/constants/verticals";
import { useTags } from "@/lib/hooks/use-tags";
import { useVisibleCustomFields, useCustomFieldValues } from "@/lib/hooks/use-custom-field-columns";
import { useFieldLabels } from "@/lib/hooks/use-field-labels";

interface CompanyRow {
  id: string;
  crmId: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  description: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  vertical: string | null;
  ownerId: string | null;
  ownerFirstName: string | null;
  ownerLastName: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function CompaniesPageWrapper() {
  return (
    <Suspense>
      <CompaniesPage />
    </Suspense>
  );
}

const ALL_COMPANY_COLUMNS = [
  "industry", "vertical", "size", "owner", "description", "createdAt",
];

function CompaniesPage() {
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const selection = useRowSelection();
  const prevFilterKey = useRef("");

  // Handle ?create=true from command palette quick action
  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setCreateOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("create");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);
  const [editingCompany, setEditingCompany] = useState<CompanyRow | null>(null);
  const [search, setSearch] = useState("");
  const [sizeFilter, setSizeFilter] = useState<string>("all");
  const [industryFilter, setIndustryFilter] = useState("");
  const [verticalFilter, setVerticalFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectAllLoading, setSelectAllLoading] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<string[] | null>(null);
  const [tagFilter, setTagFilter] = useState<string>("all");

  const { user: currentUser, isAdminOrManager } = useCurrentUser();
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilterValue>("all");
  const ownerFilterInitialized = useRef(false);
  useEffect(() => {
    if (currentUser && !ownerFilterInitialized.current) {
      ownerFilterInitialized.current = true;
      if (!isAdminOrManager) {
        setOwnerFilter("my");
      }
    }
  }, [currentUser, isAdminOrManager]);

  const resolvedOwnerId = resolveOwnerFilter(ownerFilter, currentUser?.id);

  const { data, isLoading } = useCompanies({
    page,
    limit: pageSize,
    search: search || undefined,
    size: sizeFilter !== "all" ? sizeFilter : undefined,
    industry: industryFilter || undefined,
    vertical: verticalFilter !== "all" ? verticalFilter : undefined,
    ownerId: resolvedOwnerId,
    tagId: tagFilter !== "all" ? tagFilter : undefined,
  });

  const deleteCompany = useDeleteCompany();
  const { data: tagsList } = useTags();

  const { data: savedViews } = useSavedViews("company");
  const createView = useCreateSavedView();
  const deleteView = useDeleteSavedView();

  const currentPageIds = data?.data?.map((c: CompanyRow) => c.id) ?? [];

  const { data: customFieldDefs } = useVisibleCustomFields("company");
  const { data: customFieldVals } = useCustomFieldValues("company", currentPageIds);
  const { getLabel } = useFieldLabels();

  const colVisible = (key: string) => !visibleColumns || visibleColumns.includes(key);

  const filterKey = `${search}|${sizeFilter}|${industryFilter}|${verticalFilter}|${ownerFilter}|${tagFilter}|${page}|${pageSize}`;
  useEffect(() => {
    if (prevFilterKey.current && prevFilterKey.current !== filterKey) {
      selection.clear();
    }
    prevFilterKey.current = filterKey;
  }, [filterKey]);

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    deleteCompany.mutate(id, {
      onSuccess: () => toast.success(`${name} deleted`),
      onError: () => toast.error("Failed to delete company"),
    });
  }

  async function handleEdit(companyId: string) {
    try {
      const res = await fetch(`/api/companies/${companyId}`);
      if (!res.ok) throw new Error("Failed to fetch company");
      const company = await res.json();
      setEditingCompany(company);
    } catch {
      toast.error("Failed to load company for editing");
    }
  }

  function handleSaveView(e: React.FormEvent) {
    e.preventDefault();
    if (!viewName.trim()) return;
    const filters: Record<string, unknown>[] = [];
    if (search) filters.push({ field: "search", value: search });
    if (sizeFilter !== "all") filters.push({ field: "size", value: sizeFilter });
    if (industryFilter) filters.push({ field: "industry", value: industryFilter });
    if (verticalFilter !== "all") filters.push({ field: "vertical", value: verticalFilter });
    if (tagFilter !== "all") filters.push({ field: "tagId", value: tagFilter });

    // Compute hidden columns so new columns added later show by default
    const hiddenCols = visibleColumns
      ? ALL_COMPANY_COLUMNS.filter((c) => !visibleColumns.includes(c))
      : [];
    if (hiddenCols.length > 0) {
      filters.push({ field: "__hiddenColumns", value: hiddenCols });
    }

    createView.mutate(
      { name: viewName.trim(), entityType: "company", filters, columns: visibleColumns ?? undefined },
      {
        onSuccess: () => {
          toast.success("View saved");
          setSaveViewOpen(false);
          setViewName("");
        },
        onError: () => toast.error("Failed to save view"),
      }
    );
  }

  function handleLoadView(view: { filters: Record<string, unknown>[]; columns?: string[] }) {
    setPage(1);
    setSearch("");
    setSizeFilter("all");
    setIndustryFilter("");
    setVerticalFilter("all");
    setTagFilter("all");

    // Check for hiddenColumns convention (new views) vs columns (legacy views)
    const hiddenColsFilter = view.filters.find((f) => f.field === "__hiddenColumns");
    if (hiddenColsFilter && Array.isArray(hiddenColsFilter.value)) {
      const hidden = new Set(hiddenColsFilter.value as string[]);
      setVisibleColumns(ALL_COMPANY_COLUMNS.filter((c) => !hidden.has(c)));
    } else {
      setVisibleColumns(view.columns?.length ? view.columns : null);
    }

    for (const f of view.filters) {
      if (f.field === "search") setSearch(f.value as string);
      if (f.field === "size") setSizeFilter(f.value as string);
      if (f.field === "industry") setIndustryFilter(f.value as string);
      if (f.field === "vertical") setVerticalFilter(f.value as string);
      if (f.field === "tagId") setTagFilter(f.value as string);
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
      if (sizeFilter !== "all") params.set("size", sizeFilter);
      if (industryFilter) params.set("industry", industryFilter);
      if (verticalFilter !== "all") params.set("vertical", verticalFilter);
      if (resolvedOwnerId) params.set("ownerId", resolvedOwnerId);
      if (tagFilter !== "all") params.set("tagId", tagFilter);
      const res = await fetch(`/api/companies?${params}`);
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
          <p className="text-sm text-muted-foreground">
            Manage companies and organizations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Company
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
            placeholder="Search companies..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={sizeFilter}
          onValueChange={(v) => {
            setSizeFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sizes</SelectItem>
            <SelectItem value="1-10">1-10</SelectItem>
            <SelectItem value="11-50">11-50</SelectItem>
            <SelectItem value="51-200">51-200</SelectItem>
            <SelectItem value="201-1000">201-1000</SelectItem>
            <SelectItem value="1000+">1000+</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative min-w-[150px] max-w-[200px]">
          <Input
            placeholder="Filter industry..."
            value={industryFilter}
            onChange={(e) => {
              setIndustryFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>
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
        <Select
          value={tagFilter}
          onValueChange={(v) => {
            setTagFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tags</SelectItem>
            {(tagsList as Array<{ id: string; name: string; color: string }> | undefined)?.map(
              (tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full inline-block"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </span>
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
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
          All {currentPageIds.length} companies on this page are selected.{" "}
          <button
            className="text-blue-600 dark:text-blue-400 font-medium hover:underline disabled:opacity-50"
            onClick={handleSelectAllMatching}
            disabled={selectAllLoading}
          >
            {selectAllLoading
              ? "Loading..."
              : `Select all ${totalMatching > 500 ? "500" : totalMatching} matching companies`}
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
              {colVisible("industry") && <TableHead>{getLabel("industry", "Industry")}</TableHead>}
              {colVisible("vertical") && <TableHead>{getLabel("vertical", "Vertical")}</TableHead>}
              {colVisible("size") && <TableHead>{getLabel("size", "Size")}</TableHead>}
              {colVisible("owner") && <TableHead>{getLabel("owner", "Owner")}</TableHead>}
              {colVisible("description") && <TableHead>Description</TableHead>}
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
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell />
                </TableRow>
              ))}

            {!isLoading && data?.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No companies found. Create one to get started.
                </TableCell>
              </TableRow>
            )}

            {data?.data?.map((company: CompanyRow) => (
              <TableRow key={company.id}>
                <TableCell className="w-[40px]">
                  <Checkbox
                    checked={selection.isSelected(company.id)}
                    onCheckedChange={() => selection.toggle(company.id)}
                    aria-label={`Select ${company.name}`}
                  />
                </TableCell>
                <TableCell>
                  <Link
                    href={`/companies/${company.id}`}
                    className="flex items-center gap-3 hover:underline"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {company.name}
                        <span className="ml-2 text-[10px] font-normal text-muted-foreground">{company.crmId}</span>
                      </p>
                      {company.domain && (
                        <p className="text-xs text-muted-foreground">
                          {company.domain}
                        </p>
                      )}
                    </div>
                  </Link>
                </TableCell>
                {colVisible("industry") && (
                  <TableCell className="text-sm">
                    {company.industry ?? <span className="text-muted-foreground">--</span>}
                  </TableCell>
                )}
                {colVisible("vertical") && (
                  <TableCell>
                    {company.vertical ? (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${VERTICAL_COLORS[company.vertical] ?? ""}`}>
                        {VERTICALS.find((v) => v.value === company.vertical)?.label ?? company.vertical}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">--</span>
                    )}
                  </TableCell>
                )}
                {colVisible("size") && (
                  <TableCell>
                    {company.size ? (
                      <Badge variant="secondary">{company.size}</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">--</span>
                    )}
                  </TableCell>
                )}
                {colVisible("owner") && (
                  <TableCell className="text-sm text-muted-foreground">
                    {company.ownerFirstName
                      ? `${company.ownerFirstName} ${company.ownerLastName ?? ""}`
                      : "Unassigned"}
                  </TableCell>
                )}
                {colVisible("description") && (
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {company.description || "--"}
                  </TableCell>
                )}
                {colVisible("createdAt") && (
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(company.createdAt).toLocaleDateString()}
                  </TableCell>
                )}
                {customFieldDefs?.map((cf) => (
                  <TableCell key={cf.id} className="text-sm">
                    {customFieldVals?.[company.id]?.[cf.name] ?? ""}
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
                        <Link href={`/companies/${company.id}`}>View</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(company.id)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(company.id, company.name)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
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
          <CompaniesBulkActions
            selectedIds={Array.from(selection.selectedIds)}
            onComplete={selection.clear}
          />
        </BulkActionBar>
      )}

      <CompanyForm open={createOpen} onOpenChange={setCreateOpen} />

      {editingCompany && (
        <EditCompanyDialog
          company={editingCompany}
          open={!!editingCompany}
          onOpenChange={(open) => {
            if (!open) setEditingCompany(null);
          }}
        />
      )}

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

      <ImportWizardDialog mode="company" open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

"use client";

import { Suspense, useState, useEffect } from "react";
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
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface CompanyRow {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  description: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
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

function CompaniesPage() {
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);

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
  const [page, setPage] = useState(1);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState("");

  const { data, isLoading } = useCompanies({
    page,
    search: search || undefined,
    size: sizeFilter !== "all" ? sizeFilter : undefined,
    industry: industryFilter || undefined,
  });

  const deleteCompany = useDeleteCompany();

  const { data: savedViews } = useSavedViews("company");
  const createView = useCreateSavedView();
  const deleteView = useDeleteSavedView();

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

    createView.mutate(
      { name: viewName.trim(), entityType: "company", filters },
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

  function handleLoadView(view: { filters: Record<string, unknown>[] }) {
    setPage(1);
    setSearch("");
    setSizeFilter("all");
    setIndustryFilter("");
    for (const f of view.filters) {
      if (f.field === "search") setSearch(f.value as string);
      if (f.field === "size") setSizeFilter(f.value as string);
      if (f.field === "industry") setIndustryFilter(f.value as string);
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
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Company
        </Button>
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
              <TableHead>Name</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Owner</TableHead>
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
                <TableCell colSpan={5} className="h-24 text-center">
                  No companies found. Create one to get started.
                </TableCell>
              </TableRow>
            )}

            {data?.data?.map((company: CompanyRow) => (
              <TableRow key={company.id}>
                <TableCell>
                  <Link
                    href={`/companies/${company.id}`}
                    className="flex items-center gap-3 hover:underline"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{company.name}</p>
                      {company.domain && (
                        <p className="text-xs text-muted-foreground">
                          {company.domain}
                        </p>
                      )}
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="text-sm">
                  {company.industry ?? <span className="text-muted-foreground">--</span>}
                </TableCell>
                <TableCell>
                  {company.size ? (
                    <Badge variant="secondary">{company.size}</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">--</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {company.ownerFirstName
                    ? `${company.ownerFirstName} ${company.ownerLastName ?? ""}`
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
      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * 25 + 1}--
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
    </div>
  );
}

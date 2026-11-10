"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { getBuiltInColumns, type ColumnDef } from "@/lib/admin/column-registry";

const ALL_ROLES = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "account_manager", label: "Account Manager" },
  { value: "ae", label: "AE" },
  { value: "enterprise_sales", label: "Enterprise Sales" },
];

const ENTITY_TYPES = [
  { value: "contact", label: "Contacts" },
  { value: "deal", label: "Deals" },
  { value: "company", label: "Companies" },
  { value: "task", label: "Tasks" },
];

interface AdminView {
  id: string;
  name: string;
  entityType: string;
  columns: string[] | null;
  showInSidebar: boolean;
  roles: string[];
}

export default function ViewsPage() {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingView, setEditingView] = useState<AdminView | null>(null);

  const { data: views = [], isLoading } = useQuery<AdminView[]>({
    queryKey: ["admin", "views"],
    queryFn: async () => {
      const res = await fetch("/api/admin/views");
      if (!res.ok) throw new Error("Failed to fetch views");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/views?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "views"] });
      toast.success("View deleted");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Views</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage admin views for entity list pages.
          </p>
        </div>
        <Button onClick={() => setEditorOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create View
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Columns</TableHead>
              <TableHead>Sidebar</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center">
                  <Skeleton className="h-4 w-32 mx-auto" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && views.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No admin views yet. Create one to get started.
                </TableCell>
              </TableRow>
            )}
            {views.map((view) => (
              <TableRow key={view.id}>
                <TableCell className="font-medium">{view.name}</TableCell>
                <TableCell className="capitalize">{view.entityType}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {view.columns?.length ?? "Default"} columns
                </TableCell>
                <TableCell>
                  {view.showInSidebar ? (
                    <Badge variant="default" className="text-[10px]">Yes</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">No</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {view.roles.map((r) => (
                      <Badge key={r} variant="outline" className="text-[10px]">
                        {r.replace("_", " ")}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditingView(view)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => {
                        if (confirm("Delete this view?")) {
                          deleteMutation.mutate(view.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {(editorOpen || editingView) && (
        <ViewEditor
          open={editorOpen || !!editingView}
          onOpenChange={(open) => {
            if (!open) {
              setEditorOpen(false);
              setEditingView(null);
            }
          }}
          initialData={editingView}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["admin", "views"] });
            setEditorOpen(false);
            setEditingView(null);
          }}
        />
      )}
    </div>
  );
}

function ViewEditor({
  open,
  onOpenChange,
  initialData,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: AdminView | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [entityType, setEntityType] = useState(initialData?.entityType ?? "contact");
  const [showInSidebar, setShowInSidebar] = useState(initialData?.showInSidebar ?? false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    initialData?.columns ?? []
  );
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    initialData?.roles ?? ALL_ROLES.map((r) => r.value)
  );
  const [saving, setSaving] = useState(false);

  const availableColumns = getBuiltInColumns(entityType);

  async function handleSave() {
    setSaving(true);
    try {
      const method = initialData?.id ? "PUT" : "POST";
      const body = {
        ...(initialData?.id ? { id: initialData.id } : {}),
        name,
        entityType,
        filters: [],
        columns: selectedColumns.length > 0 ? selectedColumns : null,
        showInSidebar,
        roles: selectedRoles,
      };

      const res = await fetch("/api/admin/views", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success(initialData?.id ? "View updated" : "View created");
      onSaved();
    } catch {
      toast.error("Failed to save view");
    } finally {
      setSaving(false);
    }
  }

  function toggleColumn(key: string) {
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function toggleRole(role: string) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData?.id ? "Edit View" : "Create View"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="View name" required />
          </div>

          <div>
            <Label>Entity Type</Label>
            <Select
              value={entityType}
              onValueChange={(v) => {
                setEntityType(v);
                setSelectedColumns([]);
              }}
              disabled={!!initialData?.id}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map((et) => (
                  <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-2 block">Columns</Label>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
              {availableColumns.map((col) => (
                <label key={col.key} className="flex items-center gap-2 text-sm py-0.5">
                  <Checkbox
                    checked={selectedColumns.includes(col.key)}
                    onCheckedChange={() => toggleColumn(col.key)}
                  />
                  {col.label}
                </label>
              ))}
            </div>
            {selectedColumns.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                No columns selected — will show all default columns.
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={showInSidebar}
              onCheckedChange={(c) => setShowInSidebar(!!c)}
            />
            Show in sidebar
          </label>

          <div>
            <Label className="mb-2 block">Role Access</Label>
            <div className="space-y-1.5">
              {ALL_ROLES.map((role) => (
                <label key={role.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedRoles.includes(role.value)}
                    onCheckedChange={() => toggleRole(role.value)}
                  />
                  {role.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

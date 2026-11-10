"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { NavItemEditor } from "@/components/admin/nav-item-editor";
import { ICON_MAP } from "@/components/admin/icon-picker";
import { Circle } from "lucide-react";

interface NavItemWithRoles {
  id: string;
  label: string;
  icon: string;
  href: string;
  section: "main" | "bottom";
  position: number;
  isSystem: boolean;
  roles: string[];
}

async function fetchAllNavItems(): Promise<NavItemWithRoles[]> {
  const res = await fetch("/api/admin/nav/all");
  if (!res.ok) throw new Error("Failed to fetch nav items");
  return res.json();
}

/* ── Sortable row component ─────────────────────────────── */

function SortableNavRow({
  item,
  onEdit,
  onDelete,
}: {
  item: NavItemWithRoles;
  onEdit: (item: NavItemWithRoles) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = ICON_MAP[item.icon] ?? Circle;

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="w-10">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground hover:text-foreground touch-none"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{item.label}</span>
          {item.isSystem && (
            <Badge variant="secondary" className="text-[10px]">
              System
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {item.href}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {item.roles.map((role) => (
            <Badge key={role} variant="outline" className="text-[10px]">
              {role.replace("_", " ")}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(item)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {!item.isSystem && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => {
                if (confirm(`Delete "${item.label}"?`)) {
                  onDelete(item.id);
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

/* ── Main page ──────────────────────────────────────────── */

export default function NavigationPage() {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<NavItemWithRoles | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin", "nav", "all"],
    queryFn: fetchAllNavItems,
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      label: string;
      icon: string;
      href: string;
      section: string;
      roles: string[];
    }) => {
      const res = await fetch("/api/admin/nav", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, position: items.length }),
      });
      if (!res.ok) throw new Error("Failed to create nav item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "nav"] });
      setEditorOpen(false);
      toast.success("Nav item created");
    },
    onError: () => toast.error("Failed to create nav item"),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: {
      id?: string;
      label: string;
      icon: string;
      href: string;
      section: string;
      roles: string[];
    }) => {
      const res = await fetch("/api/admin/nav", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update nav item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "nav"] });
      setEditingItem(null);
      toast.success("Nav item updated");
    },
    onError: () => toast.error("Failed to update nav item"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/nav?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "nav"] });
      toast.success("Nav item deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const res = await fetch("/api/admin/nav/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });
      if (!res.ok) throw new Error("Failed to reorder");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "nav"] });
    },
  });

  const mainItems = items
    .filter((i) => i.section === "main")
    .sort((a, b) => a.position - b.position);
  const bottomItems = items
    .filter((i) => i.section === "bottom")
    .sort((a, b) => a.position - b.position);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Determine which section the item is in
    const isMain = mainItems.some((i) => i.id === active.id);
    const sectionItems = isMain ? [...mainItems] : [...bottomItems];
    const otherSection = isMain ? bottomItems : mainItems;

    const oldIndex = sectionItems.findIndex((i) => i.id === active.id);
    const newIndex = sectionItems.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sectionItems, oldIndex, newIndex);
    const allOrdered = isMain
      ? [...reordered, ...otherSection]
      : [...otherSection, ...reordered];

    reorderMutation.mutate(allOrdered.map((i) => i.id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Navigation</h1>
          <p className="text-sm text-muted-foreground">
            Manage sidebar navigation items and role access.
          </p>
        </div>
        <Button onClick={() => setEditorOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Label</TableHead>
              <TableHead>Path</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No navigation items configured. Using defaults.
                </TableCell>
              </TableRow>
            )}

            {mainItems.length > 0 && (
              <TableRow>
                <TableCell colSpan={5} className="bg-muted/50 py-1.5 text-xs font-semibold text-muted-foreground">
                  Main Navigation
                </TableCell>
              </TableRow>
            )}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={mainItems.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                {mainItems.map((item) => (
                  <SortableNavRow
                    key={item.id}
                    item={item}
                    onEdit={setEditingItem}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                ))}
              </SortableContext>

              {bottomItems.length > 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="bg-muted/50 py-1.5 text-xs font-semibold text-muted-foreground">
                    Bottom Navigation
                  </TableCell>
                </TableRow>
              )}

              <SortableContext
                items={bottomItems.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                {bottomItems.map((item) => (
                  <SortableNavRow
                    key={item.id}
                    item={item}
                    onEdit={setEditingItem}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </TableBody>
        </Table>
      </div>

      <NavItemEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSave={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
      />

      {editingItem && (
        <NavItemEditor
          open={!!editingItem}
          onOpenChange={(open) => {
            if (!open) setEditingItem(null);
          }}
          initialData={editingItem}
          onSave={(data) => updateMutation.mutate(data)}
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  );
}

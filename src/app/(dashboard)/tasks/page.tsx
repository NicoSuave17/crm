"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTasks, useUpdateTask, useDeleteTask } from "@/lib/hooks/use-tasks";
import { OwnerFilter, resolveOwnerFilter, type OwnerFilterValue } from "@/components/filters/owner-filter";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useSavedViews, useCreateSavedView, useDeleteSavedView } from "@/lib/hooks/use-saved-views";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Plus, MoreHorizontal, AlertCircle, Save, Bookmark, X } from "lucide-react";
import { toast } from "sonner";
import { format, isPast } from "date-fns";
import Link from "next/link";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";

const priorityColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  urgent: "destructive",
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

interface EditingTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string;
  contactId: string | null;
  dealId: string | null;
  dueDate: string | null;
}

export default function TasksPageWrapper() {
  return (
    <Suspense>
      <TasksPage />
    </Suspense>
  );
}

const ALL_TASK_COLUMNS = [
  "priority", "contact", "company", "deal", "dueDate",
  "assignee", "createdBy", "completedAt",
];

function TasksPage() {
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

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

  const resolvedAssigneeId = resolveOwnerFilter(ownerFilter, currentUser?.id);

  // Handle ?create=true from command palette quick action
  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setCreateOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("create");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);
  const [editingTask, setEditingTask] = useState<EditingTask | null>(null);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<string[] | null>(null);
  const colVisible = (key: string) => !visibleColumns || visibleColumns.includes(key);

  const { data: tasks, isLoading } = useTasks({
    status: statusFilter !== "all" ? statusFilter : undefined,
    assigneeId: resolvedAssigneeId,
    priority: priorityFilter !== "all" ? priorityFilter : undefined,
    dueFilter: dateFilter !== "all" ? dateFilter : undefined,
  });
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const { data: savedViews } = useSavedViews("task");
  const createView = useCreateSavedView();
  const deleteView = useDeleteSavedView();

  async function handleEdit(taskId: string) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) throw new Error("Failed to fetch task");
      const task = await res.json();
      setEditingTask(task);
    } catch {
      toast.error("Failed to load task for editing");
    }
  }

  function handleToggle(id: string, currentStatus: string) {
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    updateTask.mutate(
      { id, data: { status: newStatus } },
      { onError: () => toast.error("Failed to update task") }
    );
  }

  function handleDelete(id: string) {
    deleteTask.mutate(id, {
      onSuccess: () => toast.success("Task deleted"),
      onError: () => toast.error("Failed to delete task"),
    });
  }

  function handleSaveView(e: React.FormEvent) {
    e.preventDefault();
    if (!viewName.trim()) return;
    const filters: Record<string, unknown>[] = [];
    if (statusFilter !== "all") filters.push({ field: "status", value: statusFilter });

    // Compute hidden columns so new columns added later show by default
    const hiddenCols = visibleColumns
      ? ALL_TASK_COLUMNS.filter((c) => !visibleColumns.includes(c))
      : [];
    if (hiddenCols.length > 0) {
      filters.push({ field: "__hiddenColumns", value: hiddenCols });
    }

    createView.mutate(
      { name: viewName.trim(), entityType: "task", filters, columns: visibleColumns ?? undefined },
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
    setStatusFilter("all");
    setPriorityFilter("all");
    setDateFilter("all");

    // Check for hiddenColumns convention (new views) vs columns (legacy views)
    const hiddenColsFilter = view.filters.find((f) => f.field === "__hiddenColumns");
    if (hiddenColsFilter && Array.isArray(hiddenColsFilter.value)) {
      const hidden = new Set(hiddenColsFilter.value as string[]);
      setVisibleColumns(ALL_TASK_COLUMNS.filter((c) => !hidden.has(c)));
    } else {
      setVisibleColumns(view.columns?.length ? view.columns : null);
    }

    for (const f of view.filters) {
      if (f.field === "status") setStatusFilter(f.value as string);
      if (f.field === "priority") setPriorityFilter(f.value as string);
      if (f.field === "dueFilter") setDateFilter(f.value as string);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Track and manage your tasks.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Task
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
      <div className="flex items-center gap-3">
        <OwnerFilter value={ownerFilter} onChange={setOwnerFilter} label="Assignee" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dates</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="today">Due Today</SelectItem>
            <SelectItem value="week">Due This Week</SelectItem>
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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Task</TableHead>
              {colVisible("priority") && <TableHead>Priority</TableHead>}
              {colVisible("contact") && <TableHead>Contact</TableHead>}
              {colVisible("company") && <TableHead>Company</TableHead>}
              {colVisible("deal") && <TableHead>Deal</TableHead>}
              {colVisible("dueDate") && <TableHead>Due Date</TableHead>}
              {colVisible("assignee") && <TableHead>Assignee</TableHead>}
              {colVisible("createdBy") && <TableHead>Created By</TableHead>}
              {colVisible("completedAt") && <TableHead>Completed</TableHead>}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell />
                </TableRow>
              ))}

            {!isLoading && tasks?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No tasks found.
                </TableCell>
              </TableRow>
            )}

            {tasks?.map(
              (task: {
                id: string;
                title: string;
                status: string;
                priority: string;
                assigneeFirstName: string | null;
                assigneeLastName: string | null;
                creatorFirstName: string | null;
                creatorLastName: string | null;
                contactId: string | null;
                contactFirstName: string | null;
                contactLastName: string | null;
                dealId: string | null;
                dealTitle: string | null;
                companyId: string | null;
                companyName: string | null;
                dueDate: string | null;
                completedAt: string | null;
              }) => {
                const overdue =
                  task.dueDate &&
                  task.status !== "completed" &&
                  isPast(new Date(task.dueDate));

                return (
                  <TableRow key={task.id}>
                    <TableCell>
                      <Checkbox
                        checked={task.status === "completed"}
                        onCheckedChange={() =>
                          handleToggle(task.id, task.status)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          task.status === "completed"
                            ? "line-through text-muted-foreground"
                            : "font-medium"
                        }
                      >
                        {task.title}
                      </span>
                    </TableCell>
                    {colVisible("priority") && (
                      <TableCell>
                        <Badge variant={priorityColors[task.priority] ?? "outline"}>
                          {task.priority}
                        </Badge>
                      </TableCell>
                    )}
                    {colVisible("contact") && (
                      <TableCell>
                        {task.contactId ? (
                          <Link
                            href={`/contacts/${task.contactId}`}
                            className="text-sm hover:underline"
                          >
                            {task.contactFirstName} {task.contactLastName}
                          </Link>
                        ) : (
                          <span className="text-sm text-muted-foreground">--</span>
                        )}
                      </TableCell>
                    )}
                    {colVisible("company") && (
                      <TableCell className="text-sm">
                        {task.companyId ? (
                          <Link href={`/companies/${task.companyId}`} className="hover:underline">
                            {task.companyName}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                    )}
                    {colVisible("deal") && (
                      <TableCell className="text-sm">
                        {task.dealId ? (
                          <Link href={`/deals/${task.dealId}`} className="hover:underline">
                            {task.dealTitle}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                    )}
                    {colVisible("dueDate") && (
                      <TableCell>
                        {task.dueDate ? (
                          <span
                            className={
                              overdue
                                ? "text-sm text-destructive font-medium flex items-center gap-1"
                                : "text-sm"
                            }
                          >
                            {overdue && <AlertCircle className="h-3 w-3" />}
                            {format(new Date(task.dueDate), "MMM d, yyyy")}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">--</span>
                        )}
                      </TableCell>
                    )}
                    {colVisible("assignee") && (
                      <TableCell className="text-sm text-muted-foreground">
                        {task.assigneeFirstName
                          ? `${task.assigneeFirstName} ${task.assigneeLastName ?? ""}`
                          : "--"}
                      </TableCell>
                    )}
                    {colVisible("createdBy") && (
                      <TableCell className="text-sm text-muted-foreground">
                        {task.creatorFirstName
                          ? `${task.creatorFirstName} ${task.creatorLastName ?? ""}`
                          : "--"}
                      </TableCell>
                    )}
                    {colVisible("completedAt") && (
                      <TableCell className="text-sm text-muted-foreground">
                        {task.completedAt
                          ? format(new Date(task.completedAt), "MMM d, yyyy")
                          : "--"}
                      </TableCell>
                    )}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(task.id)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(task.id)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              }
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Task Dialog */}
      <TaskFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      {/* Edit Task Dialog */}
      <TaskFormDialog
        task={editingTask}
        open={!!editingTask}
        onOpenChange={(open) => {
          if (!open) setEditingTask(null);
        }}
      />

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

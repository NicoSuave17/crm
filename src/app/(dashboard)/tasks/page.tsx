"use client";

import { useState } from "react";
import { useTasks, useUpdateTask, useDeleteTask } from "@/lib/hooks/use-tasks";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MoreHorizontal, AlertCircle } from "lucide-react";
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

export default function TasksPage() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<EditingTask | null>(null);

  const { data: tasks, isLoading } = useTasks({ status: statusFilter !== "all" ? statusFilter : undefined });
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

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

      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Task</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Assignee</TableHead>
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
                contactId: string | null;
                contactFirstName: string | null;
                contactLastName: string | null;
                dueDate: string | null;
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
                    <TableCell>
                      <Badge variant={priorityColors[task.priority] ?? "outline"}>
                        {task.priority}
                      </Badge>
                    </TableCell>
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
                    <TableCell className="text-sm text-muted-foreground">
                      {task.assigneeFirstName
                        ? `${task.assigneeFirstName} ${task.assigneeLastName ?? ""}`
                        : "--"}
                    </TableCell>
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
    </div>
  );
}

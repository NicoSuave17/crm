"use client";

import { useState } from "react";
import { useTasks, useUpdateTask } from "@/lib/hooks/use-tasks";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isPast } from "date-fns";
import { Plus, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const priorityColors: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  urgent: "destructive",
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

interface ContactTasksTabProps {
  contactId: string;
}

export function ContactTasksTab({ contactId }: ContactTasksTabProps) {
  const { data: tasks, isLoading } = useTasks({ contactId });
  const updateTask = useUpdateTask();
  const [createOpen, setCreateOpen] = useState(false);

  function handleToggle(id: string, currentStatus: string) {
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    updateTask.mutate(
      { id, data: { status: newStatus } },
      { onError: () => toast.error("Failed to update task") }
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-base">Tasks</CardTitle>
          <CardDescription>
            Tasks associated with this contact
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Task</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Assignee</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-4" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && (!tasks || tasks.length === 0) && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No tasks for this contact.
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
                      <Badge
                        variant={priorityColors[task.priority] ?? "outline"}
                      >
                        {task.priority}
                      </Badge>
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
                        <span className="text-sm text-muted-foreground">
                          --
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {task.assigneeFirstName
                        ? `${task.assigneeFirstName} ${task.assigneeLastName ?? ""}`
                        : "--"}
                    </TableCell>
                  </TableRow>
                );
              }
            )}
          </TableBody>
        </Table>
      </CardContent>

      <TaskFormDialog
        defaultContactId={contactId}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </Card>
  );
}

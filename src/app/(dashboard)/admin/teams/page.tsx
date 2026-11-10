"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserPicker } from "@/components/pickers/user-picker";
import {
  useTeams,
  useCreateTeam,
  useUpdateTeam,
  useDeleteTeam,
} from "@/lib/hooks/use-teams";
import type { Team } from "@/lib/hooks/use-teams";
import { useUsers } from "@/lib/hooks/use-users";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Pencil, Trash2, Search } from "lucide-react";

interface TeamFormData {
  name: string;
  managerId: string | null;
  memberIds: string[];
}

const emptyForm: TeamFormData = {
  name: "",
  managerId: null,
  memberIds: [],
};

export default function TeamsPage() {
  const { data: teams = [], isLoading } = useTeams();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState<TeamFormData>(emptyForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  function openCreateDialog() {
    setEditingTeam(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  }

  function openEditDialog(team: Team) {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      managerId: team.managerId,
      memberIds: team.members.map((m) => m.userId),
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!formData.name.trim()) {
      toast.error("Team name is required");
      return;
    }

    try {
      if (editingTeam) {
        await updateTeam.mutateAsync({
          id: editingTeam.id,
          name: formData.name,
          managerId: formData.managerId,
          memberIds: formData.memberIds,
        });
        toast.success("Team updated");
      } else {
        await createTeam.mutateAsync({
          name: formData.name,
          managerId: formData.managerId ?? undefined,
          memberIds:
            formData.memberIds.length > 0 ? formData.memberIds : undefined,
        });
        toast.success("Team created");
      }
      setDialogOpen(false);
      setFormData(emptyForm);
      setEditingTeam(null);
    } catch {
      toast.error(editingTeam ? "Failed to update team" : "Failed to create team");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteTeam.mutateAsync(id);
      toast.success("Team deleted");
      setDeleteConfirmId(null);
    } catch {
      toast.error("Failed to delete team");
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Teams</h1>
          <p className="text-sm text-muted-foreground">
            Manage teams and member assignments.
          </p>
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Teams</h1>
          <p className="text-sm text-muted-foreground">
            Manage teams and member assignments.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Create Team
        </Button>
      </div>

      {teams.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            No teams yet. Create your first team to get started.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team Name</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[70px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell>
                    {team.managerFirstName
                      ? `${team.managerFirstName} ${team.managerLastName ?? ""}`.trim()
                      : <span className="text-muted-foreground">&mdash;</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {team.members.length}{" "}
                      {team.members.length === 1 ? "member" : "members"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(team.createdAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(team)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteConfirmId(team.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
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
      )}

      {/* Create/Edit Dialog */}
      <TeamDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingTeam(null);
            setFormData(emptyForm);
          }
        }}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        isEditing={!!editingTeam}
        isPending={createTeam.isPending || updateTeam.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Team</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this team? All member assignments
              will be removed. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={deleteTeam.isPending}
            >
              {deleteTeam.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TeamDialog({
  open,
  onOpenChange,
  formData,
  setFormData,
  onSubmit,
  isEditing,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: TeamFormData;
  setFormData: (data: TeamFormData) => void;
  onSubmit: () => void;
  isEditing: boolean;
  isPending: boolean;
}) {
  const { data: allUsers = [] } = useUsers();
  const [memberSearch, setMemberSearch] = useState("");

  const activeUsers = (
    allUsers as Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      isActive: boolean;
    }>
  ).filter((u) => u.isActive);

  const filteredUsers = memberSearch
    ? activeUsers.filter(
        (u) =>
          `${u.firstName} ${u.lastName} ${u.email}`
            .toLowerCase()
            .includes(memberSearch.toLowerCase())
      )
    : activeUsers;

  function toggleMember(userId: string) {
    setFormData({
      ...formData,
      memberIds: formData.memberIds.includes(userId)
        ? formData.memberIds.filter((id) => id !== userId)
        : [...formData.memberIds, userId],
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Team" : "Create Team"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update team details and member assignments."
              : "Create a new team and assign members."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Team Name */}
          <div className="space-y-2">
            <Label htmlFor="team-name">Team Name</Label>
            <Input
              id="team-name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g., Sales West Coast"
            />
          </div>

          {/* Manager Picker */}
          <div className="space-y-2">
            <Label>Manager</Label>
            <UserPicker
              value={formData.managerId}
              onChange={(userId) =>
                setFormData({ ...formData, managerId: userId })
              }
              placeholder="Select a manager..."
            />
          </div>

          {/* Member Multi-Select */}
          <div className="space-y-2">
            <Label>
              Members{" "}
              {formData.memberIds.length > 0 && (
                <span className="text-muted-foreground font-normal">
                  ({formData.memberIds.length} selected)
                </span>
              )}
            </Label>
            <div className="rounded-md border">
              <div className="flex items-center border-b px-3">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <input
                  className="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="Search users..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />
              </div>
              <ScrollArea className="h-[200px]">
                <div className="p-1">
                  {filteredUsers.length === 0 ? (
                    <p className="p-4 text-center text-sm text-muted-foreground">
                      No users found.
                    </p>
                  ) : (
                    filteredUsers.map((user) => (
                      <label
                        key={user.id}
                        className="flex items-center gap-3 rounded-sm px-3 py-2 hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={formData.memberIds.includes(user.id)}
                          onCheckedChange={() => toggleMember(user.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {user.email}
                          </p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isPending}>
            {isPending
              ? isEditing
                ? "Saving..."
                : "Creating..."
              : isEditing
                ? "Save Changes"
                : "Create Team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

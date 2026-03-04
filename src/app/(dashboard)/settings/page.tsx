"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { useTags, useCreateTag, useDeleteTag } from "@/lib/hooks/use-tags";
import {
  useEmailTemplates,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
  useDeleteEmailTemplate,
  type EmailTemplate,
} from "@/lib/hooks/use-email-templates";
import {
  useFieldDefinitions,
  useCreateFieldDefinition,
  useDeleteFieldDefinition,
} from "@/lib/hooks/use-custom-fields";
import { usePipelines } from "@/lib/hooks/use-pipeline";
import { useUsers, useUpdateUser, useCurrentUser } from "@/lib/hooks/use-users";
import {
  previewTemplate,
  TEMPLATE_VARIABLES,
} from "@/lib/utils/template-interpolation";
import { Plus, Trash2, Tag, Columns, GitBranch, Users, FileText, Mail, Pencil, Eye, EyeOff, ChevronDown } from "lucide-react";
import { useAuditLog, type AuditRow } from "@/lib/hooks/use-audit-log";
import { format } from "date-fns";
import { PipelineCard } from "@/components/settings/pipeline-card";
import { PipelineDialog } from "@/components/settings/pipeline-dialog";
import { OptionsEditor } from "@/components/custom-fields/options-editor";
import { toast } from "sonner";

const TAG_COLORS = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E", "#06B6D4",
  "#3B82F6", "#8B5CF6", "#EC4899", "#6B7280", "#1F2937",
];

export default function SettingsPageWrapper() {
  return (
    <Suspense>
      <SettingsPage />
    </Suspense>
  );
}

function SettingsPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") ?? "team");

  // Update tab when navigating from command palette with ?tab= param
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your CRM — team, tags, custom fields, pipelines, and audit log.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="team">
            <Users className="mr-2 h-4 w-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="tags">
            <Tag className="mr-2 h-4 w-4" />
            Tags
          </TabsTrigger>
          <TabsTrigger value="custom-fields">
            <Columns className="mr-2 h-4 w-4" />
            Custom Fields
          </TabsTrigger>
          <TabsTrigger value="pipelines">
            <GitBranch className="mr-2 h-4 w-4" />
            Pipelines
          </TabsTrigger>
          <TabsTrigger value="email-templates">
            <Mail className="mr-2 h-4 w-4" />
            Email Templates
          </TabsTrigger>
          <TabsTrigger value="audit-log">
            <FileText className="mr-2 h-4 w-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="mt-4">
          <TeamSettings />
        </TabsContent>

        <TabsContent value="tags" className="mt-4">
          <TagsSettings />
        </TabsContent>

        <TabsContent value="custom-fields" className="mt-4">
          <CustomFieldsSettings />
        </TabsContent>

        <TabsContent value="pipelines" className="mt-4">
          <PipelinesSettings />
        </TabsContent>

        <TabsContent value="email-templates" className="mt-4">
          <EmailTemplatesSettings />
        </TabsContent>

        <TabsContent value="audit-log" className="mt-4">
          <AuditLogSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Team Tab ────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  account_manager: "Account Manager",
  ae: "AE",
  enterprise_sales: "Enterprise Sales",
};

function TeamSettings() {
  const { data: users, isLoading } = useUsers();
  const updateUser = useUpdateUser();
  const { data: currentUser, isLoading: isCurrentUserLoading } = useCurrentUser();

  const isAdmin = currentUser?.role === "admin";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Members</CardTitle>
        <CardDescription>
          Manage your CRM team. New users are automatically created when they
          sign in with Clerk for the first time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading || isCurrentUserLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !users || users.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No team members found.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(
                (user: {
                  id: string;
                  firstName: string;
                  lastName: string;
                  email: string;
                  avatarUrl: string | null;
                  role: string;
                  isActive: boolean;
                }) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar size="default">
                          <AvatarImage
                            src={user.avatarUrl ?? undefined}
                            alt={`${user.firstName} ${user.lastName}`}
                          />
                          <AvatarFallback>
                            {user.firstName?.[0] ?? ""}
                            {user.lastName?.[0] ?? ""}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Select
                          value={user.role}
                          onValueChange={(newRole) => {
                            updateUser.mutate(
                              { id: user.id, data: { role: newRole } },
                              {
                                onSuccess: () => toast.success("Role updated"),
                                onError: () =>
                                  toast.error("Failed to update role"),
                              }
                            );
                          }}
                        >
                          <SelectTrigger className="w-[160px]" size="sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="account_manager">
                              Account Manager
                            </SelectItem>
                            <SelectItem value="ae">AE</SelectItem>
                            <SelectItem value="enterprise_sales">
                              Enterprise Sales
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline">
                          {ROLE_LABELS[user.role] ?? user.role}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.isActive ? "default" : "secondary"}
                        className={
                          user.isActive
                            ? "bg-green-600 hover:bg-green-600"
                            : ""
                        }
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isAdmin && currentUser?.id !== user.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={updateUser.isPending}
                          onClick={() => {
                            updateUser.mutate(
                              {
                                id: user.id,
                                data: { isActive: !user.isActive },
                              },
                              {
                                onSuccess: () =>
                                  toast.success(
                                    user.isActive
                                      ? "User deactivated"
                                      : "User activated"
                                  ),
                                onError: () =>
                                  toast.error("Failed to update user status"),
                              }
                            );
                          }}
                        >
                          {user.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Tags Tab ────────────────────────────────────────────────────

function TagsSettings() {
  const { data: tags, isLoading } = useTags();
  const createTag = useCreateTag();
  const deleteTag = useDeleteTag();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3B82F6");

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    createTag.mutate(
      { name: newName.trim(), color: newColor },
      {
        onSuccess: () => {
          toast.success("Tag created");
          setCreateOpen(false);
          setNewName("");
        },
        onError: () => toast.error("Failed to create tag"),
      }
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Tags</CardTitle>
          <CardDescription>Manage tags for contacts and deals.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Tag
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !tags || tags.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No tags yet. Create one to get started.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag: { id: string; name: string; color: string }) => (
              <div
                key={tag.id}
                className="flex items-center gap-2 rounded-md border px-3 py-1.5"
              >
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="text-sm">{tag.name}</span>
                <button
                  onClick={() =>
                    deleteTag.mutate(tag.id, {
                      onSuccess: () => toast.success("Tag deleted"),
                    })
                  }
                  className="text-muted-foreground hover:text-destructive ml-1"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Tag</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <Input
              placeholder="Tag name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
            <div>
              <p className="text-sm text-muted-foreground mb-2">Color</p>
              <div className="flex gap-2 flex-wrap">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-8 w-8 rounded-full border-2 ${
                      newColor === color ? "border-foreground" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewColor(color)}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTag.isPending}>
                {createTag.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Custom Fields Tab ──────────────────────────────────────────

function CustomFieldsSettings() {
  const [entityFilter, setEntityFilter] = useState("contact");
  const { data: fields, isLoading } = useFieldDefinitions(entityFilter);
  const createField = useCreateFieldDefinition();
  const deleteField = useDeleteFieldDefinition();
  const [createOpen, setCreateOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [newOptions, setNewOptions] = useState<
    { value: string; label: string; color?: string }[]
  >([]);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    const isSelectType =
      newFieldType === "select" || newFieldType === "multi_select";
    if (isSelectType && newOptions.length === 0) {
      toast.error("Add at least one option for select fields");
      return;
    }
    const name = newLabel.trim().toLowerCase().replace(/\s+/g, "_");
    createField.mutate(
      {
        entityType: entityFilter,
        name,
        label: newLabel.trim(),
        fieldType: newFieldType,
        ...(isSelectType && { options: newOptions }),
      },
      {
        onSuccess: () => {
          toast.success("Field created");
          setCreateOpen(false);
          setNewLabel("");
          setNewFieldType("text");
          setNewOptions([]);
        },
        onError: () => toast.error("Failed to create field"),
      }
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Custom Fields</CardTitle>
          <CardDescription>
            Add custom fields to contacts, deals, or companies.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Field
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contact">Contact</SelectItem>
              <SelectItem value="deal">Deal</SelectItem>
              <SelectItem value="company">Company</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !fields || fields.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No custom fields for {entityFilter}s yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>Visible in List</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map(
                (field: {
                  id: string;
                  label: string;
                  name: string;
                  fieldType: string;
                  isRequired: boolean;
                  isVisibleInList: boolean;
                }) => (
                  <TableRow key={field.id}>
                    <TableCell className="font-medium">{field.label}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {field.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{field.fieldType}</Badge>
                    </TableCell>
                    <TableCell>{field.isRequired ? "Yes" : "No"}</TableCell>
                    <TableCell>{field.isVisibleInList ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      <button
                        onClick={() =>
                          deleteField.mutate(field.id, {
                            onSuccess: () => toast.success("Field deleted"),
                          })
                        }
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setNewLabel("");
            setNewFieldType("text");
            setNewOptions([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Custom Field</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Entity Type</label>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contact">Contact</SelectItem>
                  <SelectItem value="deal">Deal</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Label</label>
              <Input
                placeholder="e.g. Twitter Handle"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Field Type</label>
              <Select value={newFieldType} onValueChange={setNewFieldType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="url">URL</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="currency">Currency</SelectItem>
                  <SelectItem value="select">Select</SelectItem>
                  <SelectItem value="multi_select">Multi-Select</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(newFieldType === "select" || newFieldType === "multi_select") && (
              <OptionsEditor options={newOptions} onChange={setNewOptions} />
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createField.isPending}>
                {createField.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Pipelines Tab ──────────────────────────────────────────────

function PipelinesSettings() {
  const { data: pipelines, isLoading } = usePipelines();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pipelines</h2>
          <p className="text-sm text-muted-foreground">
            Manage pipelines and their stages. Drag to reorder stages.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Pipeline
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : !pipelines || pipelines.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground text-center">
              No pipelines configured. Create one to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        pipelines.map(
          (pipeline: {
            id: string;
            name: string;
            description: string | null;
            type: string;
            isDefault: boolean;
            stages: Array<{
              id: string;
              name: string;
              position: number;
              color: string | null;
              probability: number | null;
              isWon: boolean;
              isLost: boolean;
            }>;
          }) => <PipelineCard key={pipeline.id} pipeline={pipeline} />
        )
      )}

      <PipelineDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

// ─── Email Templates Tab ────────────────────────────────────────

function EmailTemplatesSettings() {
  const { data: templates, isLoading } = useEmailTemplates();
  const { data: currentUser } = useCurrentUser();
  const createTemplate = useCreateEmailTemplate();
  const updateTemplate = useUpdateEmailTemplate();
  const deleteTemplate = useDeleteEmailTemplate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("");
  const [isShared, setIsShared] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [showVariables, setShowVariables] = useState(false);

  function openCreate() {
    setEditing(null);
    setName("");
    setSubject("");
    setBody("");
    setCategory("");
    setIsShared(true);
    setShowPreview(false);
    setShowVariables(false);
    setDialogOpen(true);
  }

  function openEdit(template: EmailTemplate) {
    setEditing(template);
    setName(template.name);
    setSubject(template.subject);
    setBody(template.body);
    setCategory(template.category ?? "");
    setIsShared(template.isShared ?? true);
    setShowPreview(false);
    setShowVariables(false);
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !subject.trim() || !body.trim()) return;

    const payload = {
      name: name.trim(),
      subject: subject.trim(),
      body: body.trim(),
      category: category.trim() || undefined,
      isShared,
    };

    if (editing) {
      updateTemplate.mutate(
        { id: editing.id, data: payload },
        {
          onSuccess: () => {
            toast.success("Template updated");
            setDialogOpen(false);
          },
          onError: () => toast.error("Failed to update template"),
        }
      );
    } else {
      createTemplate.mutate(payload, {
        onSuccess: () => {
          toast.success("Template created");
          setDialogOpen(false);
        },
        onError: () => toast.error("Failed to create template"),
      });
    }
  }

  const isMine = (t: EmailTemplate) => t.createdBy === currentUser?.id;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Email Templates</CardTitle>
          <CardDescription>
            Create reusable email templates with variable interpolation for quick
            activity logging.
          </CardDescription>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Template
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !templates || templates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No email templates yet. Create one to get started.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                    {t.subject}
                  </TableCell>
                  <TableCell>
                    {t.category && (
                      <Badge variant="secondary" className="text-xs">
                        {t.category}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.creatorFirstName} {t.creatorLastName}
                  </TableCell>
                  <TableCell>
                    {isMine(t) && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(t)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() =>
                            deleteTemplate.mutate(t.id, {
                              onSuccess: () => toast.success("Template deleted"),
                              onError: () =>
                                toast.error("Failed to delete template"),
                            })
                          }
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Template" : "Create Template"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="e.g. Welcome Email"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject</label>
              <Input
                placeholder='e.g. Welcome to Whop, {{firstName}}!'
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Use {"{{firstName}}"}, {"{{companyName}}"}, etc. for dynamic
                content.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Body</label>
              <Textarea
                placeholder='e.g. Hi {{firstName}}, thanks for joining Whop...'
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Category{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </label>
              <Input
                placeholder="e.g. Onboarding, Follow Up, Outreach"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="template-shared"
                checked={isShared}
                onChange={(e) => setIsShared(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="template-shared" className="text-sm">
                Share with team
              </label>
            </div>

            {/* Variable reference */}
            <div>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowVariables(!showVariables)}
              >
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${
                    showVariables ? "rotate-0" : "-rotate-90"
                  }`}
                />
                Available Variables
              </button>
              {showVariables && (
                <div className="mt-2 rounded-md border bg-muted/50 p-3 text-xs space-y-1">
                  {TEMPLATE_VARIABLES.map((v) => (
                    <div key={v.key} className="flex gap-2">
                      <code className="font-mono text-primary">
                        {`{{${v.key}}}`}
                      </code>
                      <span className="text-muted-foreground">
                        {v.label} (e.g. &quot;{v.example}&quot;)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Preview toggle */}
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? (
                  <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                )}
                {showPreview ? "Hide Preview" : "Preview"}
              </Button>
            </div>
            {showPreview && (subject || body) && (
              <div className="rounded-md border bg-muted/50 p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Preview with example data
                </p>
                {subject && (
                  <div>
                    <p className="text-xs text-muted-foreground">Subject:</p>
                    <p className="text-sm font-medium">
                      {previewTemplate(subject)}
                    </p>
                  </div>
                )}
                {body && (
                  <div>
                    <p className="text-xs text-muted-foreground">Body:</p>
                    <p className="text-sm whitespace-pre-wrap">
                      {previewTemplate(body)}
                    </p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  createTemplate.isPending || updateTemplate.isPending
                }
              >
                {createTemplate.isPending || updateTemplate.isPending
                  ? "Saving..."
                  : editing
                    ? "Update"
                    : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Audit Log Tab ──────────────────────────────────────────────

const PAGE_SIZE = 25;

const ENTITY_TYPE_LABELS: Record<string, string> = {
  contact: "Contact",
  deal: "Deal",
  task: "Task",
  pipeline: "Pipeline",
  tag: "Tag",
  custom_field: "Custom Field",
  user: "User",
  company: "Company",
};

function AuditLogSettings() {
  const [page, setPage] = useState(0);
  const [entityType, setEntityType] = useState<string>("all");
  const [userId, setUserId] = useState<string>("all");
  const [since, setSince] = useState<string>("");
  const [until, setUntil] = useState<string>("");

  const { data: users } = useUsers();

  const { data: result, isLoading } = useAuditLog({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    entityType: entityType !== "all" ? entityType : undefined,
    userId: userId !== "all" ? userId : undefined,
    since: since || undefined,
    until: until || undefined,
  });

  const entries = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Log</CardTitle>
        <CardDescription>
          Review all system events and changes made by team members.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter bar */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">From</label>
            <Input
              type="date"
              value={since}
              onChange={(e) => { setSince(e.target.value); setPage(0); }}
              className="w-[160px] h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">To</label>
            <Input
              type="date"
              value={until}
              onChange={(e) => { setUntil(e.target.value); setPage(0); }}
              className="w-[160px] h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">User</label>
            <Select value={userId} onValueChange={(v) => { setUserId(v); setPage(0); }}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users?.map((u: { id: string; firstName: string; lastName: string }) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Entity Type</label>
            <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(0); }}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(ENTITY_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(since || until || entityType !== "all" || userId !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSince("");
                setUntil("");
                setEntityType("all");
                setUserId("all");
                setPage(0);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No audit log entries found.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Timestamp</TableHead>
                <TableHead className="w-[140px]">User</TableHead>
                <TableHead className="w-[120px]">Action</TableHead>
                <TableHead className="w-[100px]">Entity Type</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry: AuditRow) => {
                const meta = entry.metadata as Record<string, unknown> | null;
                const entType = (meta?.entityType as string) ?? "—";
                const changes = meta?.changes as Record<string, { from: unknown; to: unknown }> | undefined;
                const changesSummary = changes
                  ? Object.entries(changes)
                      .map(([field, { from, to }]) => `${field}: ${String(from)} → ${String(to)}`)
                      .join(", ")
                  : null;

                return (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(entry.occurredAt), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.userFirstName} {entry.userLastName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {entry.action ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {ENTITY_TYPE_LABELS[entType] ?? entType}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[300px]">
                      {changesSummary ?? (entry.body ?? "—")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

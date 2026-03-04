"use client";

import { useState } from "react";
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
import { useTags, useCreateTag, useDeleteTag } from "@/lib/hooks/use-tags";
import {
  useFieldDefinitions,
  useCreateFieldDefinition,
  useDeleteFieldDefinition,
} from "@/lib/hooks/use-custom-fields";
import { usePipelines } from "@/lib/hooks/use-pipeline";
import { useUsers, useUpdateUser, useCurrentUser } from "@/lib/hooks/use-users";
import { Plus, Trash2, Tag, Columns, GitBranch, Users } from "lucide-react";
import { toast } from "sonner";

const TAG_COLORS = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E", "#06B6D4",
  "#3B82F6", "#8B5CF6", "#EC4899", "#6B7280", "#1F2937",
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your CRM — team, tags, custom fields, and pipelines.
        </p>
      </div>

      <Tabs defaultValue="team">
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
      </Tabs>
    </div>
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

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    const name = newLabel.trim().toLowerCase().replace(/\s+/g, "_");
    createField.mutate(
      {
        entityType: entityFilter,
        name,
        label: newLabel.trim(),
        fieldType: newFieldType,
      },
      {
        onSuccess: () => {
          toast.success("Field created");
          setCreateOpen(false);
          setNewLabel("");
          setNewFieldType("text");
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
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
                </SelectContent>
              </Select>
            </div>
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipelines</CardTitle>
        <CardDescription>
          View pipeline stages. Manage deals from the Pipeline page.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !pipelines || pipelines.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No pipelines configured.
          </p>
        ) : (
          <div className="space-y-6">
            {pipelines.map(
              (pipeline: {
                id: string;
                name: string;
                type: string;
                stages?: { id: string; name: string; position: number; color: string | null; probability: number | null }[];
              }) => (
                <div key={pipeline.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-medium">{pipeline.name}</h3>
                    <Badge variant="outline">{pipeline.type.replace("_", " ")}</Badge>
                  </div>
                  {pipeline.stages && pipeline.stages.length > 0 ? (
                    <div className="flex items-center gap-1 overflow-x-auto pb-2">
                      {pipeline.stages
                        .sort((a: { position: number }, b: { position: number }) => a.position - b.position)
                        .map(
                          (
                            stage: {
                              id: string;
                              name: string;
                              color: string | null;
                              probability: number | null;
                            },
                            i: number,
                            arr: unknown[]
                          ) => (
                            <div key={stage.id} className="flex items-center">
                              <div
                                className="rounded-md border px-3 py-2 text-sm whitespace-nowrap"
                                style={{
                                  borderColor: stage.color ?? undefined,
                                  color: stage.color ?? undefined,
                                }}
                              >
                                {stage.name}
                                {stage.probability != null && (
                                  <span className="ml-1 text-xs text-muted-foreground">
                                    ({stage.probability}%)
                                  </span>
                                )}
                              </div>
                              {i < arr.length - 1 && (
                                <span className="mx-1 text-muted-foreground">→</span>
                              )}
                            </div>
                          )
                        )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No stages</p>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

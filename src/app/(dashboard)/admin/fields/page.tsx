"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { FieldEditor } from "@/components/admin/field-editor";

const ENTITY_TABS = [
  { value: "contact", label: "Contacts" },
  { value: "deal", label: "Deals" },
  { value: "company", label: "Companies" },
];

interface FieldDef {
  id: string;
  entityType: string;
  name: string;
  label: string;
  fieldType: string;
  options: { value: string; label: string; color?: string }[] | null;
  isRequired: boolean;
  isVisibleInList: boolean;
  position: number;
}

export default function FieldsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("contact");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingField, setEditingField] = useState<FieldDef | null>(null);

  const { data: fields = [], isLoading } = useQuery<FieldDef[]>({
    queryKey: ["admin", "fields", activeTab],
    queryFn: async () => {
      const res = await fetch(`/api/admin/fields?entityType=${activeTab}`);
      if (!res.ok) throw new Error("Failed to fetch fields");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/admin/fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create field");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "fields"] });
      setEditorOpen(false);
      toast.success("Field created");
    },
    onError: () => toast.error("Failed to create field"),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/admin/fields", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update field");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "fields"] });
      setEditingField(null);
      toast.success("Field updated");
    },
    onError: () => toast.error("Failed to update field"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/fields?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "fields"] });
      toast.success("Field deleted");
    },
    onError: () => toast.error("Failed to delete field"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Custom Fields</h1>
          <p className="text-sm text-muted-foreground">
            Manage custom fields for each entity type.
          </p>
        </div>
        <Button onClick={() => setEditorOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Field
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {ENTITY_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {ENTITY_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>In List</TableHead>
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
                  {!isLoading && fields.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No custom fields for {tab.label.toLowerCase()}.
                      </TableCell>
                    </TableRow>
                  )}
                  {fields.map((field) => (
                    <TableRow key={field.id}>
                      <TableCell className="font-medium">{field.label}</TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono">
                        {field.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {field.fieldType.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>{field.isRequired ? "Yes" : "No"}</TableCell>
                      <TableCell>{field.isVisibleInList ? "Yes" : "No"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditingField(field)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => {
                              if (confirm(`Delete "${field.label}"?`)) {
                                deleteMutation.mutate(field.id);
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
          </TabsContent>
        ))}
      </Tabs>

      <FieldEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        entityType={activeTab}
        onSave={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
      />

      {editingField && (
        <FieldEditor
          open={!!editingField}
          onOpenChange={(open) => {
            if (!open) setEditingField(null);
          }}
          entityType={activeTab}
          initialData={editingField}
          onSave={(data) => updateMutation.mutate(data)}
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  );
}

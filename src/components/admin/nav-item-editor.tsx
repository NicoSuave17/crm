"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { IconPicker } from "./icon-picker";

const ALL_ROLES = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "account_manager", label: "Account Manager" },
  { value: "ae", label: "AE" },
  { value: "enterprise_sales", label: "Enterprise Sales" },
] as const;

interface NavItemEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    id?: string;
    label: string;
    icon: string;
    href: string;
    section: "main" | "bottom";
    roles: string[];
    isSystem?: boolean;
  };
  onSave: (data: {
    id?: string;
    label: string;
    icon: string;
    href: string;
    section: "main" | "bottom";
    roles: string[];
  }) => void;
  isPending?: boolean;
}

export function NavItemEditor({
  open,
  onOpenChange,
  initialData,
  onSave,
  isPending,
}: NavItemEditorProps) {
  const [label, setLabel] = useState(initialData?.label ?? "");
  const [icon, setIcon] = useState(initialData?.icon ?? "Circle");
  const [href, setHref] = useState(initialData?.href ?? "/");
  const [section, setSection] = useState<"main" | "bottom">(
    initialData?.section ?? "main"
  );
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    initialData?.roles ?? ALL_ROLES.map((r) => r.value)
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      id: initialData?.id,
      label,
      icon,
      href,
      section,
      roles: selectedRoles,
    });
  }

  function toggleRole(role: string) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initialData?.id ? "Edit Nav Item" : "Add Nav Item"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-end gap-3">
            <div>
              <Label>Icon</Label>
              <IconPicker value={icon} onChange={setIcon} />
            </div>
            <div className="flex-1">
              <Label>Label</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Nav item label"
                required
              />
            </div>
          </div>

          <div>
            <Label>URL Path</Label>
            <Input
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="/dashboard"
              required
            />
          </div>

          <div>
            <Label>Section</Label>
            <Select
              value={section}
              onValueChange={(v) => setSection(v as "main" | "bottom")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">Main</SelectItem>
                <SelectItem value="bottom">Bottom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-2 block">Role Access</Label>
            <div className="space-y-2">
              {ALL_ROLES.map((role) => (
                <label
                  key={role.value}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={selectedRoles.includes(role.value)}
                    onCheckedChange={() => toggleRole(role.value)}
                  />
                  {role.label}
                </label>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

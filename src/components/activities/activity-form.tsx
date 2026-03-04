"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateActivity } from "@/lib/hooks/use-activities";
import { toast } from "sonner";
import { MessageSquare, Phone, Mail, Calendar, Linkedin } from "lucide-react";

const activityTypes = [
  { value: "note", label: "Note", icon: MessageSquare },
  { value: "call", label: "Call", icon: Phone },
  { value: "email_sent", label: "Email", icon: Mail },
  { value: "meeting", label: "Meeting", icon: Calendar },
  { value: "linkedin_message", label: "LinkedIn", icon: Linkedin },
] as const;

interface ActivityFormProps {
  contactId?: string;
  dealId?: string;
  onSuccess?: () => void;
}

export function ActivityForm({ contactId, dealId, onSuccess }: ActivityFormProps) {
  const [type, setType] = useState<string>("note");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [duration, setDuration] = useState("");
  const createActivity = useCreateActivity();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() && !subject.trim()) return;

    createActivity.mutate(
      {
        type: type as "note" | "call" | "email_sent" | "meeting" | "linkedin_message",
        subject: subject || undefined,
        body: body || undefined,
        contactId,
        dealId,
        duration: duration ? parseInt(duration) : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Activity logged");
          setSubject("");
          setBody("");
          setDuration("");
          onSuccess?.();
        },
        onError: () => toast.error("Failed to log activity"),
      }
    );
  }

  const showDuration = type === "call" || type === "meeting";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        {activityTypes.map((t) => (
          <Button
            key={t.value}
            type="button"
            variant={type === t.value ? "default" : "outline"}
            size="sm"
            onClick={() => setType(t.value)}
            className="gap-1.5"
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </Button>
        ))}
      </div>
      <Input
        placeholder="Subject (optional)"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />
      <Textarea
        placeholder={
          type === "note"
            ? "Write a note..."
            : type === "call"
              ? "Call notes..."
              : "Details..."
        }
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
      />
      <div className="flex items-center gap-2">
        {showDuration && (
          <Input
            type="number"
            placeholder="Duration (min)"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-36"
          />
        )}
        <Button
          type="submit"
          size="sm"
          disabled={createActivity.isPending || (!body.trim() && !subject.trim())}
          className="ml-auto"
        >
          {createActivity.isPending ? "Saving..." : "Log Activity"}
        </Button>
      </div>
    </form>
  );
}

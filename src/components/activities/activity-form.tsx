"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateActivity } from "@/lib/hooks/use-activities";
import { useEmailTemplates } from "@/lib/hooks/use-email-templates";
import {
  interpolateTemplate,
  type TemplateContext,
} from "@/lib/utils/template-interpolation";
import type { CreateActivityInput } from "@/lib/validators/activity";
import { toast } from "sonner";
import { MessageSquare, Phone, Mail, Calendar, Linkedin, FileText } from "lucide-react";

const activityTypes = [
  { value: "note", label: "Note", icon: MessageSquare },
  { value: "call", label: "Call", icon: Phone },
  { value: "email_sent", label: "Email", icon: Mail },
  { value: "meeting", label: "Meeting", icon: Calendar },
  { value: "linkedin_message", label: "LinkedIn", icon: Linkedin },
] as const;

const OUTCOME_OPTIONS = [
  { value: "connected", label: "Connected" },
  { value: "no_answer", label: "No Answer" },
  { value: "left_voicemail", label: "Left Voicemail" },
  { value: "rescheduled", label: "Rescheduled" },
  { value: "positive", label: "Positive" },
  { value: "negative", label: "Negative" },
  { value: "neutral", label: "Neutral" },
  { value: "follow_up_needed", label: "Follow-up Needed" },
];

interface ActivityFormProps {
  contactId?: string;
  dealId?: string;
  companyId?: string;
  templateContext?: TemplateContext;
  onSuccess?: () => void;
}

export function ActivityForm({
  contactId,
  dealId,
  companyId,
  templateContext,
  onSuccess,
}: ActivityFormProps) {
  const [type, setType] = useState<string>("note");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [duration, setDuration] = useState("");
  const [outcome, setOutcome] = useState("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const createActivity = useCreateActivity();
  const { data: templates } = useEmailTemplates();

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
        companyId,
        duration: duration ? parseInt(duration) : undefined,
        outcome: outcome ? outcome as CreateActivityInput["outcome"] : undefined,
        nextFollowUpDate: nextFollowUpDate || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Activity logged");
          setSubject("");
          setBody("");
          setDuration("");
          setOutcome("");
          setNextFollowUpDate("");
          onSuccess?.();
        },
        onError: () => toast.error("Failed to log activity"),
      }
    );
  }

  function handleSelectTemplate(templateSubject: string, templateBody: string) {
    const ctx = templateContext ?? {};
    setSubject(interpolateTemplate(templateSubject, ctx));
    setBody(interpolateTemplate(templateBody, ctx));
    setTemplatePickerOpen(false);
  }

  const showDuration = type === "call" || type === "meeting";
  const showOutcome = type === "call" || type === "meeting";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2 flex-wrap">
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

      {type === "email_sent" && templates && templates.length > 0 && (
        <Popover open={templatePickerOpen} onOpenChange={setTemplatePickerOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              Use Template
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search templates..." />
              <CommandList>
                <CommandEmpty>No templates found.</CommandEmpty>
                <CommandGroup>
                  {templates.map((t) => (
                    <CommandItem
                      key={t.id}
                      onSelect={() =>
                        handleSelectTemplate(t.subject, t.body)
                      }
                    >
                      <span className="truncate">{t.name}</span>
                      {t.category && (
                        <Badge
                          variant="secondary"
                          className="ml-auto text-[10px] shrink-0"
                        >
                          {t.category}
                        </Badge>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

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
      {showOutcome && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger>
                <SelectValue placeholder="Outcome" />
              </SelectTrigger>
              <SelectContent>
                {OUTCOME_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            type="date"
            placeholder="Follow-up date"
            value={nextFollowUpDate}
            onChange={(e) => setNextFollowUpDate(e.target.value)}
          />
        </div>
      )}
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

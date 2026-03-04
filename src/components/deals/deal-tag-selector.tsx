"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTags, useAddTagToDeal, useRemoveTagFromDeal } from "@/lib/hooks/use-tags";
import { Plus, X, Check } from "lucide-react";

interface DealTagSelectorProps {
  dealId: string;
  currentTags: { id: string; name: string; color: string }[];
}

export function DealTagSelector({ dealId, currentTags }: DealTagSelectorProps) {
  const [open, setOpen] = useState(false);
  const { data: allTags } = useTags();
  const addTag = useAddTagToDeal();
  const removeTag = useRemoveTagFromDeal();

  const currentTagIds = new Set(currentTags.map((t) => t.id));

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">Tags</p>
      <div className="flex flex-wrap gap-1">
        {currentTags.map((tag) => (
          <Badge
            key={tag.id}
            variant="outline"
            style={{ borderColor: tag.color, color: tag.color }}
            className="pr-1"
          >
            {tag.name}
            <button
              onClick={() =>
                removeTag.mutate({ dealId, tagId: tag.id })
              }
              className="ml-1 hover:opacity-70"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            {!allTags || allTags.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2 text-center">
                No tags. Create them in Settings.
              </p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {allTags.map((tag: { id: string; name: string; color: string }) => {
                  const isActive = currentTagIds.has(tag.id);
                  return (
                    <button
                      key={tag.id}
                      className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                      onClick={() => {
                        if (isActive) {
                          removeTag.mutate({ dealId, tagId: tag.id });
                        } else {
                          addTag.mutate({ dealId, tagId: tag.id });
                        }
                      }}
                    >
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1 text-left">{tag.name}</span>
                      {isActive && <Check className="h-3 w-3 text-primary" />}
                    </button>
                  );
                })}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import {
  CalendarClock,
  GitBranch,
  Mail,
  MessageSquare,
  NotebookPen,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const tools = [
  { name: "Gmail", description: "Read and organize email", icon: Mail },
  {
    name: "Slack",
    description: "Keep your team in the loop",
    icon: MessageSquare,
  },
  {
    name: "Google Calendar",
    description: "Make time for what matters",
    icon: CalendarClock,
  },
  {
    name: "Notion",
    description: "Bring your knowledge together",
    icon: NotebookPen,
  },
  {
    name: "GitHub",
    description: "Follow code and project activity",
    icon: GitBranch,
  },
];

export function ToolsTab({ prefix }: { prefix: string }) {
  const [search, setSearch] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const query = search.trim().toLowerCase();
  const filtered = tools.filter((tool) =>
    `${tool.name} ${tool.description}`.toLowerCase().includes(query),
  );
  const searchId = `${prefix}-tool-search`;
  const helpId = `${prefix}-tools-help`;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Tool connections</h3>
        <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground">
          Coming later
        </span>
      </div>
      <p id={helpId} className="mt-1.5 text-xs leading-5 text-muted-foreground">
        Browse the services planned for your agent. Connections are not
        available yet.
      </p>
      <div className="relative mt-4">
        <Label htmlFor={searchId} className="sr-only">
          Search tools
        </Label>
        <Search
          className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          ref={searchInput}
          id={searchId}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Find a tool…"
          aria-describedby={helpId}
          maxLength={100}
          className="h-10 pr-10 pl-9"
        />
        {search && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1"
            aria-label="Clear tool search"
            onClick={() => {
              setSearch("");
              searchInput.current?.focus();
            }}
          >
            <X className="size-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
      <ul className="mt-2 divide-y divide-border">
        {filtered.map(({ name, description, icon: Icon }) => (
          <li key={name} className="flex items-center gap-3 py-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Icon
                className="size-[18px] text-muted-foreground"
                aria-hidden="true"
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium">{name}</p>
              <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                {description}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled
              aria-label={`Connect ${name}, coming later`}
              className="min-h-9 text-[11px]"
            >
              Connect
            </Button>
          </li>
        ))}
      </ul>
      {filtered.length === 0 && (
        <p
          role="status"
          className="py-8 text-center text-xs leading-5 break-words text-muted-foreground"
        >
          No tools match “{search}”. Try another name.
        </p>
      )}
      <p className="border-t border-border pt-3 text-[11px] leading-5 text-muted-foreground">
        No tools connected · Connection previews only
      </p>
    </div>
  );
}

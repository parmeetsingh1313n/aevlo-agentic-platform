"use client";

import {
  CalendarClock,
  Settings2,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralConfigTab } from "./general-config-tab";
import { ScheduleTab } from "./schedule-tab";
import { SettingsTab } from "./settings-tab";
import { ToolsTab } from "./tools-tab";

const sections = [
  { value: "general", label: "General", icon: SlidersHorizontal },
  { value: "tools", label: "Tools", icon: Wrench },
  { value: "schedule", label: "Schedule", icon: CalendarClock },
  { value: "settings", label: "Settings", icon: Settings2 },
];

export function ConfigurationTabs({
  active,
  onToggle,
  prefix,
}: {
  active: boolean;
  onToggle: () => void;
  prefix: string;
}) {
  return (
    <Tabs defaultValue="general" className="gap-0">
      <TabsList
        activateOnFocus
        aria-label="Agent configuration sections"
        className="grid h-11! w-full grid-cols-4 rounded-none bg-transparent p-0"
      >
        {sections.map(({ value, label, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="h-10 gap-1.5 rounded-lg px-1 text-[11px] shadow-none! data-active:bg-muted! data-active:text-foreground"
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="general" className="pt-5">
        <GeneralConfigTab prefix={prefix} />
      </TabsContent>
      <TabsContent value="tools" className="pt-5">
        <ToolsTab prefix={prefix} />
      </TabsContent>
      <TabsContent value="schedule" className="pt-5">
        <ScheduleTab />
      </TabsContent>
      <TabsContent value="settings" className="pt-5">
        <SettingsTab active={active} onToggle={onToggle} prefix={prefix} />
      </TabsContent>
    </Tabs>
  );
}

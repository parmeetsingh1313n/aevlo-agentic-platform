"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import type { AgentListEntry } from "@/lib/workspace-ui";
import { AppSidebar } from "./app-sidebar";

export function WorkspaceShell({
  children,
  agents = [],
}: {
  children: React.ReactNode;
  agents?: AgentListEntry[];
}) {
  const pathname = usePathname();
  const creatingAgent = pathname === "/workspace/create-agent";

  return (
    <SidebarProvider>
      <a href="#workspace-content" className="sr-only fixed top-3 left-3 z-50 rounded-md bg-background px-4 py-2 focus:not-sr-only">Skip to content</a>
      <AppSidebar agents={agents} />
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 md:px-8">
          <nav className="flex min-w-0 items-center gap-3 text-sm" aria-label="Breadcrumb">
            <SidebarTrigger className="size-9 motion-reduce:transition-none" />
            <Link href="/workspace" className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              aria-current={creatingAgent ? undefined : "page"}>Workspace</Link>
            {creatingAgent && <><ChevronRight size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" /><span aria-current="page" className="truncate">New agent</span></>}
          </nav>
          <ThemeToggle />
        </header>
        <main id="workspace-content" className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </SidebarProvider>
  );
}

"use client";

import Link from "next/link";
import { ChevronUp, LogOut, Plus, Store } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { BrandMark } from "@/components/brand";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupLabel, SidebarHeader, SidebarSeparator, useSidebar,
} from "@/components/ui/sidebar";
import { AgentList } from "./agent-list";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { getProfileInitials } from "@/lib/workspace-ui";
import type { AgentListEntry } from "@/lib/workspace-ui";

export function AppSidebar({ agents = [], activeAgentId }: { agents?: AgentListEntry[]; activeAgentId?: string }) {
  const { data, status } = useSession();
  const { setOpenMobile } = useSidebar();
  const user = data?.user;

  return (
    <Sidebar collapsible="offcanvas" aria-label="Workspace navigation">
      <SidebarHeader className="gap-5 px-4 pt-6 pb-3">
        <Link href="/workspace" onClick={() => setOpenMobile(false)}
          aria-label="Aevlo workspace"
          className="flex w-fit items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          <BrandMark className="size-9 text-primary" />
          <span className="font-heading text-[27px] font-semibold tracking-[-0.025em]">{brand.name.toLowerCase()}</span>
        </Link>
        <Link href="/workspace/create-agent" onClick={() => setOpenMobile(false)}
          className={cn(buttonVariants({ size: "lg" }), "h-10 w-full justify-start gap-2 px-3 motion-reduce:transition-none")}>
          <Plus size={17} aria-hidden="true" /> Create new agent
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-4 pt-3">
          <SidebarGroupLabel className="px-0 text-xs">Your agents</SidebarGroupLabel>
          <AgentList agents={agents} activeAgentId={activeAgentId} onNavigate={() => setOpenMobile(false)} />
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-3 px-4 pb-4">
        <div className="flex items-center gap-2.5 px-1 py-2 text-sm text-muted-foreground" aria-label="Marketplace, coming soon">
          <Store size={17} aria-hidden="true" />
          <span>Marketplace</span><span className="ml-auto text-xs">Soon</span>
        </div>
        <SidebarSeparator className="mx-0 w-full" />
        {status === "loading" ? (
          <div role="status" className="flex min-h-12 items-center text-sm text-muted-foreground">Loading your profile…</div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Open account menu"
              className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-ring">
              <Avatar>
                {user?.image && <AvatarImage src={user.image} alt="" />}
                <AvatarFallback>{getProfileInitials(user?.name, user?.email)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{user?.name || "Your account"}</span>
                <span className="block truncate text-xs text-muted-foreground">{user?.email || "Signed in"}</span>
              </span>
              <ChevronUp size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="min-w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => void signOut({ callbackUrl: "/sign-in" })}>
                  <LogOut aria-hidden="true" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

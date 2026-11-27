import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getProfileInitials } from "@/lib/workspace-ui";
import type { AgentListEntry } from "@/lib/workspace-ui";

export function AgentList({ agents }: { agents: AgentListEntry[] }) {
  if (agents.length === 0) {
    return <p className="px-0 py-2 text-sm text-muted-foreground">No agents yet.</p>;
  }

  return (
    <ul aria-label="Your agents" className="flex flex-col gap-0.5">
      {agents.map((agent) => (
        <li key={agent.agentId}>
          <Link
            href={`/workspace/${agent.agentId}`}
            className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Avatar size="sm">
              <AvatarImage src={agent.agentImage} alt="" />
              <AvatarFallback>{getProfileInitials(agent.name)}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate">{agent.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

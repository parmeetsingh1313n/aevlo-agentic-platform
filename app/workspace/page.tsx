import { getServerSession } from "next-auth";
import { WorkspaceEmptyState } from "@/components/custom/workspace/workspace-empty-state";
import { listAgentsForUser } from "@/db/agents";
import { authOptions } from "@/lib/auth";

export default async function WorkspacePage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  const agents = email ? await listAgentsForUser(email) : [];

  return <WorkspaceEmptyState agentCount={agents.length} />;
}

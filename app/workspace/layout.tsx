import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/custom/workspace/workspace-shell";
import { listAgentsForUser } from "@/db/agents";
import { authOptions } from "@/lib/auth";
import { toAgentListEntries } from "@/lib/workspace-ui";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) redirect("/sign-in?callbackUrl=%2Fworkspace");

  // The sidebar lists the signed-in owner's own agents, newest first.
  const agents = toAgentListEntries(await listAgentsForUser(email));

  return <WorkspaceShell agents={agents}>{children}</WorkspaceShell>;
}

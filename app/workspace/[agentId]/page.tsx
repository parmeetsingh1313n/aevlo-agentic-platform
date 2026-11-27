import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { AgentSpaceView } from "@/components/custom/workspace/agent-space-view";
import { getAgentForUser } from "@/db/agents";
import { authOptions } from "@/lib/auth";
import { loadAgentSpace } from "@/lib/agent-space";

export default async function AgentSpacePage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  const session = await getServerSession(authOptions);
  const state = await loadAgentSpace({
    email: session?.user?.email,
    agentId,
    find: getAgentForUser,
  });

  if (state.kind === "missing") notFound();

  return (
    <AgentSpaceView
      agent={{
        agentId: state.agent.agentId,
        name: state.agent.name,
        description: state.agent.description,
        agentImage: state.agent.agentImage,
        createdAt: state.agent.createdAt.toISOString(),
        version: state.agent.version,
      }}
    />
  );
}

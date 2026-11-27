import { AgentSpace } from "@/components/custom/agent-space/agent-space";
import type { PreviewAgent } from "@/lib/agent-preview";

export type AgentSpaceAgent = PreviewAgent;

export function AgentSpaceView({ agent }: { agent: AgentSpaceAgent }) {
  return <AgentSpace key={agent.agentId} agent={agent} />;
}

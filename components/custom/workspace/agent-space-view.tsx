import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Bot, MessageSquare } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AgentSpaceAgent = {
  agentId: string;
  name: string;
  description: string | null;
  agentImage: string;
  createdAt: string;
};

export function AgentSpaceView({ agent }: { agent: AgentSpaceAgent }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col px-5 py-7 sm:px-9 lg:px-14">
      <header className="flex items-start gap-4">
        <Image
          src={agent.agentImage}
          alt=""
          width={56}
          height={56}
          unoptimized
          className="size-14 shrink-0 rounded-full border border-border object-contain"
        />
        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-semibold tracking-[-0.025em] sm:text-[34px]">{agent.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Saved agent</p>
        </div>
      </header>

      <div className="mt-6 flex min-h-0 flex-1 flex-col gap-5 lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <MessageSquare size={16} className="text-muted-foreground" aria-hidden="true" />
            <h2 className="text-sm font-medium">Chat</h2>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <Bot size={34} strokeWidth={1.4} className="text-primary" aria-hidden="true" />
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              Chat is not available yet. This agent is saved and ready, but talking to it arrives with the next chapter.
            </p>
          </div>
        </div>

        <aside className="w-full shrink-0 rounded-xl border border-border bg-card lg:w-80">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-medium">Instructions</h2>
          </div>
          <div className="px-4 py-4">
            <p className={cn("text-sm leading-6", agent.description ? "text-foreground" : "text-muted-foreground")}>
              {agent.description || "No instructions were added for this agent."}
            </p>
          </div>
        </aside>
      </div>

      <div className="mt-6">
        <Link href="/workspace" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "gap-2")}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to workspace
        </Link>
      </div>
    </section>
  );
}

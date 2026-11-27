import Link from "next/link";
import { Bot, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function WorkspaceEmptyState({ agentCount }: { agentCount: number }) {
  if (agentCount > 0) {
    return (
      <section className="flex flex-1 flex-col px-5 py-7 sm:px-9 lg:px-14">
        <h1 className="font-heading text-3xl font-semibold tracking-[-0.025em] sm:text-[34px]">Your workspace</h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          You have {agentCount} {agentCount === 1 ? "agent" : "agents"}. Open one from the sidebar, or create another.
        </p>
        <Link href="/workspace/create-agent" className={`${buttonVariants({ size: "lg" })} mt-6 h-10 w-fit gap-2 px-4`}>
          <Plus size={16} aria-hidden="true" /> Create new agent
        </Link>
      </section>
    );
  }

  return (
    <section className="flex flex-1 flex-col px-5 py-7 sm:px-9 lg:px-14">
      <h1 className="font-heading text-3xl font-semibold tracking-[-0.025em] sm:text-[34px]">Your workspace</h1>
      <div className="my-auto max-w-xl py-16">
        <Bot size={38} strokeWidth={1.4} className="mb-6 text-primary" aria-hidden="true" />
        <h2 className="font-heading text-2xl font-medium tracking-[-0.02em]">Start with your first agent.</h2>
        <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">
          Give it a name, choose an avatar, and describe the work you have in mind.
        </p>
        <Link href="/workspace/create-agent" className={`${buttonVariants({ size: "lg" })} mt-6 h-10 gap-2 px-4`}>
          <Plus size={16} aria-hidden="true" /> Create new agent
        </Link>
      </div>
    </section>
  );
}

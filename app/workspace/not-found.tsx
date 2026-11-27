import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function WorkspaceNotFound() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center px-5 py-16 text-center sm:px-9 lg:px-14">
      <p className="text-sm font-medium text-primary">Not found</p>
      <h1 className="mt-3 font-heading text-3xl font-semibold tracking-[-0.025em] sm:text-[34px]">
        We couldn&rsquo;t find that agent.
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
        It may belong to another account, or it may have been removed. Your own agents are listed in the sidebar.
      </p>
      <Link href="/workspace" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-6")}>
        Back to workspace
      </Link>
    </section>
  );
}

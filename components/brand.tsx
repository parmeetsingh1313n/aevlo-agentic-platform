import Link from "next/link";
import type { SVGProps } from "react";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** An original folded A: two rising strokes and an open crossbar. */
export function BrandMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
      <path d="M3 25 14.5 5h6.7L9.7 25H3Z" fill="currentColor" />
      <path d="m20.1 11.7 8 13.3h-7.4l-4.3-7.2 3.7-6.1Z" fill="currentColor" />
      <path d="M12.3 20h6.8l-2.9 5H9.4l2.9-5Z" fill="currentColor" />
    </svg>
  );
}

export function Brand({ className = "" }: { className?: string }) {
  return (
    <Link href="/" aria-label="Aevlo home" className={cn("inline-flex w-fit items-center gap-2.5", className)}>
      <BrandMark className="size-8 text-primary" />
      <span className="font-heading text-[29px] leading-none font-semibold tracking-[-0.06em]">
        {brand.name.toLowerCase()}
      </span>
    </Link>
  );
}

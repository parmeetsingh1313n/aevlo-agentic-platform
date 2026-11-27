"use client";
import Image from "next/image";
import { useState, useSyncExternalStore } from "react";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
function subscribe(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const serverMotion = () => true;
export function AgentAvatar({
  src,
  size = 44,
  className,
}: {
  src: string;
  size?: number;
  className?: string;
}) {
  const reduced = useSyncExternalStore(
    subscribe,
    prefersReducedMotion,
    serverMotion,
  );
  const [failed, setFailed] = useState<string | null>(null);
  const displaySrc = reduced
    ? src.replace(/([?&])tags=animation&?/, "$1").replace(/[?&]$/, "")
    : src;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl bg-muted",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {failed === displaySrc ? (
        <Bot
          className="size-6 text-muted-foreground"
          aria-label="Agent avatar unavailable"
        />
      ) : (
        <Image
          src={displaySrc}
          alt=""
          width={size}
          height={size}
          unoptimized
          className="h-full w-full object-contain"
          onError={() => setFailed(displaySrc)}
        />
      )}
    </span>
  );
}

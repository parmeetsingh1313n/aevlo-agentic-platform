"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAgentConfig } from "@/context/agent-config-context";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  installNavigationHistory,
  leaveAgentHistory,
  prepareNavigationHistory,
  registerAgentHistoryGuard,
  type AgentHistoryIntent,
} from "@/lib/agent-navigation";

type NavigationIntent =
  | { kind: "link"; href: string }
  | { kind: "history"; intent: AgentHistoryIntent };

export function NavigationHistoryTracker() {
  useLayoutEffect(prepareNavigationHistory, []);
  useEffect(() => {
    const timer = window.setTimeout(installNavigationHistory, 0);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}

export function AgentNavigationGuard() {
  const { dirty, saving, discard, state } = useAgentConfig();
  const router = useRouter();
  const [navigation, setNavigation] = useState<NavigationIntent | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const keepEditing = useRef<HTMLButtonElement | null>(null);
  const allowNavigation = useRef(false);

  useLayoutEffect(() => {
    if (!dirty && !saving) return;
    allowNavigation.current = false;
    const unregister = registerAgentHistoryGuard((intent) => {
      trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setNavigation({ kind: "history", intent });
    });
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (allowNavigation.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const intercept = (event: MouseEvent) => {
      if (allowNavigation.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const target = new URL(link.href, window.location.href);
      if (target.origin !== window.location.origin || (target.pathname === window.location.pathname && target.search === window.location.search)) return;
      event.preventDefault();
      event.stopPropagation();
      trigger.current = link;
      setNavigation({ kind: "link", href: target.pathname + target.search + target.hash });
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", intercept, true);
    return () => {
      unregister();
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", intercept, true);
    };
  }, [dirty, saving]);

  function leave() {
    if (!navigation || saving) return;
    allowNavigation.current = true;
    discard();
    setNavigation(null);
    if (navigation.kind === "history") leaveAgentHistory(navigation.intent);
    else router.push(navigation.href);
  }

  return (
    <AlertDialog open={navigation !== null} onOpenChange={(open) => { if (!open) setNavigation(null); }}>
      <AlertDialogContent initialFocus={keepEditing} finalFocus={trigger} className="motion-reduce:animate-none motion-reduce:transition-none">
        <AlertDialogHeader>
          <AlertDialogTitle>{saving ? "Saving your changes" : dirty ? "Leave without saving?" : "Leave this agent?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {saving
              ? "Wait for this save to finish before leaving the agent."
              : !dirty && state.phase === "saved"
                ? "Your changes are saved. You can stay with this agent or leave."
                : dirty
                  ? "Your agent has unsaved edits. Stay to save them, or discard them and leave."
                  : "Your draft has no unsaved changes. You can stay with this agent or leave."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button ref={keepEditing} variant="outline" onClick={() => setNavigation(null)}>Keep editing</Button>
          <Button disabled={saving} onClick={leave}>Discard and leave</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

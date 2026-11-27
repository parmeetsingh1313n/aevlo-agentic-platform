"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Bot, Loader2, Shuffle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { agentSpacePath, buildCreateAgentRequest } from "@/lib/agent-space";
import { getAgentAvatarUrl } from "@/lib/workspace-ui";
import { isAgentId, MAX_AGENT_DESCRIPTION_LENGTH, MAX_AGENT_NAME_LENGTH, type AgentFieldErrors } from "@/lib/agent-validation";

const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeMotionPreference(callback: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const getReducedMotion = () => window.matchMedia(motionQuery).matches;
const getServerReducedMotion = () => true;

export function CreateAgentForm() {
  const router = useRouter();
  const [avatarSeed, setAvatarSeed] = useState("aevlo");
  const [failedAvatarSeed, setFailedAvatarSeed] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AgentFieldErrors>({});
  const pending = useRef(false);
  const creationRequest = useRef<{ id: string; signature: string } | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const reducedMotion = useSyncExternalStore(subscribeMotionPreference, getReducedMotion, getServerReducedMotion);

  useEffect(() => () => activeRequest.current?.abort(), []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setError(null);
    setFieldErrors({});
    if (!name.trim()) { setFieldErrors({ name: "Enter an agent name." }); return; }

    const details = { name: name.trim(), description: description.trim(), agentImage: getAgentAvatarUrl(avatarSeed) };
    const signature = JSON.stringify(details);
    if (creationRequest.current?.signature !== signature) creationRequest.current = { id: crypto.randomUUID(), signature };
    const controller = new AbortController();
    activeRequest.current = controller;
    pending.current = true;
    setSaving(true);
    try {
      const response = await fetch("/api/agent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCreateAgentRequest({ agentId: creationRequest.current.id, ...details })), signal: controller.signal,
      });
      const result = await response.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/sign-in?callbackUrl=%2Fworkspace%2Fcreate-agent");
          return;
        }
        if (result?.fieldErrors && typeof result.fieldErrors === "object") {
          const fields: AgentFieldErrors = {};
          for (const key of ["name", "description", "agentImage", "agentId"] as const) {
            if (typeof result.fieldErrors[key] === "string") fields[key] = result.fieldErrors[key];
          }
          setFieldErrors(fields);
        }
        setError(typeof result?.error === "string" ? result.error : "We couldn’t save your agent. Please try again.");
        return;
      }
      if (!isAgentId(result?.agent?.agentId)) throw new Error("Invalid creation response");
      const destination = agentSpacePath(result.agent.agentId);
      if (!destination) throw new Error("Invalid creation response");
      router.push(destination);
      router.refresh();
    } catch {
      if (!controller.signal.aborted) setError("Couldn’t reach the save service. Check your connection and try again.");
    } finally {
      pending.current = false;
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  return (
    <section className="w-full px-5 py-6 sm:px-9 lg:px-14">
      <header>
        <h1 className="font-heading text-3xl font-semibold tracking-[-0.025em] sm:text-[34px]">Create new agent</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">Customize your agent and give it a clear purpose.</p>
      </header>

      <form className="mx-auto mt-6 w-full max-w-xl" aria-label="New agent details" aria-busy={saving} onSubmit={onSubmit}>
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex size-28 items-center justify-center" aria-live="polite">
            {failedAvatarSeed === avatarSeed ? (
              <Bot className="size-16 text-primary" aria-label="Agent avatar unavailable" />
            ) : (
              <Image key={`${avatarSeed}-${reducedMotion}`} src={getAgentAvatarUrl(avatarSeed, !reducedMotion)}
                alt="Selected agent avatar" width={112} height={112} unoptimized
                className="size-28 object-contain" onError={() => setFailedAvatarSeed(avatarSeed)} />
            )}
          </div>
          <Button type="button" variant="outline" disabled={saving} className="h-9 gap-2 px-3 motion-reduce:transition-none"
            onClick={() => setAvatarSeed(crypto.randomUUID())}>
            <Shuffle size={15} aria-hidden="true" /> Shuffle avatar
          </Button>
          {failedAvatarSeed === avatarSeed && <p className="text-xs text-muted-foreground">Avatar couldn’t load. Shuffle to try again.</p>}
          {fieldErrors.agentImage && <p role="alert" className="text-xs text-destructive">{fieldErrors.agentImage}</p>}
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="agent-name">Agent name</Label>
            <Input id="agent-name" name="name" value={name} disabled={saving}
              onChange={(event) => { setName(event.target.value); setFieldErrors((fields) => ({ ...fields, name: undefined })); }}
              placeholder="Enter agent name" maxLength={MAX_AGENT_NAME_LENGTH} required autoComplete="off"
              aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "agent-name-error" : undefined} className="h-11 bg-card px-3" />
            {fieldErrors.name && <p id="agent-name-error" role="alert" className="text-xs text-destructive">{fieldErrors.name}</p>}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="agent-description">Instructions / Description</Label>
              <span className="text-xs text-muted-foreground">Optional</span>
            </div>
            <Textarea id="agent-description" name="description" value={description} disabled={saving}
              onChange={(event) => { setDescription(event.target.value); setFieldErrors((fields) => ({ ...fields, description: undefined })); }} maxLength={MAX_AGENT_DESCRIPTION_LENGTH}
              aria-invalid={Boolean(fieldErrors.description)} aria-describedby={fieldErrors.description ? "description-limit agent-description-error" : "description-limit"} className="min-h-28 resize-y bg-card px-3 py-3"
              placeholder="Describe what this agent should do, its personality, goals, or special instructions…" />
            <p id="description-limit" className="text-right text-xs text-muted-foreground tabular-nums">{description.length} / 1000</p>
            {fieldErrors.description && <p id="agent-description-error" role="alert" className="text-xs text-destructive">{fieldErrors.description}</p>}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <Link href="/workspace" aria-disabled={saving} tabIndex={saving ? -1 : undefined}
            onClick={(event) => { if (saving) event.preventDefault(); }}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), saving && "pointer-events-none opacity-50")}>Cancel</Link>
          <Button type="submit" size="lg" disabled={saving || !name.trim()}>
            {saving && <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}
            {saving ? "Creating…" : "Create agent"}
          </Button>
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        <p className="mt-4 text-right text-xs text-muted-foreground">Saved agents appear in your sidebar.</p>
      </form>
    </section>
  );
}

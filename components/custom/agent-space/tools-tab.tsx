"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, GitBranch, Mail, MessageSquare, NotebookPen, Search, RefreshCw, ExternalLink, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AgentToolStatus } from "@/lib/tool-catalog";
const icons = { gmail: Mail, slack: MessageSquare, googlecalendar: CalendarClock, github: GitBranch, notion: NotebookPen, googledocs: NotebookPen, reddit: MessageSquare };
type ToolState = { tools: AgentToolStatus[]; configured: boolean; connectionError: string };
export function ToolsTab({ prefix, agentId }: { prefix: string; agentId?: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [state, setState] = useState<ToolState>({ tools: [], configured: false, connectionError: "" });
  const [loading, setLoading] = useState(Boolean(agentId));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [connectionLink, setConnectionLink] = useState<{ name: string; url: string } | null>(null);
  const lock = useRef(false);
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async (signal: AbortSignal): Promise<ToolState> => {
    const response = await fetch("/api/agent/tools?agentId=" + encodeURIComponent(agentId ?? ""), { cache: "no-store", signal });
    const body = await response.json();
    if (!response.ok || !Array.isArray(body.tools)) throw new Error(body.error || "We couldn’t load your tools.");
    return body;
  }, [agentId]);
  async function refresh() {
    if (!agentId) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const body = await load(controller.signal);
      if (!controller.signal.aborted) { setState(body); router.refresh(); }
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "We couldn’t load your tools.");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }
  useEffect(() => {
    if (!agentId) return;
    const controller = new AbortController(); request.current = controller;
    void load(controller.signal).then((body) => {
      if (!controller.signal.aborted) { setState(body); router.refresh(); }
    }).catch((error) => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "We couldn’t load your tools.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => request.current?.abort();
  }, [load, agentId, router]);
  async function change(tool: AgentToolStatus, action: "enable" | "connect") {
    if (!agentId || lock.current || loading) return;
    lock.current = true; setBusy(tool.slug); setError(""); setConnectionLink(null);
    const controller = new AbortController(); request.current = controller;
    try {
      const response = await fetch("/api/agent/tools", {
        method: action === "connect" ? "POST" : "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, slug: tool.slug, ...(action === "enable" ? { enabled: !tool.enabled } : {}) }),
        signal: controller.signal, cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "We couldn’t update this tool.");
      if (controller.signal.aborted) return;
      if (action === "connect") {
        const url = new URL(body.redirectUrl);
        if (url.protocol !== "https:") throw new Error("The connection link is unavailable.");
        setConnectionLink({ name: tool.name, url: url.href });
      } else {
        setState((previous) => ({ ...previous, tools: previous.tools.map((item) => ({ ...item, enabled: body.tools.includes(item.slug) })) }));
        setLoading(true); await refresh();
      }
    } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "We couldn’t update this tool."); }
    finally { lock.current = false; setBusy(""); }
  }
  const query = search.trim().toLowerCase();
  const filtered = state.tools.filter((tool) => (tool.isActive || tool.enabled) && (tool.name + " " + tool.description + " " + tool.category).toLowerCase().includes(query));
  const disabled = Boolean(busy) || loading;
  return <div>
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold">Tool connections</h3>
      <Button type="button" variant="ghost" size="icon" aria-label="Refresh tool connections" disabled={disabled} onClick={() => { setLoading(true); setError(""); void refresh(); }}><RefreshCw size={15} aria-hidden="true" /></Button>
    </div>
    <p className="mt-1 text-xs leading-5 text-muted-foreground">Choose the services this agent can use. Connect your account to give it access.</p>
    <div className="relative mt-4">
      <Label htmlFor={prefix + "-tool-search"} className="sr-only">Search tools</Label>
      <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" aria-hidden="true" />
      <Input id={prefix + "-tool-search"} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a tool…" maxLength={100} className="h-10 pl-9" />
    </div>
    {loading && <p role="status" className="flex items-center gap-2 py-5 text-xs text-muted-foreground"><LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Checking your tools…</p>}
    {error && <p role="alert" className="mt-3 text-xs leading-5 text-destructive">{error}</p>}
    {state.connectionError && <p role="status" className="mt-3 text-xs leading-5 text-muted-foreground">{state.connectionError}</p>}
    {!loading && !state.configured && agentId && <p className="mt-3 text-xs leading-5 text-muted-foreground">Connections need to be configured by your workspace administrator.</p>}
    {connectionLink && <div className="mt-4 rounded-lg border border-border p-3 text-xs leading-5" role="status">
      <p>Finish connecting {connectionLink.name}, then refresh the connections here.</p>
      <a href={connectionLink.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-10 items-center gap-2 font-semibold text-primary underline underline-offset-4">Authorize {connectionLink.name}<ExternalLink size={13} aria-hidden="true" /></a>
    </div>}
    <ul className="mt-2 divide-y divide-border">
      {filtered.map((tool) => { const Icon = icons[tool.slug as keyof typeof icons] ?? NotebookPen;
        return <li key={tool.slug} className="py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon size={18} className="text-muted-foreground" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1"><p className="text-[13px] font-medium">{tool.name}</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{tool.description}</p></div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 pl-12">
            <label className="flex min-h-10 cursor-pointer items-center gap-2 text-xs"><input type="checkbox" checked={tool.enabled} disabled={disabled || (!tool.isActive && !tool.enabled)} onChange={() => void change(tool, "enable")} className="size-4 accent-primary" aria-label={"Enable " + tool.name + " for this agent"} />{!tool.isActive ? "Unavailable · Disable" : tool.enabled ? "Enabled" : "Use this tool"}</label>
            {tool.enabled && tool.isActive && <Button type="button" size="sm" variant="outline" disabled={disabled || !state.configured || tool.connected} onClick={() => void change(tool, "connect")} className="min-h-10 text-xs">{busy === tool.slug ? "Working…" : tool.connected ? "Connected" : "Connect"}</Button>}
          </div>
        </li>;
      })}
    </ul>
    {!loading && !error && !filtered.length && <p role="status" className="py-6 text-center text-xs leading-5 text-muted-foreground">{search ? "No tools match “" + search + "”." : "No tools are available yet."}</p>}
    <p className="border-t border-border pt-3 text-xs leading-5 text-muted-foreground">Tool choices save immediately. Account connections are shared across your agents; each agent uses only its enabled services.</p>
  </div>;
}

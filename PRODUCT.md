# Aevlo

## Product and working context

Aevlo is a web workspace for personal AI agents, connected tools, and recurring work. Development proceeds through focused feature increments with implementation, verification and supporting architecture notes.

The current feature set includes agent creation, persistent configuration, Agent SDK chat, Composio integration selection and connection setup, and guided questions with selectable answers and custom text. The configuration editor saves the selected agent's name, avatar and combined instructions/description with explicit Save. Chat uses the user's MiniMax-M3.1-Flash provider and saved instructions. Chapter 09 replaces the earlier Grok route at the user's request. Live text, automatic/forced native function calls, and a harmless Agents SDK function round trip passed with HTTP 200. The signed-in browser flow passed a live guided question and its continued answer; full lint, TypeScript, production build and 133 automated tests passed, with three optional checks skipped.

## Platform and primary tasks

- Platform: browser-based application, usable on desktop/laptop and mobile.
- Workspace mode: **Operate**. People create and navigate saved agents, chat with them, and edit and save configuration.
- Current journey: authenticate, create an agent, save its instructions, choose integrations in Tools, authorize needed app accounts, and send a message. General, Tools, Schedule, and Settings remain accessible.
- Agent creation and explicitly saved name/avatar/instructions persist. Tool selections save immediately and independently of profile Save. Conversation messages and guided answers stay in browser memory. Pause controls message entry; clearing starts a fresh conversation and stops any pending reply.

## Current capabilities and boundaries

- Next.js App Router, React, Tailwind, and the existing shadcn/Base UI primitives supply the application.
- NextAuth uses Google/GitHub OAuth and JWT sessions. An awaited sign-in callback saves or updates the authenticated profile in PostgreSQL's `users` table through Drizzle.
- The workspace route family is protected by the proxy and a server-layout session check. Client session context supplies the real account footer; it does not enforce authorization alone.
- The authenticated create/list/detail/update API and agent table exist; the sidebar loads the owner's real saved agents. Detail lookup and updates check both authenticated owner and agent ID. Updates allow only name, avatar and combined instructions, preserving identity, owner and creation time.
- The chat/configuration interface uses the real saved identity. Its example conversation is labeled and excluded from model input. Sending adds a user turn, shows thinking, and appends a completed reply or validated guided-question card. Questions are limited to missing details that materially change the result. Ordinary provider errors can be retried without duplicating user turns; unknown outcomes or failures after an external tool invocation require checking the result and starting a new conversation. Leaving or clearing prevents late responses entering another conversation.
- Authenticated POST `/api/agent/chat` validates bounded, alternating text history and retrieves the agent by both owner email and agent ID. Saved name/instructions supply the SDK configuration. `AGENT_API_KEY` stays on the server, with the earlier `NEW_API_KEY` name accepted as a fallback; the SDK uses Chat Completions at `https://api.hcnsec.cn/v1` with `MiniMax-M3.1-Flash`, temperature 0.7 and tracing disabled. Guided questions use a native local tool or validated JSON envelope; external tools use a typed core-to-Agents bridge. No conversation persistence or token streaming is introduced.
- Tools contain seven persisted integrations: Gmail, Slack, Google Calendar, Notion, GitHub, Google Docs, and Reddit. Authenticated GET/PUT/POST `/api/agent/tools` provides catalog/readiness, atomic per-tool selection, and app authorization links. A selected toolkit is distinct from an active connection. `COMPOSIO_API_KEY` stays server-only; sessions use a stable hashed user scope, exact selected-tool policy, and conditional persistence. Live Composio session creation, tool retrieval, and reuse passed. Native MiniMax calls are verified with a harmless local function; no live external app action is claimed.
- Chapter 09's tools table and agent toolkit/session columns have been applied to PostgreSQL. Scheduling, routine management, duplication and deletion remain unavailable. Marketplace, persisted history, sandbox desktops and deployment remain planned capabilities.
- Explicit profile Save has inline validation, a fixed save dock, keyboard submission, draft preservation during pending requests, unknown-outcome verification and conflict recovery. Navigation protects dirty or pending edits. Before writing, Save reads the owned profile and accepts a newer version only when its saved editable fields still match. Tool/session changes can therefore advance the token without discarding the draft; real concurrent profile edits still require conflict recovery. Failed verification preserves earlier unknown-save intent. Profile edits still require Save.
- User credits default to five. The existing NextAuth sign-in persistence flow remains in use.

## Established product identity

Preserve the user's Aevlo name, original brand mark, current light/dark tokens, and existing interface styling. The implementation's current tokens and components are the authority; historical proposals are not a request for a new visual identity.

- Manrope: body and controls.
- Bricolage Grotesque: headings and brand lettering.
- IBM Plex Mono: code and machine-readable information where needed.
- Retain the existing color roles and theme toggle.
- Desktop chat and configuration scroll independently; smaller screens reveal configuration through an accessible drawer.
- Use saved DiceBear 10.x Gaze avatars with failure fallbacks and reduced-motion handling. Seeds are opaque identifiers, not personal profile data.

## Quality and verification

Show availability truthfully; do not imply that an example, draft, or disabled feature has been saved or executed. Keep secrets on the server and outside committed files. Preserve reduced-motion preferences, keyboard focus, accessible labels, and a usable mobile drawer.

Keep the composer and configuration actions reachable on laptops and mobile. Verify both themes, all tabs, keyboard navigation, drawer focus restoration, explicit save/discard/conflict recovery, pending edits, saved reloads, protected metadata, avatar fallback and reduced motion. Maintain local verification receipts for completed feature increments.

## Reference review

Reference research and verification artifacts stay in ignored local directories. Preserve written observations and source metadata, reuse existing evidence before extracting duplicates, and retain generated captures only while they support a material review question. Published documentation describes implemented product behavior and current capability boundaries.

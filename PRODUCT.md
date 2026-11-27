# Aevlo

## Product and working context

Aevlo is a web workspace for personal AI agents, connected tools, and recurring work. Development proceeds through focused feature increments with implementation, verification and supporting architecture notes.

The current feature set includes agent creation, a conversation preview and persistent configuration. The configuration editor saves the selected agent's name, avatar and combined instructions/description with explicit Save. Real agent execution is the next planned capability.

## Platform and primary tasks

- Platform: browser-based application, usable on desktop/laptop and mobile.
- Workspace mode: **Operate**. People create and navigate saved agents, inspect a conversation example, and edit and save configuration.
- Current journey: authenticate, create an agent, open its saved workspace, try the local composer, and inspect General, Tools, Schedule, and Settings.
- Agent creation and explicitly saved name/avatar/instructions persist. Editing updates the visible draft; Save writes it. Status toggling and conversation messages remain local previews.

## Current capabilities and boundaries

- Next.js App Router, React, Tailwind, and the existing shadcn/Base UI primitives supply the application.
- NextAuth uses Google/GitHub OAuth and JWT sessions. An awaited sign-in callback saves or updates the authenticated profile in PostgreSQL's `users` table through Drizzle.
- The workspace route family is protected by the proxy and a server-layout session check. Client session context supplies the real account footer; it does not enforce authorization alone.
- The authenticated create/list/detail/update API and agent table exist; the sidebar loads the owner's real saved agents. Detail lookup and updates check both authenticated owner and agent ID. Updates allow only name, avatar and combined instructions, preserving identity, owner and creation time.
- The chat/configuration interface uses the real saved identity. Its example conversation is labeled, and submitting starts a local conversation without fabricated assistant replies.
- Tools show five planned services as unavailable connection previews. Scheduling, duplication and deletion are unavailable; pause/clear affect only the local conversation preview. Marketplace, AI execution, connected accounts, persisted history, sandbox desktops and deployment remain planned capabilities.
- Explicit save has inline validation, a fixed save dock, keyboard submission, draft preservation during pending requests, unknown-outcome verification and conflict recovery. Navigation protects dirty or pending edits. No autosave or schema migration is introduced.
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

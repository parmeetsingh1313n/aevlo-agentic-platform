# Aevlo

## Product and working context

Aevlo is a web workspace for personal AI agents, connected tools, and recurring work. This project is being built alongside TubeGuruji's [agentic platform tutorial](https://youtu.be/oqUyyB7ROHA), in its chapter order, with implementation followed by verification and learning notes.

The current request covers **Workspace Layout, 00:59:25–01:21:33**, after the user confirmed database and authentication work is complete. The next checkpoint is **Create Agent, 01:21:33–01:50:34**. Later chapters are reference material, not implemented capabilities.

## Platform and primary tasks

- Platform: browser-based application, usable on desktop/laptop and mobile.
- Workspace mode: **Operate**. People navigate their workspace and prepare agent details; clear controls and readable content take priority over decoration.
- Current journey: authenticate with Google or GitHub, enter `/workspace`, open `/workspace/create-agent`, choose an avatar, and enter a name and optional instructions.
- This chapter's form is an explicit preview. Avatar shuffling, fields, the character counter, cancellation, account sign-out, and mobile navigation work. Agent submission is disabled until the following chapter implements persistence.

## Current capabilities and boundaries

- Next.js App Router, React, Tailwind, and the existing shadcn/Base UI primitives supply the application.
- NextAuth uses Google/GitHub OAuth and JWT sessions. An awaited sign-in callback saves or updates the authenticated profile in PostgreSQL's `users` table through Drizzle.
- The workspace route family is protected by the proxy and a server-layout session check. Client session context supplies the real account footer; it does not enforce authorization alone.
- Sidebar examples are labeled as examples. There are no saved agents in this checkpoint.
- Marketplace is marked unavailable. AI execution, agent configuration, connected services, routines, history, sandbox desktops, and deployment belong to later chapters.
- The tutorial uses a separate authenticated user-sync API and adds credits. Those differences are documented; this chapter does not rewrite the working authentication flow or modify the database schema.

## Established product identity

Preserve the user's Aevlo name, original brand mark, current light/dark tokens, and existing interface styling. The implementation's current tokens and components are the authority; historical proposals are not a request for a new visual identity.

- Manrope: body and controls.
- Bricolage Grotesque: headings and brand lettering.
- IBM Plex Mono: code and machine-readable information where needed.
- Retain the existing color roles and theme toggle.
- Use the tutorial's sidebar and compact centered form structure, adapted to this established identity.
- Use real DiceBear avatars: 10.x Gaze for the create form and the tutorial's 9.x Shapes for sidebar examples. Seeds are opaque identifiers, not personal profile data.

## Quality and verification

Show availability truthfully; do not imply that an example, draft, or disabled feature has been saved or executed. Keep secrets on the server and outside committed files. Preserve reduced-motion preferences, keyboard focus, accessible labels, and a usable mobile drawer.

The complete form must fit the checked laptop viewport without unnecessary scrolling. Verify desktop and mobile rendering, both themes, anonymous and signed-in routing, avatar loading/shuffling, cancellation, and sign-out. Record actual test/build/browser results in [the progress ledger](docs/progress.md) and [the Workspace Layout guide](docs/sections/04-workspace-layout.md).

## Tutorial evidence

The Watch extraction preserves the full English automatic caption track, one screenshot every source minute (353 captures), detailed workspace cue frames, and timestamped observations. Raw evidence is local reference material outside application source. Minute sampling does not establish every code edit; inspect the relevant chapter in detail before implementing its next feature.

# Aevlo Agentic Platform

Aevlo is an early-stage workspace foundation for AI agents, connected tools, and everyday routines.

**Development assisted by [Claude Code](https://claude.com/claude-code)** for implementation, testing, and repository maintenance. Claude Code is a development tool here, not an application runtime integration.

## What's included

- Branded home, sign-in, and sign-up pages.
- Google and GitHub OAuth sign-in with database-backed user profiles and safe callback handling.
- Light/dark themes, local typography, and responsive layouts.
- A protected workspace, signed-in account menu, database-backed agent creation, and owner-scoped saved-agent navigation.
- Responsive agent chat with a multiline composer and General, Tools, Schedule, and Settings panels.
- Saved agent configuration with explicit Save, inline validation, draft protection, and recovery from conflicting edits.
- Authenticated Agent SDK conversations using MiniMax-M3.1-Flash through the configured Chat Completions endpoint, with thinking, retry, and fresh-conversation controls.
- Persisted Composio integration selection, account authorization links, and current connection status for seven initial services.
- Guided questions with selectable answers and custom text when a missing detail changes the result.
- Interactive example routines with one-shot auth previews, homepage playback controls, and reduced-motion support.
- PostgreSQL/Drizzle schema and example Inngest background jobs.
- Automated checks for theme contrast, homepage entry points, schema shape, font integrity, and local setup.

## Project status

The workspace supports saved agent configuration, Composio tool setup, and a guided-question chat interface. Live Composio session creation, tool retrieval, and reuse have passed. At the user's request, Chapter 09 replaces the earlier Grok route with MiniMax-M3.1-Flash: live text, automatic and forced native function calls, and a harmless two-request Agents SDK function round trip passed with HTTP 200. The signed-in browser flow also passed both the live guided question and the continued answer. No live external app action is claimed. Routine previews remain demonstrations, and persisted routine management remains future work.

Successful Google or GitHub sign-in saves a profile in PostgreSQL's `users` table. Repeat sign-ins update the same email's profile without creating duplicate rows. Sessions use JWTs; OAuth tokens are not stored in this table.

Sign-in opens `/workspace` by default. `/workspace/create-agent` saves the agent's name, DiceBear avatar, and optional instructions to PostgreSQL, then opens its owner-protected `/workspace/[agentId]` page. Saved agents appear in the sidebar.

The agent page includes a persistent configuration editor. Edit the name, DiceBear avatar, and combined instructions/description, then choose **Save changes** to persist them. The form preserves newer typing during saves, keeps drafts on failure, and offers recovery when another session changes the agent. Ctrl/Cmd+S also saves. Unsaved edits are protected during navigation.

Example conversations are labeled; sending starts a fresh real conversation. The authenticated chat endpoint loads the owner's saved agent name and instructions before calling `MiniMax-M3.1-Flash` at `https://api.hcnsec.cn/v1/chat/completions` through the Agent SDK. Save instruction changes before chatting. Conversation history and guided answers stay in browser memory and are lost on reload or leaving the agent; they are not written to PostgreSQL. Failed replies with unknown outcomes or an attempted external tool call require checking the service result before repeating the task in a new conversation.

In **Tools**, enable an integration to save it immediately, then choose **Connect** to open its account authorization flow. Gmail, Slack, Google Calendar, Notion, GitHub, Google Docs, and Reddit are included in the initial catalog. An enabled integration is different from a connected account; refresh status after completing consent. The app saves toolkit selection and a scoped Composio session ID. Scheduled routines, duplication, and deletion remain planned capabilities.

The example event-trigger endpoint is for development; add authorization and rate limiting before exposing it publicly. Production use also requires real service configuration and a securely generated authentication secret.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · shadcn/Base UI · NextAuth · Drizzle ORM · PostgreSQL · OpenAI Agents SDK with a MiniMax provider · Composio · Inngest

## Run locally

Use Node.js **22.22.3 or newer** and npm. The installed Composio core package is ESM-only.

```sh
npm ci
node scripts/local-environment.mjs
npm run dev
```

Open [localhost:3000](http://localhost:3000).

The setup script creates an ignored `.env.local` with a random authentication secret and preserves an existing file. No database or OAuth account is needed to preview the current screens.

### Configure optional services

Use [.env.example](.env.example) as the configuration reference. Replace placeholders with your own values; never commit real credentials.

| Service | Configuration |
| --- | --- |
| Authentication | `NEXTAUTH_URL` and a securely generated `NEXTAUTH_SECRET` |
| Google sign-in | `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` |
| GitHub sign-in | `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` |
| PostgreSQL | `DATABASE_URL` |
| MiniMax agent chat | `AGENT_API_KEY` (server-only; legacy `NEW_API_KEY` also accepted) |
| Composio tools | `COMPOSIO_API_KEY` (server-only; individual app consent is separate) |
| Inngest cloud | `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` |

Add `AGENT_API_KEY=your-provider-key` to an ignored `.env` or `.env.local` and restart `npm run dev`. The SDK reads the key when a chat request runs and also accepts the earlier `NEW_API_KEY` name when `AGENT_API_KEY` is unset or blank. The app uses `MiniMax-M3.1-Flash` at `https://api.hcnsec.cn/v1` through Chat Completions; no OpenAI API key is required. OpenAI tracing is disabled. The provider receives the saved instructions and the current conversation history for each request. A missing key leaves chat unavailable with a configuration message while the rest of the workspace remains usable.

Add `COMPOSIO_API_KEY=your-composio-key` to an ignored `.env` or `.env.local` and restart the server for tool connections. The key is resolved only in server requests. Account authorization remains an interactive step for each required service. Tool retrieval uses `@composio/core` 0.32.0 and a native Agents SDK bridge; the incompatible older Agents provider adapter is not forced into the dependency tree.

Add OAuth credentials to `.env.local`, restart the development server, and register these local callback URLs with the corresponding provider:

- `http://localhost:3000/api/auth/callback/google`
- `http://localhost:3000/api/auth/callback/github`

Set `DATABASE_URL` in an ignored `.env.local` or `.env` file, or export it in your shell. The Drizzle configuration loads the same development environment as the app. Apply the schema with `npm run db:push` before testing OAuth sign-in.

```sh
npm run db:generate
npm run db:push
npm run db:studio
```

Only run database commands after configuring the intended database. For local background-job development, run `npm run inngest:dev` in a second terminal while the app is running.

## Development checks

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

Run the production build with `npm start`.

The Chapter 09 checkpoint passed 133 automated tests, with three optional integration checks skipped, plus lint, TypeScript, and the production build. Browser checks covered guided answers, pause/resume, mobile overflow, tool persistence, and saving an unsaved profile after a tool change.

## Third-party notices

Third-party UI code and fonts retain their respective licenses and attribution. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

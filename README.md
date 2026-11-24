# Aevlo Agentic Platform

Aevlo is an early-stage workspace foundation for AI agents, connected tools, and everyday routines.

**Development assisted by [Claude Code](https://claude.com/claude-code)** for implementation, testing, and repository maintenance. Claude Code is a development tool here, not an application runtime integration.

## What's included

- Branded home, sign-in, and sign-up pages.
- Google and GitHub OAuth wiring with safe callback handling and configuration guidance.
- Light/dark themes, local typography, and responsive layouts.
- Interactive example routines with one-shot auth previews, homepage playback controls, and reduced-motion support.
- PostgreSQL/Drizzle schema and example Inngest background jobs.
- Automated checks for theme contrast, homepage entry points, schema shape, font integrity, and local setup.

## Project status

This first version focuses on the application shell and platform foundations. Routine previews are demonstrations, not live automation. Agent execution, connected tools, database-backed accounts, and persisted routine management are not implemented yet.

The example event-trigger endpoint is for development; add authorization and rate limiting before exposing it publicly. Production use also requires real service configuration and a securely generated authentication secret.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · shadcn/Base UI · NextAuth · Drizzle ORM · PostgreSQL · Inngest

## Run locally

Use Node.js **20.9 or newer** and npm.

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
| Inngest cloud | `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` |

Add OAuth credentials to `.env.local`, restart the development server, and register these local callback URLs with the corresponding provider:

- `http://localhost:3000/api/auth/callback/google`
- `http://localhost:3000/api/auth/callback/github`

For database tooling, put `DATABASE_URL` in an ignored `.env` file or export it in your shell. The Drizzle CLI does not automatically read `.env.local`.

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

## Third-party notices

Third-party UI code and fonts retain their respective licenses and attribution. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

# PAMI

Personal AI agent: a Next.js/Supabase web dashboard paired with a native
macOS menu-bar companion that runs voice capture, Apple Notes/Calendar/
Reminders automation, approval-gated shell commands, and delegates
free-text requests to Claude Code (development work) or OpenCode (general
questions) running locally.

## Structure

```
apps/web/       Next.js dashboard (Vercel)
apps/mac/       Swift menu-bar companion (SPM, no Xcode required)
supabase/       Postgres migrations + Edge Functions (task/device backend)
```

## Local development

```bash
cd apps/web && npm install && npm run dev

cd apps/mac && swift build
./Packaging/build_app.sh   # assembles + ad-hoc signs PamiMac.app
open dist/PamiMac.app
```

Supabase schema/functions are managed via the Supabase MCP server or the
`supabase` CLI against the linked project — see `supabase/migrations/` and
`supabase/functions/`.

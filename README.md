# EcoManager — COD E-Commerce Platform (Algeria)

Multi-tenant COD (cash-on-delivery) order management for Algerian e-commerce:
orders pipeline, stock, carriers/delivery, accounting, stats, webhooks.

## Stack

- **Next.js 15** (App Router) + **React 19** — frontend + API routes
- **Supabase** (PostgreSQL) — accessed server-side via the `service_role` key (`lib/db.ts`)
- **Custom JWT auth** — `Authorization: Bearer <token>` (`lib/auth.ts`)
- **Tailwind CSS v4** — theme in `app/globals.css`; UI uses inline-style tokens from `lib/tokens.ts`
- **Host:** Vercel (app) + Supabase (database)

## Local development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your env file and fill it in:
   ```bash
   cp .env.example .env.local
   ```
   See [`.env.example`](./.env.example) for every variable and where to find it.
   Required: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`.
3. Run the dev server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

### Demo login
| Field | Value |
|-------|-------|
| URL   | http://localhost:3000/login |
| Email | admin@chekn.dz |
| Password | Admin123! |

## Deploying to Vercel

1. **Push** the repo to GitHub/GitLab/Bitbucket.
2. In **Vercel → Add New → Project**, import the repository. Vercel auto-detects
   Next.js — no build settings to change (build: `next build`, output handled automatically).
3. **Environment variables** — under *Settings → Environment Variables*, add every
   key from [`.env.example`](./.env.example) for the **Production** (and Preview) environments:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`  *(server-only secret — bypasses RLS, never expose client-side)*
   - `JWT_SECRET`  *(generate with `openssl rand -hex 64`)*
   - `NEXT_PUBLIC_APP_URL`  *(your production URL, e.g. `https://your-app.vercel.app`)*
   - Optional integrations as needed: `CRON_SECRET`, `GOOGLE_CLIENT_ID`,
     `GOOGLE_CLIENT_SECRET`, `NOEST_BASE_URL`, `NOEST_API_TOKEN`, `NOEST_USER_GUID`
4. **Deploy.** Vercel builds and assigns a URL. After the first deploy, set
   `NEXT_PUBLIC_APP_URL` to that URL and redeploy so absolute links are correct.
5. **Database** — point the Supabase variables at your project. The SQL schema
   lives in [`migrations/`](./migrations) and is applied to Supabase directly
   (run them in the Supabase SQL editor, in order). After creating a tenant,
   call `seed_tenant_defaults(<tenant_id>)`.
6. **Scheduled jobs** — `vercel.json` defines the cron schedule (sync runs daily
   at 02:00). Protect the cron route by setting `CRON_SECRET`.

> **Security note:** `SUPABASE_SERVICE_ROLE_KEY` bypasses Row-Level Security.
> Every query is scoped by `tenant_id` in application code — keep it that way.

## Project layout

```
app/          App Router pages + API routes (app/api/**/route.ts)
components/   layout (Topbar/Sidebar/StatusBar), ui/ (design-system primitives)
contexts/     React contexts (Boutique, Permissions, Toast, UI)
lib/          db, auth, api-client, tokens, integrations
migrations/   SQL schema (read-only from app code)
```

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture, design system, and API conventions.

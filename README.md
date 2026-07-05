# ChicN 📦 — COD E-Commerce Management Platform

**Multi-tenant order management platform for cash-on-delivery e-commerce in Algeria** — the full order lifecycle (confirmation → preparation → dispatch → delivery → returns → cash collection) plus inventory, logistics, accounting, and team management in one trilingual dashboard.

🌐 **Live:** [www.chicn.online](https://www.chicn.online)

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)
![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-black?logo=vercel)

---

## ✨ Features

- **📋 Full order pipeline** — dedicated workspaces for each stage: *en confirmation, en préparation, en dispatch, en livraison, livrées, en retour*, plus archives, trash with restore, and bulk actions everywhere
- **🚚 Carrier integration (Noest)** — create parcels via the Noest API, print shipping labels, receive delivery-status webhooks, and track pickups/collections end to end
- **📊 Google Sheets auto-import** — connect a sheet via Google OAuth; a cron-driven sync engine imports new orders automatically with configurable column mapping
- **📥 Import wizards** — 4-step XLSX/CSV wizards (file → mapping → import → result) for orders, products, and clients, with downloadable templates and auto-detected columns
- **🏬 Multi-tenant & multi-boutique** — strict tenant isolation on every query; users scoped to specific boutiques
- **📦 Inventory & batch stock** — multi-warehouse stock with batch/lot tracking, FIFO/LIFO/FEFO strategies, movement history, adjustments, and low-stock alerts
- **💰 Accounting** — financial dashboard (bilan) and per-product profitability, factoring delivery fees, ad spend, expenses, confirmation and packaging costs
- **📈 Analytics** — statistics by boutique, product, wilaya, delivery agent, and confirmation agent, with interactive Recharts dashboards
- **🔐 Granular RBAC** — custom roles with 100+ permission keys down to single actions (e.g. `orders.en_confirmation.edit_discount`), plus audit logs
- **🔒 Security** — custom JWT auth, bcrypt password hashing, TOTP two-factor authentication with QR-code enrollment
- **🌍 Trilingual UI** — Arabic (RTL), French, and English via react-i18next, with automatic direction switching and per-user language persistence
- **🔔 Webhooks & notifications** — 19 outbound order events with delivery logs and retries; in-app notification center

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript 5 |
| Styling | Tailwind CSS v4 (theme in `app/globals.css`) + design tokens (`lib/tokens.ts`) |
| API | 70+ serverless REST routes (`app/api/**/route.ts`) on Vercel |
| Database | PostgreSQL on Supabase — UUID keys, soft deletes, SQL views, stored functions |
| Auth | Custom JWT (`Authorization: Bearer`) + TOTP 2FA (speakeasy) |
| Integrations | Google Sheets API (OAuth 2.0), Noest carrier API, outbound webhooks |
| i18n | react-i18next — AR / FR / EN, RTL-aware |

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works)

### Local development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env.local
   ```
   See [`.env.example`](./.env.example) for every variable and where to find it.

   | Variable | Required | Description |
   |----------|----------|-------------|
   | `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server-only secret — bypasses RLS, never expose client-side |
   | `JWT_SECRET` | ✅ | Generate with `openssl rand -hex 64` |
   | `NEXT_PUBLIC_APP_URL` | ✅ | App base URL (`http://localhost:3000` locally) |
   | `CRON_SECRET` | optional | Protects the scheduled sync route |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Google Sheets import (OAuth) |
   | `NOEST_BASE_URL` / `NOEST_API_TOKEN` / `NOEST_USER_GUID` | optional | Noest carrier integration |

3. **Set up the database**

   Run the SQL files in [`migrations/`](./migrations) in order, in the Supabase SQL editor. After creating a tenant, seed its defaults:
   ```sql
   SELECT seed_tenant_defaults('<tenant_id>');
   ```

4. **Run the dev server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000/login](http://localhost:3000/login).

## ☁️ Deploying to Vercel

1. Push the repo to GitHub/GitLab/Bitbucket and import it in **Vercel → Add New → Project** (Next.js is auto-detected — no build settings to change).
2. Add every key from [`.env.example`](./.env.example) under *Settings → Environment Variables* for **Production** (and Preview).
3. Deploy. After the first deploy, set `NEXT_PUBLIC_APP_URL` to the assigned URL and redeploy so absolute links are correct.
4. **Scheduled jobs** — `vercel.json` defines the cron schedule (Google Sheets sync runs daily at 02:00). Set `CRON_SECRET` to protect the cron route.

> ⚠️ **Security note:** `SUPABASE_SERVICE_ROLE_KEY` bypasses Row-Level Security. Every query is scoped by `tenant_id` in application code — keep it that way.

## 📁 Project Structure

```
app/
  (auth)/login/     Login page
  api/              70+ REST API routes (JWT-protected, tenant-scoped)
  dashboard/        60+ dashboard pages (orders, stock, stats, accounting, config)
components/
  layout/           Topbar, Sidebar, StatusBar
  ui/               Design-system primitives (Table, Pagination, SearchInput, …)
contexts/           React contexts (Boutique, Permissions, Toast, Language, UI)
lib/                db, auth, tokens, i18n, Noest + Google Sheets integrations
locales/            AR / FR / EN translation dictionaries (11 namespaces each)
migrations/         SQL schema — applied to Supabase directly, read-only from app code
```

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture, design system, and API conventions.

## 📄 License

Private — all rights reserved.

# Books App

A Next.js + Supabase sample application for managing a small library of books with optional AI features (summaries, tags, embeddings, recommendations). This README covers setup, environment variables, database migration, AI endpoints, local development, testing, deployment notes, and troubleshooting.

Table of contents
- [Overview](#overview)
- [What’s included / Key files](#whats-included--key-files)
- [Requirements](#requirements)
- [Quickstart (local)](#quickstart-local)
- [Environment variables](#environment-variables)
- [Database migration](#database-migration)
- [AI endpoints & behavior](#ai-endpoints--behavior)
- [Testing the endpoints (curl examples)](#testing-the-endpoints-curl-examples)
- [Production deployment notes (Vercel + Supabase)](#production-deployment-notes-vercel--supabase)
- [Troubleshooting](#troubleshooting)
- [Security & Cost considerations](#security--cost-considerations)
- [Further improvements](#further-improvements)
- [Where to look in the codebase](#where-to-look-in-the-codebase)

---

## Overview

This project is a Next.js (App Router) TypeScript application backed by Supabase and optional OpenAI integration. It provides:

- Book management UI (list, add, edit, check-in/out).
- AI features:
  - `POST /api/ai/generate` — generate summary, tags and embedding for a book (uses OpenAI if configured; otherwise falls back to deterministic mock embeddings).
  - `POST /api/ai/recommend` — compute similarity between embeddings and return top-K local book recommendations.
  - `POST /api/ai/web-recommend` — query Open Library to fetch web-sourced recommendations (filters out titles already present locally).

The app ships client components that show recommendations (web-first by default), plus background-ready server endpoints.

---

## What’s included / Key files

- `app/` — Next.js app routes and pages.
- `components/` — UI components (table view, AIRecommendations, sheet, Toaster, etc).
- `app/api/ai/generate/route.ts` — server endpoint to generate AI metadata for a book.
- `app/api/ai/recommend/route.ts` — server endpoint to recommend local books using embeddings.
- `app/api/ai/web-recommend/route.ts` — server endpoint to fetch web-based book recommendations (Open Library).
- `db/migration.sql` — SQL migration that creates the `book_ai` table (embeddings, optional `pgvector`).
- `lib/supabase/` — Supabase server/client helpers.
- `components/ai-recommendations.tsx` — client component that shows recommendations and supports web-sourced recommendations.
- `app/auth/oauth/route.ts` — OAuth callback / exchange route — note: production redirects depend on env settings and forwarded headers.

---

## Requirements

- Node 18+ (or the Node version your Next.js config expects)
- pnpm / npm / yarn (any package manager)
- Supabase project with a Postgres DB
- (Optional) OpenAI API key for real embeddings & summaries
- (Optional) pgvector extension in your Postgres if you want vector indexing on DB

---

## Quickstart (local)

1. Clone the repo and install dependencies:
```/dev/null/example.md#L1-6
git clone <repo-url> books
cd books
npm install
```

2. Create a `.env.local` (or set environment variables) — see the [Environment variables](#environment-variables) section.

3. Run the dev server:
```/dev/null/example.md#L8-9
npm run dev
# Open http://localhost:3000
```

4. If you are using Supabase locally or remotely, ensure the DB has the `books` table present and apply the AI migration (see next section).

---

## Environment variables

Create `.env.local` (for local development) and set these values. For production (Vercel) set environment variables in the project settings.

Required (Supabase client + server):
- `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL (client-side)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — your Supabase anon/public key (client-side)
- `SUPABASE_SERVICE_ROLE_KEY` — (server-only) Supabase service role key used by server helpers for privileged upserts (keep this secret)

Site / deployment:
- `NEXT_PUBLIC_SITE_URL` — your public site URL, e.g. `https://library-mcgill.vercel.app` (used for OAuth redirect resolution)
- `NODE_ENV` — `development` or `production`

Optional (AI):
- `OPENAI_API_KEY` — optional; if set, the server endpoints use OpenAI for summaries and embeddings. If omitted, the server generates deterministic mock embeddings and a simple summary fallback.

Notes:
- Never commit `.env` files or secrets to source control.
- After changing environment variables in Vercel, redeploy to ensure they are applied.

---

## Database migration

The project includes `db/migration.sql` to create the `book_ai` table used by AI endpoints.

Path: `db/migration.sql`

Important notes:
- The migration includes `CREATE EXTENSION vector;` and an `embedding_vector vector(153)` column to support `pgvector`. If your DB or plan does not support `pgvector`, remove the extension line and the `embedding_vector` column/index (the code will still work with the `float8[]` embedding fallback).
- The embedding dimension (153 in the migration) should match whichever embedding model you use.

How to apply:
- Using Supabase SQL editor:
  - Open your project → SQL Editor → run the SQL in `db/migration.sql`.
- Or via psql:
```/dev/null/example.md#L1-4
psql "postgresql://<user>:<pass>@<host>:5432/<db>" -f db/migration.sql
```

Verify:
- Table `book_ai` should exist with columns: `id, book_id, summary, tags, embedding (float8[]), embedding_vector (vector), updated_at`.

---

## AI endpoints & behavior

The app provides three AI-focused server endpoints (server-side routes under `app/api/ai/*`).

1. `POST /api/ai/generate`
- Body: `{ "bookId": "<uuid>" }`
- What it does:
  - Fetches the book row from `books`.
  - If `OPENAI_API_KEY` is set:
    - Calls OpenAI chat completion to create a short summary + tags.
    - Calls OpenAI embeddings endpoint to generate an embedding vector.
  - Fallbacks:
    - If OpenAI is not configured or fails, it creates a deterministic mock embedding (float array) and a simple summary derived from the notes or title.
  - Upserts into `book_ai` (summary, tags, embedding).
- Returns: `{ success: true, summary, tags }` or an error.

2. `POST /api/ai/recommend`
- Body: `{ "bookId": "<uuid>", "topK": 5 }`
- What it does:
  - Loads the target book’s embedding from `book_ai`.
  - Fetches other `book_ai` rows with embeddings, computes cosine similarity (server-side), ranks, and returns the top K recommendations.
  - If `pgvector` is set up and you'd prefer DB-powered vector search, migrate embeddings into `embedding_vector` and adapt queries for `pgvector` distance search.
- Returns: `{ recommendations: [{ score, tags, summary, book }] }`

3. `POST /api/ai/web-recommend`
- Body: `{ "bookId": "<uuid>", "topK": 3, "seed"?: number|string }`
- What it does:
  - Looks up the target book to form a query.
  - Calls Open Library search API to fetch candidate books, filters out titles that already exist in your local `books` table (case-insensitive).
  - Shuffles and returns up to `topK` web-sourced recommendations (title, author, source).
  - Accepts an optional `seed` so the server-side shuffle is deterministic based on the seed (used to produce variation between calls).
- Returns: `{ recommendations: [{ title, author, key?, source }] }`

---

## Testing the endpoints (curl examples)

Generate AI metadata for a book:
```/dev/null/example.sh#L1-3
curl -X POST https://library-mcgill.vercel.app/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"bookId":"<UUID>"}'
```

Request local recommendations:
```/dev/null/example.sh#L4-6
curl -X POST https://library-mcgill.vercel.app/api/ai/recommend \
  -H "Content-Type: application/json" \
  -d '{"bookId":"<UUID>","topK":5}'
```

Request web-based recommendations (Open Library) with an optional seed:
```/dev/null/example.sh#L7-9
curl -X POST https://library-mcgill.vercel.app/api/ai/web-recommend \
  -H "Content-Type: application/json" \
  -d '{"bookId":"<UUID>","topK":3,"seed":12345}'
```

Replace `<UUID>` with a real `books.id` from your database.

---

## Production deployment notes (Vercel + Supabase)

1. Environment variables:
   - Add `NEXT_PUBLIC_SITE_URL` = `https://library-mcgill.vercel.app` (exact)
   - Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Add `SUPABASE_SERVICE_ROLE_KEY` (server-only)
   - Add `OPENAI_API_KEY` if you want real embeddings/summaries

2. OAuth / Redirects:
   - In Supabase Dashboard → Authentication → Settings:
     - Add `https://library-mcgill.vercel.app/auth/oauth` to Redirect URLs.
   - Also add this redirect URI to any OAuth provider settings (e.g., Google/GitHub) used by Supabase.
   - After setting env vars on Vercel, redeploy — runtime envs need a deploy to take effect.

3. Headers and proxies:
   - The OAuth callback logic uses `NEXT_PUBLIC_SITE_URL` first, then `x-forwarded-host` and `x-forwarded-proto`. Ensure your hosting/proxy sets `x-forwarded-host` correctly if not using `NEXT_PUBLIC_SITE_URL`.

4. Logs:
   - Check Vercel function logs for errors from server route handlers.
   - Check Supabase logs for DB and auth activity.

---

## Troubleshooting

1. After auth, redirected to `http://localhost:3000/?code=...` (even in production)
   - Likely cause: OAuth redirect URI configured in Supabase or provider points to localhost or the initial authorize request includes a `redirect_uri` of `localhost`.
   - Fix:
     - Ensure Supabase and the underlying OAuth provider have `https://library-mcgill.vercel.app/auth/oauth` listed as an allowed redirect.
     - Do a full redeploy after changing Vercel environment variables.
     - Start the login from the production site (so `redirect_uri` is correct).

2. API returns "No AI data found" or `target embedding not available`
   - If a book lacks AI metadata, call `POST /api/ai/generate` for that book (the UI may already do this).
   - Check server logs to see why generation failed (OpenAI errors, quota, supabase upsert errors).

3. Recommendations always the same after refresh
   - The web-recommend endpoint requests a candidate pool and then shuffles. If you see identical results:
     - Ensure your client call passes a fresh `seed` or set `cache: 'no-store'` on the fetch client-side to avoid CDN/browser caching.
     - Confirm the server is receiving different `seed` values (logs help).

4. pgvector / vector index not found
   - If your DB doesn't support the `vector` extension, remove the `CREATE EXTENSION vector` line and the `embedding_vector` column/index from `db/migration.sql` and rely on `float8[]` embeddings.

---

## Security & Cost considerations

- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the client. Only use it in server-side code.
- OpenAI usage can incur cost. Add rate-limiting or background jobs for bulk operations to control spend.
- If you accept user uploads or external text, sanitize content and enforce size limits before sending to OpenAI.
- Use server-side logging and monitoring (Vercel logs, Supabase logs) to detect errors early.

---

## Further improvements (ideas)

- Move embedding storage to `pgvector` and use native vector indexes & similarity query for faster recommendations at scale.
- Offload heavy AI generation to a background worker / queue to avoid user-facing latency and to enable retries.
- Add fuzzy title matching and deduplication for improved web recommendations.
- Add pagination and server-side search for large book collections.
- Add proper test coverage for the AI endpoints and CI checks.

---

## Where to look in the codebase

- AI endpoints:
  - `app/api/ai/generate/route.ts`
  - `app/api/ai/recommend/route.ts`
  - `app/api/ai/web-recommend/route.ts`
- DB migration:
  - `db/migration.sql`
- UI components:
  - `components/ai-recommendations.tsx` (client-side recommendations UI)
  - `components/table-view.tsx` (book list & actions)
  - `components/ui/sheet.tsx` (sheet layout)
- OAuth callback:
  - `app/auth/oauth/route.ts`

---

If you'd like, I can:
- Add small debug logging to the OAuth callback to inspect headers in production and confirm what `origin` / `x-forwarded-host` are set to.
- Create an annotated checklist for applying the `db/migration.sql` to Supabase specifically (step-by-step clicks).
- Provide a sample `curl` test suite you can run locally to exercise the AI endpoints.

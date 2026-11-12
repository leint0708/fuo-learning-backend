# Technical Research & Architecture Decisions: Exam Practice Backend API (Cloudflare Stack)

**Feature**: `001-exam-practice-api`  
**Date**: 2026-11-12  
**Target Environment**: Cloudflare Ecosystem (Workers, D1, R2 / Assets)  
**Status**: Completed  

---

## 1. Backend Language & Web Framework

- **Decision**: **TypeScript** with **Hono** (`hono`) targeting **Cloudflare Workers**.
- **Rationale**:
  - Hono is the undisputed standard framework for Cloudflare Workers: ultra-lightweight (<15KB), zero cold-start penalty, built specifically for Web Standards and the Fetch API.
  - End-to-end type safety with TypeScript, sharing types across models, services, and API responses.
  - Built-in edge middleware: CORS, JWT authentication (`hono/jwt`), logging, and error handling.
  - Seamless OpenAPI 3.1 generation via `@hono/zod-openapi` and Zod validation, guaranteeing that request/response schemas match contracts at compile-time and runtime.
- **Alternatives Considered**:
  - *Python on Cloudflare Workers (Pyodide / WASM)*: Available on Cloudflare, but runs in an interpreted WebAssembly container with high cold-start latency, memory overhead, package incompatibilities, and lacks the edge ecosystem maturity of TypeScript.
  - *Express / Fastify (Node.js)*: Node-specific HTTP APIs are not natively built for V8 isolates; requires heavier Node compatibility polyfills.
  - *Itty-router*: Extremely minimal, but lacks Hono's rich middleware, OpenAPI ecosystem, and built-in edge utilities.

---

## 2. Database & Data Access Layer

- **Decision**: **Cloudflare D1** (Serverless SQLite at the edge) with **Drizzle ORM** (`drizzle-orm`) and `drizzle-kit`.
- **Rationale**:
  - **Cloudflare D1** is Cloudflare's native, distributed serverless relational database built on SQLite. It runs directly inside Cloudflare's edge network, colocated with Workers for sub-millisecond query latency.
  - **Drizzle ORM** is the most popular, recommended ORM for Cloudflare D1. It provides zero-overhead, type-safe SQL queries, eliminates runtime overhead, and supports native D1 bindings (`env.DB`).
  - `drizzle-kit` automates declarative schema migrations, generating clean SQL migration files applied seamlessly via `wrangler d1 migrations apply`.
  - Local development uses Wrangler's local SQLite simulation (`wrangler dev --local`), requiring zero external database installations or background Docker containers.
- **Alternatives Considered**:
  - *Cloudflare KV*: Key-Value store lacks relational queries, SQL joins, atomic transactions, and complex filtering required for exam queries, question lookups, and user statistics.
  - *Prisma ORM*: Prisma Accelerate / edge client adds extra runtime binary overhead and connection pooling complexity compared to Drizzle's direct native D1 binding.
  - *External PostgreSQL (e.g. Supabase, Neon)*: Viable, but introduces cross-cloud latency from Cloudflare Workers to an external database provider, whereas D1 is natively colocated.

---

## 3. Media & Diagram Storage (WebP Assets)

- **Decision**: **Cloudflare Workers Static Assets** (or **Cloudflare R2** with Workers routing).
- **Rationale**:
  - For the existing `exams/` directory diagram files (`Q1.webp`, `Q32.webp`, etc.):
    - **Cloudflare Workers Static Assets** (Wrangler's `assets` directory configuration): The `exams/` directory or an exported `public/exams/` folder is declared in `wrangler.jsonc` as static assets. Cloudflare's CDN edge automatically caches and serves all `.webp` files at edge points-of-presence globally with zero worker execution costs.
    - Alternatively, for larger dynamic uploads, **Cloudflare R2** provides S3-compatible, zero-egress fee object storage accessible directly via `env.BUCKET.get()`.
- **Alternatives Considered**:
  - *Storing WebP binary data in D1 database*: Bloats database size, exceeds D1 10GB storage limits, and increases query latency.
  - *External S3 / Cloudinary*: Incurs bandwidth egress costs and configuration overhead compared to native Cloudflare Assets/R2.

---

## 4. Authentication & Security at the Edge

- **Decision**: **JWT (JSON Web Tokens)** using Web Crypto API (`hono/jwt` / `jose`) with **Web Crypto PBKDF2 / @node-rs/bcrypt** for password hashing.
- **Rationale**:
  - Cloudflare Workers execute in V8 isolates without native Node C++ extensions. Password hashing uses standard Web Crypto API PBKDF2 with SHA-256 (600,000 iterations per OWASP recommendations) or edge-compiled bcrypt/argon2.
  - JWT tokens are signed using HMAC-SHA256 via Web Crypto (`crypto.subtle`), verifying tokens in under 0.1ms at the edge without database lookups.
  - Secrets (`JWT_SECRET`) are stored securely using Cloudflare Worker Secrets (`wrangler secret put JWT_SECRET` or `.dev.vars` for local development).
- **Alternatives Considered**:
  - *Session cookies in KV*: Adds an extra KV read on every single authenticated request, consuming KV read quotas and introducing unnecessary edge latency.

---

## 5. Exam Ingestion & Seeding Pipeline

- **Decision**: Node/TypeScript seeding script (`scripts/seed-d1.ts`) executing via `wrangler d1 execute` or local D1 migration batches.
- **Rationale**:
  - A clean script reads the `exams/` directory JSON files (e.g. `mad101_fa25_feb5_answers.json`), validates them using Zod schemas, transforms the data into relational batch inserts, and populates the D1 database both locally (`--local`) and remotely (`--remote`).
  - Idempotent upsert logic (`ON CONFLICT (code) DO UPDATE`) allows re-running the seed script safely whenever new exam datasets are added to `exams/`.
- **Alternatives Considered**:
  - *Runtime parsing on every Worker request*: Extremely slow and wastes worker execution CPU time.

---

## 6. Testing & CI Strategy

- **Decision**: **Vitest** with `@cloudflare/vitest-pool-workers` and Hono's `app.request()` test helper.
- **Rationale**:
  - Vitest provides native TypeScript execution without transpilation delay.
  - `@cloudflare/vitest-pool-workers` runs tests inside the actual Miniflare V8 isolate environment, guaranteeing that tests execute with exact Cloudflare Worker runtime behavior, including local D1 database bindings.
  - Tests execute in milliseconds with zero mocking needed for the database.
- **Alternatives Considered**:
  - *Jest*: Slower startup, requires cumbersome Babel/ts-jest setups, and lacks official Cloudflare Worker isolate integration.

---

## 7. Deployment & Tooling Workflow

- **Decision**: **Wrangler CLI** (`wrangler.jsonc`) with **Cloudflare Workers**.
- **Rationale**:
  - Single configuration file `wrangler.jsonc` defines Worker entry point, D1 database binding, static asset directory, and environment variables.
  - Local dev: `npx wrangler dev` (runs complete local stack with simulated D1 and static assets).
  - Production deploy: `npx wrangler deploy` (deploys globally across 300+ Cloudflare edge locations in ~5 seconds).
- **Alternatives Considered**:
  - *Serverless Framework / Terraform*: Adds unnecessary configuration layers when Wrangler is Cloudflare's first-party, officially maintained deploy tool.

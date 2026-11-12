# Implementation Plan: Exam Practice Backend API (Cloudflare Stack)

**Branch**: `001-exam-practice-api` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-exam-practice-api/spec.md` with Cloudflare deployment constraint ("deploy on cloudflare, so i want you to choose compatible and popular techstack for deploying easily").

## Summary

Build a high-performance, edge-native RESTful backend API for an academic exam practice platform deployed on **Cloudflare Workers**. The system uses **TypeScript** and **Hono** (the leading edge web framework), **Cloudflare D1** (serverless SQLite at the edge) with **Drizzle ORM** for type-safe relational persistence, **Cloudflare Workers Static Assets** for zero-cost global edge caching of WebP exam diagrams, and the Web Crypto API for secure, zero-dependency JWT authentication and password hashing. The API ingests exam data directly from the repository's `exams/` directory, enforces server-authoritative wall-clock duration limits, performs automated all-or-nothing grading, provides ephemeral topical question drills, and tracks cumulative student performance using the best-attempt model.

## Technical Context

**Language/Version**: TypeScript 5.5+ (Node.js v24 for local build tooling and Wrangler CLI)

**Primary Dependencies**: 
- Framework: `hono` (v4+), `@hono/zod-openapi` (OpenAPI contract generation)
- ORM & Database: `drizzle-orm`, `drizzle-kit`
- Validation: `zod`
- Security & Crypto: Native Web Crypto API (`crypto.subtle`) and `jose` (JWT)
- Deployment & Runtime: `wrangler` (Cloudflare Workers CLI)

**Storage**: **Cloudflare D1** (serverless SQLite database at the edge) with native D1 bindings (`env.DB`), accompanied by Drizzle schema migrations (`drizzle-kit`)

**Asset Storage**: **Cloudflare Workers Static Assets** (declared in `wrangler.jsonc` pointing to `exams/` or `public/exams/` for globally cached WebP diagram delivery)

**Testing**: `vitest` with `@cloudflare/vitest-pool-workers` (official Cloudflare V8 isolate test runner) and Hono's `app.request()` test client

**Target Platform**: Cloudflare Global Edge Network (Cloudflare Workers across 300+ data centers)

**Project Type**: Edge RESTful Web Service API

**Performance Goals**:
- Exam attempt auto-grading under 1 second (SC-002)
- Edge-cached catalog queries under 20ms p95 globally
- Support 500+ concurrent active exam sessions without session loss or corruption (SC-006)

**Constraints**:
- Strict edge V8 isolate compatibility (pure Web APIs, zero native C++ Node addons)
- Zero committed secrets; all secrets configured through `.dev.vars` (local) and `wrangler secret` (production)
- Deterministic all-or-nothing scoring (no partial credit or negative deductions)
- Server-authoritative wall-clock expiration (non-pausable attempt timers)

**Scale/Scope**:
- 4 academic subjects in repository dataset: `MAD101`, `NWC204`, `OSG202`, `PRO192`
- 20 exam sets and 989+ questions (`single_choice` and `multiple_choice`)
- Complete student lifecycle: auth, catalog exploration, exam sittings, reviews, and statistics

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Gate | Assessment | Status |
| :--- | :--- | :---: |
| **I. Code Quality & Clean Architecture** | Modular TypeScript architecture: Hono sub-routers -> Services -> Drizzle D1 schemas -> Zod contracts. Explicit types and zero `any`. | **PASS** |
| **II. Comprehensive Automated Testing** | Vitest with `@cloudflare/vitest-pool-workers` providing isolated in-memory D1 database testing. 100% pass requirement before deployment. | **PASS** |
| **III. Maintainability & Explicit Contracts** | Full OpenAPI 3.1 specification contract in [openapi.yaml](contracts/openapi.yaml). Strict Zod validation on all endpoint inputs/outputs. | **PASS** |
| **IV. Security by Design & Defensive Engineering** | Salted PBKDF2/bcrypt hashing via Web Crypto. Stateless JWT sessions. Answer keys strictly hidden during active attempts. Server-side ownership verification. | **PASS** |
| **V. Operational Reliability & Observability** | Structured JSON logging. Native Cloudflare Workers observability and `/health` probe. Sanitized error messages. | **PASS** |
| **Security & Compliance Standards** | Zero committed credentials (`.dev.vars` gitignored). Edge rate limiting ready. Automated D1 migrations. | **PASS** |
| **Development Workflow & Quality Gates** | Local D1 simulation via `wrangler dev`. Automated seed script (`scripts/seed-d1.ts`). One-command `wrangler deploy`. | **PASS** |

## Project Structure

### Documentation (this feature)

```text
specs/001-exam-practice-api/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output: Cloudflare stack evaluation & decisions
├── data-model.md        # Phase 1 output: D1 SQLite schemas & Drizzle ORM models
├── quickstart.md        # Phase 1 output: Local development & Cloudflare deploy guide
├── contracts/           # Phase 1 output: API interface contracts
│   └── openapi.yaml     # OpenAPI 3.1 specification contract
└── checklists/
    └── requirements.md  # Spec quality validation checklist
```

### Source Code (repository root)

```text
src/
├── api/                        # Hono API sub-routers
│   ├── auth.ts                 # /api/v1/auth (register, login, me)
│   ├── subjects.ts             # /api/v1/subjects (catalog list, details)
│   ├── exams.ts                # /api/v1/exams & /api/v1/subjects/{code}/exams
│   ├── attempts.ts             # /api/v1/attempts (start, save answer, submit, review)
│   ├── questions.ts            # /api/v1/questions/drills & check
│   └── stats.ts                # /api/v1/users/me/stats & attempts history
├── db/                         # Database connection & Drizzle schemas
│   ├── schema.ts               # D1 SQLite table definitions (users, subjects, exams, etc.)
│   └── index.ts                # Drizzle D1 client initialization
├── middleware/                 # Edge middleware
│   ├── auth.ts                 # JWT extraction & verification
│   ├── error.ts                # Centralized exception handler
│   └── logger.ts               # Structured request logger
├── services/                   # Business logic layer
│   ├── auth-service.ts         # User registration, password verification, tokens
│   ├── catalog-service.ts      # Subject and exam queries
│   ├── grading-service.ts      # All-or-nothing grading engine
│   ├── attempt-service.ts      # Wall-clock timer & attempt lifecycle
│   └── stats-service.ts        # Best attempt statistics calculations
├── types/                      # TypeScript definitions & Cloudflare Env bindings
│   ├── env.ts                  # Cloudflare Env (DB: D1Database, JWT_SECRET: string)
│   └── models.ts               # Domain entity types inferred from Drizzle schemas
├── index.ts                    # Main Worker entrypoint (Hono app instance)
└── seed.ts                     # Ingestion parser for exams/ JSON datasets

scripts/
├── seed-d1.ts                  # CLI script to seed D1 database (local & remote)
└── generate-migrations.ts      # Drizzle migration helper

tests/
├── setup.ts                    # Vitest worker environment setup
├── unit/
│   ├── grading.test.ts         # Unit tests for all-or-nothing scoring logic
│   └── stats.test.ts           # Unit tests for best attempt aggregations
└── integration/
    ├── auth.test.ts            # Integration tests for auth endpoints
    ├── catalog.test.ts         # Integration tests for subjects & exams
    ├── attempts.test.ts        # Integration tests for attempts, timer, auto-submit
    └── drills.test.ts          # Integration tests for topical question drills

wrangler.jsonc                  # Cloudflare Workers configuration file
drizzle.config.ts               # Drizzle Kit configuration for D1 migrations
package.json                    # Project dependencies & scripts
tsconfig.json                   # Strict TypeScript compiler options
```

**Structure Decision**: Clean layered modular architecture (Routers -> Middleware -> Services -> Database / Drizzle Schemas). Tailored natively for Cloudflare Workers V8 isolates, enabling fast local execution with Miniflare/Wrangler, zero cold starts, and immediate global deployment.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No constitutional violations identified. The Cloudflare Workers + Hono + D1 stack minimizes operational complexity, eliminates traditional server management, and satisfies all security, testing, and maintainability gates.*

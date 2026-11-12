# FUO Learning Backend API

[![Runtime](https://img.shields.io/badge/Runtime-Cloudflare%20Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Framework](https://img.shields.io/badge/Framework-Hono%20v4-E36002?logo=hono&logoColor=white)](https://hono.dev/)
[![Database](https://img.shields.io/badge/Database-Cloudflare%20D1%20(SQLite)-0051C3?logo=sqlite&logoColor=white)](https://developers.cloudflare.com/d1/)
[![ORM](https://img.shields.io/badge/ORM-Drizzle%20ORM-C5F74F?logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-45%20Passing-brightgreen?logo=vitest&logoColor=white)](https://vitest.dev/)

High-performance, edge-native RESTful backend API for an academic exam practice platform. Built with **TypeScript** and **Hono** deployed on **Cloudflare Workers**, persisting data with **Cloudflare D1** via **Drizzle ORM**, delivering exam diagrams globally with **Cloudflare Workers Static Assets**, and securing endpoints using zero-dependency **Web Crypto** and **JWT**.

---

## Architecture & Tech Stack

```
                     +---------------------------------------+
                     |         Cloudflare CDN Edge           |
                     +---------------------------------------+
                                   |           |
             Static Diagrams (.webp)           API Requests
                                   |           |
                                   v           v
                     +-------------------+  +-------------------+
                     | Workers Assets    |  | Hono Web API      |
                     | (/static/exams/*) |  | (Cloudflare Worker)|
                     +-------------------+  +-------------------+
                                                      |
                                                      v
                                            +-------------------+
                                            |   Drizzle ORM     |
                                            +-------------------+
                                                      |
                                                      v
                                            +-------------------+
                                            | Cloudflare D1 (DB)|
                                            | (Serverless SQL)  |
                                            +-------------------+
```

- **Runtime & Deployment**: [Cloudflare Workers](https://workers.cloudflare.com/)
- **API Framework**: [Hono](https://hono.dev/) with `@hono/zod-openapi` and `@hono/swagger-ui`
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (Serverless distributed SQLite)
- **Object Relational Mapper**: [Drizzle ORM](https://orm.drizzle.team/) & [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview)
- **Asset Delivery**: [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) (serving WebP exam questions & diagrams)
- **Security & Cryptography**: Native [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) (PBKDF2-SHA256 password hashing) + [jose](https://github.com/panva/jose) (JWT token signing & verification)
- **Data Validation**: [Zod](https://zod.dev/)
- **Automated Testing**: [Vitest](https://vitest.dev/) with `@cloudflare/vitest-pool-workers`

---

## Key Features

- **User Authentication & Profiles**: Secure registration, login, and user profile management via PBKDF2 hashing and JWT access tokens.
- **Academic Catalog**: Categorized course subjects (`MAD101`, `NWC204`, `OSG202`, `PRO192`) and past examination papers.
- **Timed Exam Attempts**: Server-enforced wall-clock duration boundaries, live response auto-saving, and automated all-or-nothing grading upon submission.
- **Attempt Review & AI Explanations**: Post-submission unmasked answer keys, detailed AI rationales, option-by-option breakdowns, and static diagram assets.
- **Topical Drill Mode**: Ephemeral single-question drills and instant answer verification without requiring a timed exam session.
- **Student Performance Analytics**: Best-attempt aggregation model tracking total exams passed, overall average scores, pass rates, and paginated history.
- **Interactive OpenAPI & Swagger UI**: Fully documented schemas and interactive API explorer directly at `/ui` and OpenAPI 3.1 JSON at `/docs/openapi.json`.
- **Automated Content Ingestion**: CLI ingestion script (`scripts/seed-d1.ts`) scanning JSON question banks and linking WebP image assets directly into D1.

---

## API Endpoints Reference

| Method | Endpoint | Auth Required | Description |
|---|---|:---:|---|
| `GET` | `/health` | No | System health check and runtime status |
| `GET` | `/ui` | No | Interactive Swagger UI API documentation |
| `GET` | `/docs/openapi.json` | No | OpenAPI 3.1 specification JSON |
| `GET` | `/static/exams/*` | No | Direct access to exam diagrams and icons |
| `POST` | `/api/v1/auth/register` | No | Register a new user account |
| `POST` | `/api/v1/auth/login` | No | Authenticate user and receive JWT access token |
| `GET` | `/api/v1/auth/me` | **Yes** | Get current authenticated user profile |
| `GET` | `/api/v1/subjects` | No | List all available academic subjects |
| `GET` | `/api/v1/subjects/:code` | No | Get details of a specific subject by code |
| `GET` | `/api/v1/subjects/:code/exams` | No | List all exams under a subject |
| `GET` | `/api/v1/exams/:id` | No | Get exam metadata and question count |
| `POST` | `/api/v1/exams/:id/attempts` | **Yes** | Start a new timed exam attempt (unmasked questions) |
| `GET` | `/api/v1/attempts/:id` | **Yes** | Get status and timer bounds of an active attempt |
| `PUT` | `/api/v1/attempts/:id/answers` | **Yes** | Save or update an answer for an in-progress attempt |
| `POST` | `/api/v1/attempts/:id/submit` | **Yes** | Submit an attempt for final automated grading |
| `GET` | `/api/v1/attempts/:id/review` | **Yes** | View post-submission results, explanations, and diagrams |
| `GET` | `/api/v1/questions/drills` | No | Retrieve topical practice questions for quick drills |
| `POST` | `/api/v1/questions/:id/check` | No | Ephemerally check an answer and view explanations |
| `GET` | `/api/v1/users/me/stats` | **Yes** | Get user best-attempt cumulative statistics |
| `GET` | `/api/v1/users/me/attempts` | **Yes** | Get paginated user attempt history |

---

## Project Structure

```
fuo-learning-backend/
├── drizzle/                  # SQL migrations generated by Drizzle Kit
├── exams/                    # Exam assets (JSON question banks & WebP diagrams)
│   ├── MAD101/               # Discrete Mathematics
│   ├── NWC204/               # Computer Networking
│   ├── OSG202/               # Operating Systems
│   └── PRO192/               # Object-Oriented Programming (Java)
├── scripts/
│   └── seed-d1.ts            # Content parsing & D1 database seeder script
├── specs/                    # Project specifications, OpenAPI contracts, and plans
├── src/
│   ├── api/                  # Hono modular route controllers
│   │   ├── attempts.ts       # Exam attempt & submission endpoints
│   │   ├── auth.ts           # Authentication & profile endpoints
│   │   ├── exams.ts          # Exam catalog endpoints
│   │   ├── questions.ts      # Topical drills and instant-check endpoints
│   │   ├── stats.ts          # User performance analytics endpoints
│   │   └── subjects.ts       # Subject catalog endpoints
│   ├── core/                 # Cryptographic security & password utilities
│   ├── db/                   # Drizzle schema & D1 connection setup
│   ├── docs/                 # OpenAPI specification builder
│   ├── middleware/           # Auth guard, request logger, error handler
│   ├── schemas/              # Zod input/output validation schemas
│   ├── services/             # Core business logic & database services
│   ├── types/                # Environment bindings & TypeScript interfaces
│   └── index.ts              # Application entrypoint & asset router
├── tests/                    # Unit and integration test suites
├── wrangler.jsonc            # Cloudflare Workers configuration
├── drizzle.config.ts         # Drizzle configuration
├── package.json              # NPM dependencies and scripts
└── tsconfig.json             # TypeScript configuration
```

---

## Getting Started (Local Development)

### Prerequisites

- **Node.js**: v20+ or v24+
- **npm**: v10+
- **Wrangler CLI**: Installed locally via devDependencies (`npx wrangler`)

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/<your-username>/fuo-learning-backend.git
cd fuo-learning-backend

# Install dependencies
npm install
```

### 2. Environment Variables

Create `.dev.vars` for local development by copying the example file:

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` if needed:
```env
JWT_SECRET=super-secret-jwt-key-for-fuo-exam-practice-local-development-32bytes-min
ENVIRONMENT=development
```

### 3. Database Setup (Local D1)

```bash
# 1. Generate SQL migration files from Drizzle schema (if schema changed)
npm run db:generate

# 2. Apply migrations to the local D1 SQLite database
npm run db:migrate:local

# 3. Seed subjects, exams, questions, and explanations from exams/
npm run db:seed:local
```

### 4. Start Development Server

```bash
npm run dev
```

The server will start at:
- **API Base URL**: `http://localhost:8787`
- **Interactive Swagger UI**: `http://localhost:8787/ui`
- **OpenAPI 3.1 Spec**: `http://localhost:8787/docs/openapi.json`
- **Health Check**: `http://localhost:8787/health`

### 5. Running Tests

```bash
# Run all unit and integration test suites
npm test

# Run tests in watch mode
npm run test:watch
```

---

## Database Management & Reset

### Resetting the Local Database

If you want to clear all data and start fresh in local development:

1. Stop any running dev server (`npm run dev`).
2. Delete the local D1 state directory:
   - **PowerShell (Windows)**:
     ```powershell
     Remove-Item -Recurse -Force .wrangler\state\v3\d1
     ```
   - **Bash / macOS / Linux**:
     ```bash
     rm -rf .wrangler/state/v3/d1
     ```
3. Re-apply schema migrations and re-seed:
   ```bash
   npm run db:migrate:local
   npm run db:seed:local
   ```

### Resetting via SQL (Local or Remote)

Alternatively, execute a clean DROP statement:

```bash
# For Local:
npx wrangler d1 execute DB --local --command="DROP TABLE IF EXISTS attempt_answers; DROP TABLE IF EXISTS exam_attempts; DROP TABLE IF EXISTS user_statistics; DROP TABLE IF EXISTS questions; DROP TABLE IF EXISTS exams; DROP TABLE IF EXISTS subjects; DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS d1_migrations;"
npm run db:migrate:local
npm run db:seed:local

# For Remote:
npx wrangler d1 execute DB --remote --command="DROP TABLE IF EXISTS attempt_answers; DROP TABLE IF EXISTS exam_attempts; DROP TABLE IF EXISTS user_statistics; DROP TABLE IF EXISTS questions; DROP TABLE IF EXISTS exams; DROP TABLE IF EXISTS subjects; DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS d1_migrations;"
npm run db:migrate:remote
npm run db:seed:remote
```

---

## Deployment to Cloudflare Workers

### 1. Authenticate with Cloudflare

```bash
npx wrangler login
```

### 2. Configure Cloudflare Account

If you have multiple Cloudflare accounts, define your target `account_id` in `wrangler.jsonc`:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "fuo-learning-backend",
  "account_id": "<YOUR_CLOUDFLARE_ACCOUNT_ID>",
  "main": "src/index.ts",
  ...
}
```

### 3. Create the Remote D1 Database

```bash
npx wrangler d1 create fuo-learning-db
```

Copy the generated `database_id` and replace the placeholder in `wrangler.jsonc`:

```jsonc
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "fuo-learning-db",
      "database_id": "<YOUR_GENERATED_D1_DATABASE_ID>",
      "migrations_dir": "drizzle"
    }
  ]
```

### 4. Run Migrations & Ingest Content on Remote D1

```bash
# Apply schema to production D1
npm run db:migrate:remote

# Parse exams/ and populate production database
npm run db:seed:remote
```

### 5. Set Production Secrets

```bash
npx wrangler secret put JWT_SECRET
```
*(Enter a secure random string of 32+ characters when prompted).*

### 6. Deploy the Application

```bash
npm run deploy
```

Once deployed, your backend will be live globally on Cloudflare's edge network, serving both API requests and static WebP diagrams.

---

## License

This project is licensed under the [MIT License](LICENSE).

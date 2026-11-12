# Quickstart Validation Guide: Exam Practice Backend API (Cloudflare Stack)

**Feature**: `001-exam-practice-api`  
**Date**: 2026-11-12  
**Target Environment**: Cloudflare Workers + Cloudflare D1  
**Status**: Ready for Implementation  

---

## Prerequisites

- **Node.js**: v20+ or v24+ (verified with Node v24.21.0, npm v11.19.0)
- **Cloudflare Account**: (Free tier is sufficient for Workers + D1 + Assets)
- **Wrangler CLI**: Included as a dev dependency (`wrangler`)
- **Data Source**: Existing `exams/` directory with exam JSON files and `.webp` images.

---

## 1. Environment Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template for local development
cp .dev.vars.example .dev.vars
```

*(Key packages: `hono`, `@hono/zod-openapi`, `drizzle-orm`, `drizzle-kit`, `zod`, `jose` / Web Crypto, `wrangler`, `vitest`).*

---

## 2. Database Migrations & Ingestion (Cloudflare D1)

```bash
# 1. Generate SQL migration files from Drizzle schema
npm run db:generate

# 2. Apply migrations to local D1 database
npm run db:migrate:local

# 3. Seed subjects, exams, questions, and answers from exams/ into local D1
npm run db:seed:local
```

---

## 3. Local Development Server

```bash
# Start local Cloudflare Workers simulator with hot-reload
npm run dev
# or: npx wrangler dev
```

- **Local API Base URL**: http://localhost:8787
- **Interactive OpenAPI Docs**: http://localhost:8787/docs (or Swagger UI at `/ui`)
- **Health Check**: http://localhost:8787/health

---

## 4. End-to-End Validation Scenarios

Refer to [openapi.yaml](contracts/openapi.yaml) for full schema definitions and [data-model.md](data-model.md) for entity lifecycles.

### Scenario A: Authentication & User Profile
1. **Register**: Send `POST http://localhost:8787/api/v1/auth/register` with `{"email": "student@fpt.edu.vn", "password": "StrongPassword123!", "full_name": "Test Student"}`.
   - *Expected*: `201 Created` with JWT `access_token` and user profile object.
2. **Profile**: Send `GET http://localhost:8787/api/v1/auth/me` with header `Authorization: Bearer <TOKEN>`.
   - *Expected*: `200 OK` showing authenticated user details.

### Scenario B: Catalog & Exam Exploration
1. **List Subjects**: Send `GET http://localhost:8787/api/v1/subjects`.
   - *Expected*: `200 OK` containing subjects populated from `exams/` (e.g., `MAD101`, `NWC204`, `OSG202`, `PRO192`).
2. **List Exams**: Send `GET http://localhost:8787/api/v1/subjects/MAD101/exams`.
   - *Expected*: `200 OK` listing exams (e.g., `MAD101 - FA25 - FEB5`) with duration, total questions, and passing score percentage.

### Scenario C: Taking an Exam & Auto-Grading (Core Lifecycle)
1. **Start Attempt**: Send `POST http://localhost:8787/api/v1/exams/{exam_id}/attempts` with Bearer auth.
   - *Expected*: `201 Created` with `attempt_id`, countdown timer bounds (`expires_at`), and question set with choices. Correct answers and explanations are hidden.
2. **Submit Answers**: Send `PUT http://localhost:8787/api/v1/attempts/{attempt_id}/answers` with question ID and option (e.g., `"C"` or `"ACD"`).
   - *Expected*: `200 OK` confirming saved answer.
3. **Finish & Grade**: Send `POST http://localhost:8787/api/v1/attempts/{attempt_id}/submit`.
   - *Expected*: `200 OK` with auto-graded results: `percentage_score`, `correct_answers_count`, and `is_passed`.

### Scenario D: Detailed Review
1. **Review**: Send `GET http://localhost:8787/api/v1/attempts/{attempt_id}/review`.
   - *Expected*: `200 OK` with question-by-question breakdown showing:
     - Student's selected option(s)
     - Correct answer key
     - `is_correct` boolean (evaluated all-or-nothing)
     - `ai_explanation` and `option_by_option_analysis`
     - Static image URL pointing to `/static/exams/.../Q1.webp`

### Scenario E: User Statistics
1. **Get Stats**: Send `GET http://localhost:8787/api/v1/users/me/stats`.
   - *Expected*: `200 OK` showing best-attempt metrics:
     - `total_attempts_count`
     - `total_exams_passed`
     - `overall_pass_rate`
     - `subject_breakdowns` listing per-subject attempts, average scores, and highest scores.

### Scenario F: Ephemeral Question Drill
1. **Get Drills**: Send `GET http://localhost:8787/api/v1/questions/drills?subject_code=MAD101&count=5`.
   - *Expected*: 5 practice questions.
2. **Check Drill**: Send `POST http://localhost:8787/api/v1/questions/{id}/check` with `{"selected_options": "C"}`.
   - *Expected*: Immediate correctness, correct answer, and explanation without altering exam attempt records or statistics.

---

## 5. Automated Test Suite Execution

```bash
# Run unit and integration tests with Vitest
npm test

# Run tests in watch mode
npm run test:watch
```

- Tests execute against an isolated local D1 SQLite database in Miniflare worker environment.
- 100% of test suites must pass before deploying.

---

## 6. One-Command Deployment to Cloudflare

```bash
# 1. Login to Cloudflare
npx wrangler login

# 2. Create remote D1 database (first-time only)
npx wrangler d1 create fuo-learning-db
# (Paste the generated database_id into wrangler.jsonc)

# 3. Apply migrations to production D1 database
npm run db:migrate:remote

# 4. Seed production D1 database from exams/
npm run db:seed:remote

# 5. Set production JWT secret
npx wrangler secret put JWT_SECRET

# 6. Deploy to Cloudflare global edge network
npx wrangler deploy
```

- Your API is live worldwide on `https://fuo-learning-backend.<your-subdomain>.workers.dev` in ~5 seconds!

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types/env";
import { loggerMiddleware } from "./middleware/logger";
import { errorHandler } from "./middleware/error";
import { swaggerUI } from "@hono/swagger-ui";
import { openapiSpec } from "./docs/openapi";
import { authRouter } from "./api/auth";
import { subjectsRouter } from "./api/subjects";
import { examsRouter } from "./api/exams";
import { attemptsRouter, examAttemptsRouter } from "./api/attempts";
import { statsRouter } from "./api/stats";
import { questionsRouter } from "./api/questions";

export const app = new Hono<{ Bindings: Env }>();

// Global Middlewares
app.use("*", cors());
app.use("*", loggerMiddleware);
app.onError(errorHandler);

// Health Check Endpoint
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT || "development"
  });
});

// OpenAPI Spec & Swagger UI
app.get("/docs/openapi.json", (c) => c.json(openapiSpec));
app.get("/ui", swaggerUI({ url: "/docs/openapi.json" }));

// Static exam assets handler (WebP diagrams and icons)
app.get("/static/exams/*", async (c) => {
  if (!c.env.ASSETS) {
    return c.notFound();
  }
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace(/^\/static\/exams/, "");
  return c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw));
});

// Mount Sub-Routers
app.route("/api/v1/auth", authRouter);
app.route("/api/v1/subjects", subjectsRouter);
app.route("/api/v1/exams", examsRouter);
app.route("/api/v1/exams", examAttemptsRouter);
app.route("/api/v1/attempts", attemptsRouter);
app.route("/api/v1/users/me", statsRouter);
app.route("/api/v1/questions", questionsRouter);

export default app;

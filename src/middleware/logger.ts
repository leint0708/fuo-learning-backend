import { createMiddleware } from "hono/factory";

export const loggerMiddleware = createMiddleware(async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  await next();

  const durationMs = Date.now() - start;
  const status = c.res.status;

  const logEntry = {
    timestamp: new Date().toISOString(),
    method,
    path,
    status,
    durationMs,
    userAgent: c.req.header("user-agent") || "unknown"
  };

  console.log(JSON.stringify(logEntry));
});

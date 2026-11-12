import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Env } from "../../src/types/env";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite");

export function createMockD1Database(initSql?: string): D1Database {
  const sqlite = new DatabaseSync(":memory:");

  // Execute base D1 migration
  const migrationPath = path.resolve(process.cwd(), "drizzle", "0000_icy_ultimo.sql");
  if (fs.existsSync(migrationPath)) {
    const migrationSql = fs.readFileSync(migrationPath, "utf8");
    const cleanSql = migrationSql.replace(/--> statement-breakpoint/g, ";");
    sqlite.exec(cleanSql);
  }

  if (initSql) {
    sqlite.exec(initSql);
  }

  const d1Mock = {
    prepare(query: string) {
      let boundParams: any[] = [];
      return {
        bind(...params: any[]) {
          boundParams = params.map((p) => (typeof p === "boolean" ? (p ? 1 : 0) : p));
          return this;
        },
        async run() {
          const stmt = sqlite.prepare(query);
          const res = stmt.run(...boundParams);
          return {
            success: true,
            meta: {
              changes: Number(res.changes),
              last_row_id: Number(res.lastInsertRowid),
              duration: 0,
              served_by: "local-mock"
            }
          };
        },
        async all() {
          const stmt = sqlite.prepare(query);
          const rows = stmt.all(...boundParams);
          return {
            success: true,
            results: rows as any[],
            meta: { duration: 0, served_by: "local-mock", changes: 0, last_row_id: 0 }
          };
        },
        async raw() {
          const stmt = sqlite.prepare(query);
          if (typeof stmt.setReturnArrays === "function") {
            stmt.setReturnArrays(true);
            return stmt.all(...boundParams) as any[];
          }
          const rows = stmt.all(...boundParams) as any[];
          return rows.map((r) => Object.values(r));
        },
        async first(colName?: string) {
          const stmt = sqlite.prepare(query);
          const rows = stmt.all(...boundParams) as any[];
          if (rows.length === 0) return null;
          return colName ? rows[0][colName] : rows[0];
        }
      } as unknown as D1PreparedStatement;
    },
    async batch(stmts: any[]) {
      return Promise.all(stmts.map((s) => (s.run ? s.run() : s.all())));
    },
    async exec(query: string) {
      sqlite.exec(query);
      return { count: 0, duration: 0 };
    },
    dump: async () => new ArrayBuffer(0)
  } as unknown as D1Database;

  return d1Mock;
}

export function createTestEnv(seedSql: boolean = false): Env {
  let initSql: string | undefined;
  if (seedSql) {
    const seedPath = path.resolve(process.cwd(), "scripts", "seed.sql");
    if (fs.existsSync(seedPath)) {
      initSql = fs.readFileSync(seedPath, "utf8");
    }
  }

  const db = createMockD1Database(initSql);
  return {
    DB: db,
    JWT_SECRET: "test-super-secret-jwt-key-for-unit-testing-32-bytes-minimum",
    ENVIRONMENT: "test"
  };
}

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Single connection pool per server instance. `prepare: false` keeps it
 * compatible with transaction-mode poolers (Neon/PgBouncer).
 */
const globalForDb = globalThis as unknown as {
  dbClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.dbClient ??
  postgres(process.env.DATABASE_URL ?? "", { prepare: false });
if (process.env.NODE_ENV !== "production") globalForDb.dbClient = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
/**
 * Union of the db pool and a transaction handle — both expose the same query
 * surface. Use this for functions that need to work inside a transaction
 * (e.g. computeReportPayload called from submitAnswers) and outside it
 * (e.g. the self-healing path in getReportForMember).
 */
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

import nextEnv from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true);
const client = postgres(process.env.DATABASE_URL, { prepare: false });

const failures = [];
const original = console.log;

const statements = [
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "credits" integer DEFAULT 5 NOT NULL`,
  `CREATE TABLE IF NOT EXISTS "agentConfig" (
      "id" serial PRIMARY KEY NOT NULL,
      "agentId" varchar(36) NOT NULL,
      "name" varchar(80) NOT NULL,
      "description" text,
      "agentImage" text NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "userEmail" text NOT NULL,
      CONSTRAINT "agentConfig_agentId_unique" UNIQUE("agentId")
    )`,
  `DO $$ BEGIN
      ALTER TABLE "agentConfig" ADD CONSTRAINT "agentConfig_userEmail_users_email_fk"
      FOREIGN KEY ("userEmail") REFERENCES "public"."users"("email") ON DELETE no action ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

for (const statement of statements) {
  try {
    await client.unsafe(statement);
    original(`OK: ${statement.split("\n")[0].slice(0, 80)}`);
  } catch (error) {
    failures.push(`${statement.slice(0, 60)} -> ${error.message}`);
  }
}

const tables = await client`
  select table_name from information_schema.tables
  where table_schema = 'public' order by table_name
`;
original("TABLES:", tables.map((row) => row.table_name).join(", "));

for (const table of ["users", "agentConfig"]) {
  const columns = await client`
    select column_name, data_type from information_schema.columns
    where table_schema = 'public' and table_name = ${table} order by ordinal_position
  `;
  original(`${table} COLUMNS:`, columns.map((row) => `${row.column_name}:${row.data_type}`).join(", ") || "(none)");
}

const constraints = await client`
  select conname, pg_get_constraintdef(oid) as definition from pg_constraint
  where conrelid = '"agentConfig"'::regclass
`;
original("agentConfig CONSTRAINTS:", JSON.stringify(constraints));

if (failures.length) original("FAILURES:", failures);
await client.end();

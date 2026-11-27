import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq } from "drizzle-orm";
import { loadModule } from "./helpers/load-ts-module.mjs";

test("OAuth profiles persist once and preserve their identity on repeat sign-in", {
  skip: process.env.AEVLO_DATABASE_TEST !== "1" && "Set AEVLO_DATABASE_TEST=1 to verify the configured database.",
}, async (t) => {
  const { default: nextEnvironment } = await import("@next/env");
  nextEnvironment.loadEnvConfig(process.cwd(), true);
  assert.ok(process.env.DATABASE_URL, "Configure DATABASE_URL before the database check.");
  const { db, users } = loadModule("db/index.ts");
  const { saveOAuthUser } = loadModule("db/users.ts");
  t.after(() => db.$client.end({ timeout: 3 }));

  const email = `oauth-test-${randomUUID()}@example.invalid`;
  const rollback = new Error("Roll back the temporary OAuth profile.");

  await assert.rejects(db.transaction(async (transaction) => {
    await saveOAuthUser({ email: ` ${email.toUpperCase()} `, name: " First Name " }, transaction);
    const [first] = await transaction.select().from(users).where(eq(users.email, email));
    assert.ok(first, "A first sign-in must create a profile in the real users table.");
    assert.equal(first.name, "First Name");

    await saveOAuthUser({ email, name: "Updated Name" }, transaction);
    await saveOAuthUser({ email, name: null }, transaction);
    await Promise.all(Array.from({ length: 3 }, () => saveOAuthUser({ email }, transaction)));

    const records = await transaction.select().from(users).where(eq(users.email, email));
    assert.equal(records.length, 1);
    assert.equal(records[0].id, first.id);
    assert.equal(records[0].createdAt.getTime(), first.createdAt.getTime());
    assert.equal(records[0].name, "Updated Name", "A missing provider name must not erase the saved name.");
    throw rollback;
  }), (error) => error === rollback);

  const records = await db.select().from(users).where(eq(users.email, email));
  assert.equal(records.length, 0, "The database check must leave no test user behind.");
});

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadModule } from "./helpers/load-ts-module.mjs";
import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("the public homepage gives visitors a branded entry with working auth destinations", async () => {
  const { default: Home } = await loadModule("app/page.tsx");
  const html = renderToStaticMarkup(React.createElement(Home));
  assert.match(html, /aevlo/i);
  assert.match(html, /href="\/sign-up"/);
  assert.match(html, /href="\/sign-in"/);
  assert.equal((html.match(/<h1(?:\s|>)/g) ?? []).length, 1, "The entry page needs one primary heading.");
});

test("the workspace schema preserves profiles and relates saved agents to their owners", async () => {
  const schema = await loadModule("db/schema.ts");
  assert.deepEqual(Object.keys(schema).sort(), ["agentConfig", "tools", "users"]);
  assert.equal(getTableName(schema.users), "users");
  const columns = getTableColumns(schema.users);
  assert.deepEqual(Object.keys(columns), ["id", "name", "email", "createdAt", "credits"]);
  assert.equal(columns.email.notNull, true);
  assert.equal(columns.email.isUnique, true);
  assert.equal(columns.createdAt.name, "created_at");
  assert.equal(columns.createdAt.notNull, true);
  assert.equal(columns.credits.notNull, true);
  assert.equal(columns.credits.default, 5);

  assert.equal(getTableName(schema.agentConfig), "agentConfig");
  const agentColumns = getTableColumns(schema.agentConfig);
  assert.deepEqual(Object.keys(agentColumns), ["id", "agentId", "name", "description", "agentImage", "createdAt", "userEmail", "tools", "composioSessionId"]);
  assert.equal(agentColumns.tools.notNull, true);
  assert.equal(JSON.stringify(agentColumns.tools.default), "[]");
  assert.equal(getTableName(schema.tools), "tools");
  assert.equal(getTableColumns(schema.tools).slug.isUnique, true);
  assert.equal(agentColumns.id.primary, true);
  assert.equal(agentColumns.agentId.notNull, true);
  assert.equal(agentColumns.agentId.isUnique, true, "Creation requests must be unique even when writes overlap.");
  assert.equal(agentColumns.agentId.length, 36);
  assert.equal(agentColumns.name.notNull, true);
  assert.equal(agentColumns.name.length, 80);
  assert.equal(agentColumns.createdAt.notNull, true);
  assert.equal(agentColumns.createdAt.hasDefault, true);
  assert.equal(agentColumns.userEmail.notNull, true);

  const foreignKeys = getTableConfig(schema.agentConfig).foreignKeys;
  assert.equal(foreignKeys.length, 1);
  const reference = foreignKeys[0].reference();
  assert.equal(reference.columns[0], agentColumns.userEmail);
  assert.equal(reference.foreignTable, schema.users);
  assert.equal(reference.foreignColumns[0], columns.email);
});

const auditedFonts = [
  ["BricolageGrotesque.ttf", "413e7357809ddd12fd80a96a8a396de0e401638d4acd3cb3e37532f0472ac682"],
  ["Manrope.ttf", "3ae11c49db0455a3cc33e37d380f20fdb8c7f8b41dc07625c177e3d87a9d6ae6"],
  ["IBMPlexMono-Regular.ttf", "6a3412f058c7d8dfd9170c41e85ade48e5156ecb89356110ca57a0a27734af46"],
  ["IBMPlexMono-Medium.ttf", "a9b4c49bb299e05b5f6c481e7fb5e78943d2793249a0c8874ab574a2d1ea6755"],
];

for (const [filename, expectedHash] of auditedFonts) {
  test(`the supplied ${filename} binary is preserved without corruption`, async () => {
    const data = await readFile(resolve(root, "fonts", filename));
    assert.equal(data.readUInt32BE(0), 0x00010000, "The source must be a TrueType font, not a webpage.");
    assert.equal(createHash("sha256").update(data).digest("hex"), expectedHash);
  });
}

test("local setup generates a private secret in an unconfigured directory", async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), "aevlo-environment-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const output = execFileSync(process.execPath, [resolve(root, "scripts/local-environment.mjs")], {
    cwd: directory,
    encoding: "utf8",
  });
  const localEnvironment = await readFile(resolve(directory, ".env.local"), "utf8");
  const secret = localEnvironment.match(/^NEXTAUTH_SECRET=(.+)$/m)?.[1]?.trim();
  assert.ok(Boolean(secret && secret.length >= 32), "A sufficiently long local secret is required.");
  assert.ok(!/placeholder|your-random|default-development/i.test(secret), "Do not use a known shared placeholder secret.");
  assert.ok(!output.includes(secret), "Setup must not print the private secret.");
  assert.match(localEnvironment, /^NEXTAUTH_URL=http:\/\/localhost:3000$/m);
});

test("local setup preserves existing private configuration", async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), "aevlo-environment-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const existing = "NEXTAUTH_URL=http://localhost:4000\nNEXTAUTH_SECRET=existing-test-fixture\n";
  await writeFile(resolve(directory, ".env.local"), existing);
  execFileSync(process.execPath, [resolve(root, "scripts/local-environment.mjs")], { cwd: directory });
  assert.equal(await readFile(resolve(directory, ".env.local"), "utf8"), existing);
});

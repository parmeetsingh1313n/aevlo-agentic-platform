import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/load-ts-module.mjs";

const { authOptions } = loadModule("lib/auth.ts");
const { db } = loadModule("db/index.ts");
const { getAuthErrorMessage } = loadModule("lib/auth-ui.ts");

function signIn(user, provider = "google") {
  return authOptions.callbacks.signIn({
    user: { id: "provider-user", ...user },
    account: { provider, type: "oauth", providerAccountId: "provider-user" },
  });
}

test("OAuth sign-in waits for the profile to be saved before succeeding", async (t) => {
  let finishSave;
  const saving = new Promise((resolve) => { finishSave = resolve; });
  t.mock.method(db, "insert", () => ({
    values: () => ({ onConflictDoUpdate: () => saving }),
  }));

  let finished = false;
  const result = signIn({ email: "person@example.com", name: "Person" })
    .then((value) => { finished = true; return value; });
  await Promise.resolve();
  assert.equal(finished, false, "Do not authenticate before the database write completes.");

  finishSave();
  assert.equal(await result, true);
});

test("OAuth profiles without an email cannot sign in or write a user", async (t) => {
  const insert = t.mock.method(db, "insert", () => { throw new Error("Unexpected write"); });
  for (const email of [undefined, null, "", "   "]) {
    assert.equal(await signIn({ email }), "/sign-in?error=OAuthEmailMissing");
  }
  assert.equal(insert.mock.callCount(), 0);
  assert.match(getAuthErrorMessage("OAuthEmailMissing"), /email address/);
});

test("a failed profile write stops Google and GitHub sign-in without exposing the error", async (t) => {
  const privateDetail = "postgresql://private-test-credential";
  t.mock.method(db, "insert", () => ({
    values: () => ({ onConflictDoUpdate: async () => { throw new Error(privateDetail); } }),
  }));
  const logged = [];
  t.mock.method(console, "error", (...args) => { logged.push(args.join(" ")); });

  for (const provider of ["google", "github"]) {
    const result = await signIn({ email: "person@example.com" }, provider);
    assert.equal(result, "/sign-in?error=AccountPersistence");
    assert.ok(!result.includes(privateDetail));
  }
  assert.equal(logged.length, 2);
  assert.ok(logged.every((message) => !message.includes(privateDetail)));
  assert.equal(authOptions.pages.error, "/sign-in");
  assert.match(getAuthErrorMessage("AccountPersistence"), /save your account/);
});

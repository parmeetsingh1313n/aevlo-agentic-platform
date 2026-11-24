import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadModule } from "./helpers/load-ts-module.mjs";

function renderForm(overrides = {}) {
  const { AuthFormView } = loadModule("components/auth/auth-form-view.tsx");
  return renderToStaticMarkup(React.createElement(AuthFormView, {
    mode: "sign-in", availability: { google: true, github: true },
    loadingProvider: null, error: null, switchHref: "/sign-up",
    onContinue: () => {}, ...overrides,
  }));
}

// Break caught: replacing an auth option/link with decoration or losing the
// distinction between returning users and new-account creation.
test("sign-in renders real Google/GitHub controls and an account-creation link", () => {
  const html = renderForm();
  assert.match(html, /<h1[^>]*>Welcome back\.<\/h1>/);
  assert.match(html, /<button[^>]*>[\s\S]*?Continue with Google/);
  assert.match(html, /<button[^>]*>[\s\S]*?Continue with GitHub/);
  assert.match(html, /href="\/sign-up"/);
  assert.doesNotMatch(html, /type="password"/);
});

test("sign-up explains provider-based creation and preserves its returning-user link", () => {
  const html = renderForm({ mode: "sign-up", switchHref: "/sign-in?callbackUrl=%2Fprofile" });
  assert.match(html, /<h1[^>]*>Create your account\.<\/h1>/);
  assert.match(html, /href="\/sign-in\?callbackUrl=%2Fprofile"/);
  assert.match(html, /password/i);
});

// Break caught: enabling duplicate provider submissions during pending work.
test("a pending provider disables both buttons and announces the actual provider", () => {
  const html = renderForm({ loadingProvider: "google" });
  const buttons = html.match(/<button\b[^>]*>/g) ?? [];
  assert.equal(buttons.length, 2);
  assert.ok(buttons.every((button) => /\bdisabled=""/.test(button)));
  assert.match(html, /Connecting to Google/);
  assert.match(html, /role="status"/);
});

test("auth failures are announced without HTML injection", () => {
  const html = renderForm({ error: "Please try again. <script>bad()</script>" });
  assert.match(html, /role="alert"/);
  assert.match(html, /Please try again/);
  assert.doesNotMatch(html, /<script>bad/);
});

// Break caught: an unconfigured preview appears to offer a verified login.
test("missing providers expose local-preview guidance instead of hidden broken configuration", () => {
  const html = renderForm({ availability: { google: false, github: false } });
  assert.match(html, /Local preview/);
  assert.match(html, /OAuth/i);
  assert.match(html, /GOOGLE_CLIENT_ID/);
  assert.match(html, /GITHUB_CLIENT_ID/);
});

test("a configured workspace does not show missing-provider guidance", () => {
  assert.doesNotMatch(renderForm(), /Local preview|GOOGLE_CLIENT_ID|GITHUB_CLIENT_ID/);
});

test("the shared shell identifies routine records as an example and has valid home navigation", () => {
  const { AuthShell } = loadModule("components/auth/auth-shell.tsx");
  const html = renderToStaticMarkup(React.createElement(AuthShell, { mode: "sign-in" }, React.createElement("h1", null, "Sign in")));
  assert.match(html, /Example routine/);
  assert.match(html, /Morning brief/);
  assert.match(html, /Weekly recap/);
  assert.match(html, /href="\/"/);
  assert.match(html, /aria-label="Toggle color theme"/);
  assert.equal((html.match(/<main\b/g) ?? []).length, 1);
});

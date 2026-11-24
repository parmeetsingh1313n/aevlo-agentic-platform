import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/load-ts-module.mjs";

// Break caught: a redirect boundary accepts external/ambiguous destinations,
// or mode switching discards the legitimate workspace destination.
const callbacks = [
  ["a local route with query and fragment", "/settings?tab=routines#weekly", "/settings?tab=routines#weekly"],
  ["a missing callback", null, "/"],
  ["an empty callback", "", "/"],
  ["an absolute external URL", "https://example.org/takeover", "/"],
  ["a protocol-relative URL", "//example.org/takeover", "/"],
  ["a backslash authority", "/\\example.org/takeover", "/"],
  ["encoded leading slashes", "/%2fexample.org/takeover", "/"],
  ["an encoded backslash", "/%5cexample.org/takeover", "/"],
  ["a raw control character", "/settings\n", "/"],
  ["an encoded control character", "/settings%0a", "/"],
  ["a malformed percent escape", "/settings%ZZ", "/"],
  ["a query without a local path", "?callbackUrl=bad", "/"],
];
for (const [name, input, expected] of callbacks) {
  test(`callback normalization handles ${name}`, () => {
    const { getSafeCallbackUrl } = loadModule("lib/auth-ui.ts");
    assert.equal(getSafeCallbackUrl(input), expected);
  });
}

test("switching to sign-up preserves an encoded internal destination", () => {
  const { getAuthSwitchHref } = loadModule("lib/auth-ui.ts");
  assert.equal(getAuthSwitchHref("sign-in", "/settings?tab=routines#weekly"), "/sign-up?callbackUrl=%2Fsettings%3Ftab%3Droutines%23weekly");
});

test("switching to sign-in preserves the destination and avoids unnecessary root queries", () => {
  const { getAuthSwitchHref } = loadModule("lib/auth-ui.ts");
  assert.equal(getAuthSwitchHref("sign-up", "/profile"), "/sign-in?callbackUrl=%2Fprofile");
  assert.equal(getAuthSwitchHref("sign-up", "/"), "/sign-in");
  assert.equal(getAuthSwitchHref("sign-in", "//example.org"), "/sign-up");
});

// Break caught: rendering arbitrary error queries or providing no recovery
// instruction for a known account/provider problem.
test("known OAuth failures give safe recovery guidance", () => {
  const { getAuthErrorMessage } = loadModule("lib/auth-ui.ts");
  assert.match(getAuthErrorMessage("OAuthCallback"), /try again/i);
  assert.match(getAuthErrorMessage("OAuthAccountNotLinked"), /provider.*before/i);
  assert.match(getAuthErrorMessage("Configuration"), /configur|connect/i);
  assert.match(getAuthErrorMessage("AccessDenied"), /access|permission/i);
});

test("unknown query errors are never echoed and an absent error stays absent", () => {
  const { getAuthErrorMessage } = loadModule("lib/auth-ui.ts");
  const message = getAuthErrorMessage("<script>secret-token</script>");
  assert.ok(message);
  assert.doesNotMatch(message, /script|secret-token/);
  assert.equal(getAuthErrorMessage(null), null);
  assert.equal(getAuthErrorMessage(""), null);
});

// Break caught: advertising OAuth as ready without both real credential
// fields, or accidentally returning credential values to a client component.
test("missing OAuth configuration returns only false flags", () => {
  const { getOAuthAvailability } = loadModule("lib/auth-providers.ts");
  assert.deepEqual({ ...getOAuthAvailability({}) }, { google: false, github: false });
});

test("placeholder and whitespace-only OAuth credentials are not considered connected", () => {
  const { getOAuthAvailability } = loadModule("lib/auth-providers.ts");
  const flags = getOAuthAvailability({
    GOOGLE_CLIENT_ID: "your-google-oauth-client-id",
    GOOGLE_CLIENT_SECRET: "placeholder-secret",
    GITHUB_CLIENT_ID: "   ", GITHUB_CLIENT_SECRET: "real-secret",
  });
  assert.deepEqual({ ...flags }, { google: false, github: false });
});

test("a provider needs both real credentials and exposes no secret values", () => {
  const { getOAuthAvailability } = loadModule("lib/auth-providers.ts");
  const flags = getOAuthAvailability({
    GOOGLE_CLIENT_ID: "real-client-id", GOOGLE_CLIENT_SECRET: "real-client-secret",
    GITHUB_CLIENT_ID: "real-client-id", GITHUB_CLIENT_SECRET: "",
  });
  assert.deepEqual({ ...flags }, { google: true, github: false });
  assert.doesNotMatch(JSON.stringify(flags), /real-client/);
});

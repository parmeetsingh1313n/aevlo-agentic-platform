import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

test("real browser traversals block before an earlier Next-like listener and preserve the history stack", {
  skip: process.env.AEVLO_NAVIGATION_BROWSER_TEST !== "1" && "Set AEVLO_NAVIGATION_BROWSER_TEST=1 and AEVLO_PLAYWRIGHT_MODULE_PATH for isolated browser checks.",
}, async (t) => {
  assert.ok(process.env.AEVLO_PLAYWRIGHT_MODULE_PATH, "Point AEVLO_PLAYWRIGHT_MODULE_PATH at the installed Playwright module.");
  const { chromium } = createRequire(import.meta.url)(process.env.AEVLO_PLAYWRIGHT_MODULE_PATH);
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  t.after(() => browser.close());
  const compiled = ts.transpileModule(readFileSync(new URL("../lib/agent-navigation.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  // All requests are fulfilled locally; these checks never use the app or DB.
  for (const nativeNavigation of [true, false]) {
    t.diagnostic(`Checking ${nativeNavigation ? "native interception after Next" : "early popstate fallback"}.`);
    const page = await browser.newPage();
    await page.route("http://navigation-qa.test/**", (route) => route.fulfill({ contentType: "text/html", body: "<p>Isolated navigation check</p>" }));
    await page.goto("http://navigation-qa.test/");
    await page.evaluate(({ source, nativeNavigation }) => {
      if (!nativeNavigation) Object.defineProperty(window, "navigation", { value: undefined });
      const runtime = { exports: {} };
      new Function("module", "exports", source)(runtime, runtime.exports);
      window.agentHistory = runtime.exports;
      window.attempts = [];
      window.nextPops = 0;
      const nextListener = () => { window.nextPops++; window.removeGuard?.(); };
      // Reproduce late hydration on the native path. The fallback listener
      // must instead register before AppRouter's passive effect.
      if (nativeNavigation) window.addEventListener("popstate", nextListener);
      window.agentHistory.prepareNavigationHistory();
      if (!nativeNavigation) window.addEventListener("popstate", nextListener);
      window.agentHistory.installNavigationHistory();
      const wrappedPush = history.pushState;
      window.agentHistory.installNavigationHistory();
      window.singleton = history.pushState === wrappedPush;
      const state = (route) => ({ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { route }, custom: route });
      history.replaceState(state("initial"), "", "/initial");
      history.pushState(state("workspace"), "", "/workspace");
      history.pushState(state("agent"), "", "/workspace/agent");
      window.removeGuard = window.agentHistory.registerAgentHistoryGuard((intent) => window.attempts.push(intent));
    }, { source: compiled, nativeNavigation });
    const original = await page.evaluate(() => ({ state: history.state, length: history.length }));

    await page.evaluate(() => history.back());
    await page.waitForFunction(() => window.attempts.length === 1);
    assert.equal(new URL(page.url()).pathname, "/workspace/agent");
    assert.deepEqual(await page.evaluate(() => history.state), original.state);
    assert.equal(await page.evaluate(() => window.nextPops), 0, "Next must never commit a blocked traversal.");
    assert.equal(await page.evaluate(() => window.attempts[0].delta), -1);

    await page.evaluate(() => window.agentHistory.leaveAgentHistory(window.attempts[0]));
    await page.waitForURL("http://navigation-qa.test/workspace");
    assert.equal(await page.evaluate(() => window.nextPops), 1);
    await page.evaluate(() => history.forward());
    await page.waitForURL("http://navigation-qa.test/workspace/agent");
    assert.equal(await page.evaluate(() => history.length), original.length);

    await page.evaluate(() => {
      history.pushState({ ...history.state }, "", "/workspace/agent?future=1");
      history.back();
    });
    await page.waitForURL("http://navigation-qa.test/workspace/agent");
    await page.evaluate(() => {
      window.attempts = [];
      window.beforeForward = window.nextPops;
      window.removeGuard = window.agentHistory.registerAgentHistoryGuard((intent) => window.attempts.push(intent));
      history.forward();
    });
    await page.waitForFunction(() => window.attempts.length === 1);
    assert.equal(new URL(page.url()).search, "");
    assert.equal(await page.evaluate(() => window.attempts[0].delta), 1);
    assert.equal(await page.evaluate(() => window.nextPops === window.beforeForward), true);
    await page.evaluate(() => window.agentHistory.leaveAgentHistory(window.attempts[0]));
    try {
      await page.waitForURL("http://navigation-qa.test/workspace/agent?future=1", { timeout: 5000 });
    } catch (error) {
      t.diagnostic(JSON.stringify(await page.evaluate(() => ({ href: location.href, state: history.state, tracking: window.__aevloAgentNavigationHistory, attempts: window.attempts, nextPops: window.nextPops }))));
      throw error;
    }
    const final = await page.evaluate(() => ({ state: history.state, length: history.length, singleton: window.singleton, allowed: window.__aevloAgentNavigationHistory.allowed }));
    assert.equal(final.state.__NA, true);
    assert.deepEqual(final.state.__PRIVATE_NEXTJS_INTERNALS_TREE, { route: "agent" });
    assert.equal(final.state.custom, "agent");
    assert.equal(final.length, original.length + 1);
    assert.equal(final.singleton, true);
    assert.equal(final.allowed, false);

    if (nativeNavigation) {
      await page.evaluate(() => history.back());
      await page.waitForURL("http://navigation-qa.test/workspace/agent");
      await page.evaluate(() => {
        window.attempts = [];
        window.removeGuard = window.agentHistory.registerAgentHistoryGuard((intent) => window.attempts.push(intent));
        history.forward();
      });
      await page.waitForFunction(() => window.attempts.length === 1);
      await page.evaluate(() => window.removeGuard());
      await page.goForward({ waitUntil: "commit", timeout: 5000 });
      await page.waitForURL("http://navigation-qa.test/workspace/agent?future=1", { timeout: 5000 });
    }

    await page.evaluate(() => history.pushState(42, "", "/primitive"));
    assert.equal(await page.evaluate(() => history.state), 42, "Primitive states must remain untouched.");
    await page.close();
  }
});

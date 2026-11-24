import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadModule } from "./helpers/load-ts-module.mjs";

// Break caught: a phase advances early/late, does not wrap, or a replay's
// first beat is mistaken for an already-completed routine.
for (const [elapsed, expected] of [[0,0],[599,0],[600,1],[2399,1],[2400,2],[4199,2],[4200,3],[5999,3],[6000,4],[9599,4],[9600,0],[10200,1]]) {
  test(`the example phase at ${elapsed}ms is ${expected}`, () => {
    const { getRoutinePhase } = loadModule("lib/routine-motion.ts");
    assert.equal(getRoutinePhase(elapsed), expected);
  });
}

test("the scheduler wakes only at the next meaningful phase boundary", () => {
  const { getNextRoutineDelay } = loadModule("lib/routine-motion.ts");
  for (const [elapsed, expected] of [[0,600],[600,1800],[2350,50],[5999,1],[6000,3600],[9599,1],[9600,600]]) {
    assert.equal(getNextRoutineDelay(elapsed), expected);
  }
});

test("node states distinguish waiting, the active action, and finished work", () => {
  const { getRoutineStepState } = loadModule("lib/routine-motion.ts");
  assert.equal(getRoutineStepState(0,0), "waiting");
  assert.equal(getRoutineStepState(0,1), "active");
  assert.equal(getRoutineStepState(0,2), "complete");
  assert.equal(getRoutineStepState(1,2), "active");
  assert.equal(getRoutineStepState(2,2), "waiting");
  for (let index=0; index<3; index++) assert.equal(getRoutineStepState(index,4), "complete");
});

// Break caught: visitors cannot pause/replay an autoplay example, or the
// progressive-enhancement/default path hides the actual example content.
test("the real routine preview exposes playback controls and readable default steps", () => {
  const { RoutinePreview } = loadModule("components/auth/routine-preview.tsx");
  const html = renderToStaticMarkup(React.createElement(RoutinePreview));
  assert.match(html, /aria-label="Pause example animation"/);
  assert.match(html, /aria-label="Replay example animation"/);
  assert.match(html, /Example routine/);
  assert.match(html, /Find what matters/);
  assert.equal((html.match(/data-state="complete"/g) ?? []).length, 3);
});

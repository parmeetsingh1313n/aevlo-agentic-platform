// Run on the actual app after the example reaches its completed phase.
/* eslint-disable @typescript-eslint/no-unused-vars */
function checkCompletedRoutineMotion() {
  const preview = document.querySelector('[data-example-routine="true"]');
  const rails = Array.from(preview.querySelectorAll('li[data-state="complete"]'))
    .flatMap((step) => Array.from(step.children).filter((child) => child.matches('span[aria-hidden="true"]')).slice(0, 1));
  const checks = {
    completedPhase: preview.dataset.phase === "4",
    visibleFinishedRails: rails.length === 2 && rails.every((rail) => rail.getBoundingClientRect().height > 1),
    readablePanel: getComputedStyle(preview.parentElement).opacity === "1",
    noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth,
  };
  return { pass: Object.values(checks).every(Boolean), checks, railHeights: rails.map((rail) => rail.getBoundingClientRect().height), motion: preview.dataset.motion };
}

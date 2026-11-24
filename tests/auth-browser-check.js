// Browser-only probe. Invoke checkAuthScreen() on the actual rendered page.
// User interactions (navigation, theme, routine selection, and errors) are
// additionally driven by Playwright rather than simulated DOM click events.
/* eslint-disable @typescript-eslint/no-unused-vars */
async function checkAuthScreen() {
  await document.fonts.ready;
  const root = document.documentElement;
  const firstFamily = (family) => family.split(",")[0].replace(/["']/g, "").trim();
  const variables = getComputedStyle(root);
  const heading = document.querySelector("h1");
  const buttons = Array.from(document.querySelectorAll("button")).filter((button) => /Continue with (Google|GitHub)/.test(button.textContent));
  const expectedBody = variables.getPropertyValue("--font-manrope").trim();
  const expectedHeading = variables.getPropertyValue("--font-bricolage").trim();
  const isAuthRoute = /\/(sign-in|sign-up)$/.test(location.pathname);
  const checks = {
    onePrimaryHeading: document.querySelectorAll("h1").length === 1,
    oneVisibleWordmark: Array.from(document.querySelectorAll('a[aria-label="Aevlo home"]')).filter((link) => link.getClientRects().length > 0).length === 1,
    visibleHeading: Boolean(heading && heading.getBoundingClientRect().width > 0),
    noHorizontalOverflow: root.scrollWidth <= innerWidth,
    suppliedBodyFont: Boolean(expectedBody) && firstFamily(getComputedStyle(document.body).fontFamily) === firstFamily(expectedBody),
    suppliedHeadingFont: Boolean(expectedHeading && heading) && firstFamily(getComputedStyle(heading).fontFamily) === firstFamily(expectedHeading),
    bothProviderButtons: !isAuthRoute || buttons.length === 2,
    comfortableProviderTargets: !isAuthRoute || buttons.every((button) => button.getBoundingClientRect().height >= 44),
    noPretendPasswordForm: !document.querySelector('input[type="password"]'),
    originalIcon: Boolean(document.querySelector('link[rel="icon"][href*="icon.svg"]')),
    themeControl: Boolean(document.querySelector('button[aria-label="Toggle color theme"]')),
  };
  return { pass: Object.values(checks).every(Boolean), checks, route: location.pathname, theme: root.classList.contains("dark") ? "dark" : "light", viewport: { width: innerWidth, height: innerHeight }, scrollWidth: root.scrollWidth };
}

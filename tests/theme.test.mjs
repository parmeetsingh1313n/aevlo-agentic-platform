import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function luminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (values[1] + 0.05) / (values[0] + 0.05);
}

// Break caught: a palette/theme change makes body, form, or action text
// unreadable. The assertions constrain contrast, not particular brand colors.
for (const scope of [":root", ".dark"]) {
  test(`${scope} text and primary controls meet the WCAG AA contrast floor`, async () => {
    const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
    const escaped = scope.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const block = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]+)\\}`))?.[1] ?? "";
    const tokens = new Map([...block.matchAll(/(--[\w-]+):\s*(#[\da-f]{6})\s*;/gi)].map((match) => [match[1], match[2]]));
    for (const [text, surface] of [
      ["--foreground", "--background"], ["--card-foreground", "--card"],
      ["--muted-foreground", "--background"], ["--muted-foreground", "--muted"],
      ["--primary-foreground", "--primary"], ["--foreground", "--auth-story"],
      ["--muted-foreground", "--auth-story"], ["--success", "--card"],
    ]) {
      assert.ok(tokens.has(text) && tokens.has(surface), `Missing measurable palette pair ${text}/${surface}`);
      const ratio = contrast(tokens.get(text), tokens.get(surface));
      assert.ok(ratio >= 4.5, `${scope} ${text}/${surface} contrast ${ratio.toFixed(2)} is below 4.5:1`);
    }
  });
}

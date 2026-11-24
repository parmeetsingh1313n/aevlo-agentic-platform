import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // Vendored shadcn primitives are kept as shipped. Their generated patterns
  // intentionally differ from the rules we apply to application code.
  {
    files: ["components/ui/**", "hooks/use-mobile.ts"],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".reference/**",
    ".superpowers/**",
    ".playwright-mcp/**",
    ".firecrawl/**",
  ]),
]);

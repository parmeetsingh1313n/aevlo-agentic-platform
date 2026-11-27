import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as lucide from "lucide-react";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cache = new Map();

// Execute actual project modules and dependencies. Only bundler-owned CSS
// mappings are substituted; no React components or auth functions are mocked.
export function loadModule(relativePath) {
  return load(resolve(root, relativePath));
}

function load(filename) {
  // Aliases and direct paths must share one module instance on Windows.
  filename = resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  assert.ok(existsSync(filename), `Not implemented yet: ${filename}`);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  const targetModule = { exports: {} };
  cache.set(filename, targetModule);
  const nativeRequire = createRequire(filename);
  const projectRequire = (specifier) => {
    // Lucide's installed require export points at CJS-in-.js under type:module.
    // Use its real native ESM namespace, the same entry Next's bundler consumes.
    if (specifier === "lucide-react") return lucide;
    if (specifier.endsWith(".css")) {
      return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    }
    if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      const base = specifier.startsWith("@/")
        ? resolve(root, specifier.slice(2))
        : resolve(dirname(filename), specifier);
      const candidate = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]
        .find((path) => existsSync(path) && [".ts", ".tsx"].includes(extname(path)));
      if (candidate) return load(candidate);
    }
    return nativeRequire(specifier);
  };
  runInNewContext(compiled.outputText, {
    module: targetModule, exports: targetModule.exports, require: projectRequire,
    process, console, URL, URLSearchParams, Request, Response, Headers, Buffer, setTimeout, clearTimeout,
  }, { filename });
  return targetModule.exports;
}

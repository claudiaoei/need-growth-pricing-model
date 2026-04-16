// Node ESM loader used by the smoke test.
//   • Adds `.js` to extensionless relative specifiers (Next.js convention)
//   • Redirects `file-saver` to an in-memory no-op shim so we don't need
//     browser-only globals (the smoke test intercepts output via Blob instead)

import { pathToFileURL } from "node:url";

const FILE_SAVER_SHIM = pathToFileURL(new URL("./file-saver-shim.mjs", import.meta.url).pathname).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "file-saver") {
    return { url: FILE_SAVER_SHIM, shortCircuit: true };
  }
  if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("file:")) {
    try {
      return await nextResolve(specifier, context);
    } catch (err) {
      if (err?.code === "ERR_MODULE_NOT_FOUND" || err?.code === "ERR_UNSUPPORTED_DIR_IMPORT") {
        for (const ext of [".js", ".mjs", ".cjs", "/index.js"]) {
          try {
            return await nextResolve(specifier + ext, context);
          } catch { /* try next */ }
        }
      }
      throw err;
    }
  }
  return nextResolve(specifier, context);
}

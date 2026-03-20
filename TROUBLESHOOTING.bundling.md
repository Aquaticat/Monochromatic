# Bundling Troubleshooting

Issues with client-side bundling, tree-shaking, and Node.js code leaking into browser bundles.

## `node:` protocol imports cause CORS errors in browser bundles

### Problem

A browser console shows errors like:

```
Access to script at 'node:fs/promises' from origin 'http://localhost:4400'
has been blocked by CORS policy: Cross origin requests are only supported
for protocol schemes: chrome, chrome-extension, chrome-untrusted, data,
http, https, isolated-app.

node:fs/promises:1  Failed to load resource: net::ERR_FAILED
```

The application still works (logging falls back to other sinks),
but the errors are noisy and confusing.

### Root cause

The client-side tsdown config (`config-tsdown/.client.ts`) uses
`deps.alwaysBundle: [/^@monochromatic-dev\//]` to inline all workspace packages.
When a workspace package contains dynamic `import('node:...')` calls --
even inside functions guarded by try-catch --
the bundler preserves them in the output as dynamic imports.

At runtime, the browser encounters the dynamic `import('node:fs/promises')`
and attempts to fetch it as a URL.
The fetch fails at the network level (CORS block on the `node:` protocol),
and the browser logs the error to the console **before** the JavaScript
promise rejection reaches the catch handler.

The catch handler does catch the resulting JS error,
so the application works correctly -- but the browser has already printed
the network-level error to the console.

Key insight: **try-catch around a dynamic `import()` catches the JavaScript error,
but cannot suppress the browser's network error log for the failed fetch.**

### Affected pattern

Any module that:

1. Is statically imported (directly or transitively) into a client-side entry point
2. Contains dynamic `import('node:...')` calls, even inside try-catch

The `module-es` logger's file sink (`t sink/t file`) was the first instance.
The file sink uses `await import('node:fs/promises')` inside `verify()`
and `$()`, both wrapped in try-catch.
The default logger factory statically imports all sinks including the file sink,
so the file sink code ends up in any client bundle that uses the logger.

### Fix

Guard the dynamic import with a synchronous Node.js environment check
that runs **before** the `import()` call:

```typescript
if (typeof globalThis.process === 'undefined'
  || typeof globalThis.process.versions?.node === 'undefined') {
  return false;
}

// Only reached in Node.js
const { appendFile } = await import('node:fs/promises');
```

This prevents the browser from ever attempting the `node:` fetch.
The module stays in the bundle (it is small), but short-circuits immediately
in non-Node environments.

### What does not work

- **Relying on try-catch alone**: the catch handler works for JS error propagation,
  but the browser still logs the network error before the catch runs.
- **Marking `node:fs/promises` as external in the client config**: the bundler
  leaves the import as-is, and the browser still tries to fetch it at runtime.
- **Tree-shaking**: dynamic imports inside functions are not statically analyzable,
  so bundlers cannot eliminate them. The static import chain from
  the logger factory to the file sink module means the file sink code is always included.

### Prevention

When writing modules that will be bundled for both Node.js and browser targets:

- Guard all `node:` dynamic imports with a synchronous environment check
  (e.g. `globalThis.process.versions?.node`) before the `import()` expression
- Do not rely on dynamic import failure as the sole browser detection mechanism --
  it works logically but produces ugly console errors
- Consider whether the module needs `node:` imports at all;
  if not, keep them out of the static import graph entirely

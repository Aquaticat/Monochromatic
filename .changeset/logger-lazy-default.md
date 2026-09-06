---
"@monochromatic-dev/module-logger": minor
---

The default logger is built by the first log or flush call instead of at import,
 the default sink list is created at that moment,
 and the package declares `sideEffects: false`.
Importing the root entry or `tagged` now runs no sink discovery,
 no timers,
 and no I/O,
 so global-scope-restricted runtimes such as Cloudflare Workers start without the four sink-verification warnings.
The `initPromise` root export is removed;
 `flush()` awaits readiness internally,
 and `createLogger` still returns its instance's `initPromise`.

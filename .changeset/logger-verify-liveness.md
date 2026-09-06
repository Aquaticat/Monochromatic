---
"@monochromatic-dev/module-logger": minor
---

Sinks now verify concurrently,
 each under a time limit.
A backend probe that never answers no longer starves the sinks after it or keeps the logger from initializing.
The limit is the new `createLogger` option `verifyTimeoutMs` (default `DEFAULT_VERIFY_TIMEOUT_MS`,
 5000 ms).

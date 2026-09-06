# @monochromatic-dev/module-logger

## 0.2.0

### Minor Changes

- Records logged before every sink has answered its verify now buffer under `STARTUP_BUFFER_CAP` (10000,
   exported).
  On overflow the oldest buffered record is dropped,
   and once initialization completes one `warn` record naming the dropped count is written to every available sink.
  Commit `fee2427`.
- Sinks now verify concurrently,
   each under a time limit.
  A backend probe that never answers no longer starves the sinks after it or keeps the logger from initializing.
  The limit is the new `createLogger` option `verifyTimeoutMs` (default `DEFAULT_VERIFY_TIMEOUT_MS`,
   5000 ms).
  Commit `ee58222`.

## 0.1.0

### Minor Changes

- First npm release.
  Console output neutralizes terminal control characters.
  `flush()` runs under a deadline (`flushDeadlineMs`).
  The published package exposes the built artifact only.
  Commit `77ba394`.

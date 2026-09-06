---
"@monochromatic-dev/module-logger": minor
---

Records logged before every sink has answered its verify now buffer under `STARTUP_BUFFER_CAP` (10000,
 exported).
On overflow the oldest buffered record is dropped,
 and once initialization completes one `warn` record naming the dropped count is written to every available sink.

---
"@monochromatic-dev/module-logger": minor
---

The root entry is now platform-neutral and neither built artifact contains a dynamic `import()`.
`createFileSink` moved to `@monochromatic-dev/module-logger/node`;
 `createIndexedDbSink` and `createOpfsSink` moved to `@monochromatic-dev/module-logger/browser`.
The default logger keeps file logging under the `node` export condition and IndexedDB under `default`;
 a Node consumer whose bundler resolves `default` no longer gets file logging.

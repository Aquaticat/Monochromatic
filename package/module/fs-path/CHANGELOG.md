# @monochromatic-dev/module-fs-path

## 0.1.0

### Minor Changes

- First release.
  The root entry is platform-neutral (POSIX path operations and the mise,
   git,
   and pnpm root finders) and runs under Node,
   Bun,
   and browsers,
   where root discovery reads the origin private file system.
  `ensureDir`,
   `ensureFile`,
   `ensurePath`,
   `emptyDir`,
   `emptyFile`,
   `emptyPath`,
   `removeEmptyFilesInDir`,
   `findPackageRoot`,
   and `findPackageRootCached` ship from `@monochromatic-dev/module-fs-path/node`.
  Backends are chosen by export condition through `package.json` `imports`;
   neither built artifact contains a dynamic `import()`,
   and `happy-opfs` is no longer a dependency.
  `normalize` is public and delegates to `node:path/posix` under the `node` condition;
   `dirnameFallback`,
   `joinFallback`,
   and `resolveFallback` are no longer exported.
  `ensureDir` and `ensureFile` now grant the owner read and write bits when repairing an inaccessible path instead of setting mode `0o006`.
  `findMiseMonorepoRoot` now matches a `[monorepo]` header on the first line of `mise.toml` and on a last line without a trailing newline.
  Commit `bbb3954`.

# @monochromatic-dev/config-rolldown

Shared raw-rolldown build configuration for Monochromatic packages.
Successor to `@monochromatic-dev/config-tsdown`;
see `doc/planning/tsdown-removal.md` for the migration record
and `doc/philosophy/tool-choices.md` for the bundler decision.

## Flavors

- `./.ts`:
  neutral (browser-compatible) library builds,
  declarations via `rolldown-plugin-dts` with the `oxc` generator,
  output `dist/final/neutral/[name].mjs`.
- `./.node.ts`:
  Node library,
   CLI,
   and plugin builds,
  same declaration setup,
  output `dist/final/node/[name].mjs`.
  `perEntryNodeConfig` builds each input as its own self-contained bundle
  so committed and published bundles keep stable names and no shared chunks.
- `./.client.ts`:
  self-contained browser scripts,
  no declarations,
  output `dist/client/[name].js`.

## Behavior notes

- Externalization reads the consuming package's `package.json` at build time:
  declared dependencies and peer dependencies stay external
  unless a bundle pattern forces them inline;
  undeclared bare imports (transitives of inlined workspace source) bundle by
  omission so artifacts stay self-contained outside the monorepo.
- Targets come from Browserslist through `browserslistTargets`,
  formatted as rolldown engine strings
  (rolldown rejects raw Browserslist queries).
- Raw rolldown's `output.cleanDir` is per-config and not watch-safe;
  per-entry configs sharing an out dir keep it off
  and rely on the owning mise task's pre-clean step.

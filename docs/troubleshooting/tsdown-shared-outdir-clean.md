# tsdown 0.22: two configs writing to one outDir delete each other's output, because clean defaults to true and resolves to the whole outDir

When a package builds two bundles into the same directory with two tsdown configs (here:
Electron main process ESM and sandboxed preload CJS,
 both into `dist/app`),
 the second run's
default clean pass removes the first run's artifacts.
The build reports success;
 the missing file is only discovered when the app fails to start or
a later stage misses an input.

Found while building `packages/desktop-app/file-manager-electron`:
 the preload build printed
`Cleaning 1 files` and deleted `dist/app/main.mjs` produced seconds earlier.

## Symptom

```txt
ℹ Build start
ℹ Cleaning 1 files
✔ Build complete in 11ms
```

in the SECOND tsdown invocation,
 followed by the prior bundle being absent from the shared
outDir.
 No error,
 no warning naming the deleted file.

## Root cause

tsdown resolves `clean` to `true` by default and expands `true` to the whole outDir.
From the installed package (tsdown 0.22.4 read from the pnpm store;
 behavior observed
identically under 0.22.3,
 which the builds print):

`tsdown/dist/options-BFfWGQT3.mjs:720` (option defaults):

```js
let { entry, format, plugins = [], clean = true, ... , outDir = "dist", ... } = ...
```

`tsdown/dist/options-BFfWGQT3.mjs:57`:

```js
if (clean === true) clean = [slash(outDir)];
else if (!clean) clean = [];
```

and `cleanOutDir` (`options-BFfWGQT3.mjs:30`) globs those paths and removes matches.
Each tsdown invocation knows only its own config,
 so a sibling config's artifacts in the same
outDir are indistinguishable from stale output.

## Verification

Environment:
 tsdown 0.22.3 at build time (catalog `>=0.22.3`),
 two configs:
`tsdown.main.config.ts` (esm,
 `outDir: 'dist/app'`) and `tsdown.preload.config.ts`
(cjs,
 same outDir).

- Both configs default clean:
   running main then preload leaves only `preload.cjs`;
  `dist/app/main.mjs` is gone (the symptom log above).
- With `clean: false` in the preload config:
   both artifacts present after the sequence;
   the
  package's `build:clean` mise task owns directory hygiene instead.
  Verified by every green `mise run //packages/desktop-app/file-manager-electron:build` since.

## Verified workarounds

- Set `clean: false` on every config after the first one writing into a shared outDir,
   and do
  directory cleaning once,
   up front (this package's `build:clean` task).
  Tradeoff:
   stale files from renamed entries linger until the explicit clean step runs;
  acceptable because the mise `build` task always runs `build:clean` first.
- Alternative not used:
   separate outDirs per config plus a copy/stage step.
  Tradeoff:
   an extra stage and doubled artifacts.

## What does not work

- Relying on invocation order or timing:
   the clean is unconditional per run;
   the second run
  always wins.

## Upstream filing decision

`.out-of-scope/` was checked:
 no tsdown exemption exists.

1. Really upstream's fault?
    No;
    `clean: true` defaulting to the config's own outDir is
   reasonable,
    documented option behavior,
    and the multi-config-one-outDir arrangement is
   ours.
2. Can upstream fix it?
    Conceivably (e.g. cleaning only files the config would emit),
    but that
   is a design change,
    not a defect fix.
3. Supported use case?
    Multiple configs are supported;
    sharing one outDir between them with
   default clean is not a documented pattern.
4. Would the repo welcome the contribution?
    Not evaluated;
    constraint 1 fails.
5. Will they likely fix it?
    Nothing to fix.
6. Prototyped minimal fix?
    Not applicable;
    one-line consumer-side option recorded above.

Decision:
 nothing to file.

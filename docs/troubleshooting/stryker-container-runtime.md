# StrykerJS 9.6.1 in a Fedora mutation runtime: isolated pnpm, missing `ps`, and package config failures

## Symptom

The file-enforcer mutation smoke repeatedly failed before the final dry-run and one-file mutation pass.
The visible failures were distinct runtime setup issues:

- `Cannot find Checker plugin "typescript". In fact, no Checker plugins were loaded.`
- `Error: spawn ps ENOENT` during Stryker child cleanup.
- TypeScript checker dry-run errors such as `TS5097`,
   missing Node/Bun globals,
   and later missing
  `dist/final/node/index.mjs` imports from unit tests.
- Initial test-run failure from selected tests spawning `bun`,
   for example `Error: spawn bun ENOENT`.

The final verified dry-run was:

```bash
# /var/home/user/Monochromatic
mise run //packages/dev-script/file-enforcer:test:mutation -- \
  --dry-run-only --workers 1 --memory 2g --cpus 2 \
  --session-timeout-seconds 600 src/io/glob-mirror.ts
```

It completed successfully with Stryker reporting `Initial test run succeeded` and
`The dry-run has been completed successfully`.

The final verified real one-file mutation run was:

```bash
# /var/home/user/Monochromatic
mise run //packages/dev-script/file-enforcer:test:mutation -- \
  --workers 1 --memory 2g --cpus 2 \
  --session-timeout-seconds 600 src/io/glob-mirror.ts
```

It completed successfully with 66 mutants instrumented,
 score `78.43%`,
 `40` killed,
 `11` survived,
and `15` compile errors.

## Root cause

The failures came from the interaction between this repository's isolated pnpm layout,
 Stryker's plugin and
checker loading rules,
 and the intentionally minimal Fedora runtime image.

### Stryker default plugin glob expects plugins beside Stryker core

Stryker's schema says the default plugin descriptor is `@stryker-mutator/*` and that those modules should be
installed next to Stryker.
`/tmp/agent/stryker-js-20260606/packages/api/schema/stryker-core.json:415` shows the documented default:

```json
// /tmp/agent/stryker-js-20260606/packages/api/schema/stryker-core.json
"plugins": {
  "description": "With 'plugins', you can add additional Node modules for Stryker to load...",
  "type": "array",
  "items": {
    "type": "string"
  },
  "default": [
    "@stryker-mutator/*"
  ]
}
```

The plugin loader resolves a glob by walking the organization directory relative to the loader module path.
`/tmp/agent/stryker-js-20260606/packages/core/src/di/plugin-loader.ts:127` shows the path construction:

```ts
// /tmp/agent/stryker-js-20260606/packages/core/src/di/plugin-loader.ts
const pluginDirectory = path.resolve(
  fileURLToPath(new URL('../../../../../', import.meta.url)),
  org,
);
const regexp = new RegExp('^' + pkg.replace('*', '.*'));
this.log.debug('Loading %s from %s', pluginExpression, pluginDirectory);
const plugins = (await fs.promises.readdir(pluginDirectory))
```

Under this workspace's isolated pnpm layout,
 `@stryker-mutator/core` and
`@stryker-mutator/typescript-checker` are not discovered as siblings through that default glob from the
container working package.
 The checker worker then tries to instantiate each configured checker name.
`/tmp/agent/stryker-js-20260606/packages/core/src/checker/checker-worker.ts:13` shows that `checkers:
['typescript']` is resolved through `pluginCreator.create`:

```ts
// /tmp/agent/stryker-js-20260606/packages/core/src/checker/checker-worker.ts
public static inject = tokens(commonTokens.options, coreTokens.pluginCreator);
constructor(options: StrykerOptions, pluginCreator: PluginCreator) {
  this.innerCheckers = new Map(
    options.checkers.map((name) => [
      name,
      pluginCreator.create(PluginKind.Checker, name),
    ]),
  );
}
```

When no checker plugins were loaded,
 this produced the observed `Cannot find Checker plugin "typescript"`
failure.
 The consumer-side fix is to pass the TypeScript checker plugin entry file explicitly in the generated
Stryker config.

### Stryker cleanup reaches `tree-kill`, which reaches `ps` on Linux

Stryker disposes child process proxies by calling `objectUtils.kill`.
`/tmp/agent/stryker-js-20260606/packages/core/src/child-proxy/child-process-proxy.ts:333` shows the dispose
path:

```ts
// /tmp/agent/stryker-js-20260606/packages/core/src/child-proxy/child-process-proxy.ts
public async dispose(): Promise<void> {
  if (!this.isDisposed) {
    this.worker.removeListener('close', this.handleUnexpectedExit);
    this.isDisposed = true;
    this.log.debug('Disposing of worker process %s', this.worker.pid);
    this.disposeTask = new ExpirableTask(TIMEOUT_FOR_DISPOSE);
    this.send({ kind: WorkerMessageKind.Dispose });
    try {
      await this.disposeTask.promise;
    } finally {
      this.log.debug('Kill %s', this.worker.pid);
      await objectUtils.kill(this.worker.pid);
    }
```

`/tmp/agent/stryker-js-20260606/packages/core/src/utils/object-utils.ts:64` delegates that kill operation to
`tree-kill`:

```ts
// /tmp/agent/stryker-js-20260606/packages/core/src/utils/object-utils.ts
kill(pid: number | undefined): Promise<void> {
  return new Promise((res, rej) => {
    treeKill(pid!, 'SIGKILL', (err?: Error & { code?: number }) => {
      if (err && !canIgnore(err.code)) {
        rej(err);
      } else {
        res();
      }
    });
```

`tree-kill` on Linux shells out to `ps`,
 so a minimal Fedora image without `procps-ng` fails with
`spawn ps ENOENT`.
 The cloned upstream source at `/tmp/agent/node-tree-kill-20260607/index.js:45` shows this
Linux branch:

```js
// /tmp/agent/node-tree-kill-20260607/index.js
buildProcessTree(pid, tree, pidsToProcess, function (parentPid) {
  return spawn('ps', ['-o', 'pid', '--no-headers', '--ppid', parentPid]);
}, function () {
    killAll(tree, signal, callback);
});
```

The consumer-side fix is to install Fedora `procps-ng` in the mutation runtime image.

### The TypeScript checker rewrites only the configured root tsconfig

The TypeScript checker stores `options.tsconfigFile` directly and tracks the resolved configured file.
`/tmp/agent/stryker-js-20260606/packages/typescript-checker/src/typescript-compiler.ts:56` shows the
constructor:

```ts
// /tmp/agent/stryker-js-20260606/packages/typescript-checker/src/typescript-compiler.ts
constructor(
  private readonly log: Logger,
  private readonly options: StrykerOptions,
  private readonly fs: HybridFileSystem,
) {
  this.tsconfigFile = toPosixFileName(this.options.tsconfigFile);
  this.allTSConfigFiles = new Set([path.resolve(this.tsconfigFile)]);
}
```

Only tracked tsconfig files are adjusted during reads.
 The adjustment parses and overrides compiler options in
`/tmp/agent/stryker-js-20260606/packages/typescript-checker/src/typescript-compiler.ts:278`:

```ts
// /tmp/agent/stryker-js-20260606/packages/typescript-checker/src/typescript-compiler.ts
private adjustTSConfigFile(
  fileName: string,
  content: string,
  buildModeEnabled: boolean,
) {
  const parsedConfig = ts.parseConfigFileTextToJson(fileName, content);
  if (parsedConfig.error) {
    return content; // let the ts compiler deal with this error
  } else {
    for (const referencedProject of retrieveReferencedProjects(
      parsedConfig,
      path.dirname(fileName),
    )) {
      this.allTSConfigFiles.add(referencedProject);
    }
    return overrideOptions(parsedConfig, buildModeEnabled);
  }
}
```

In this repo,
 `tsconfig.json` extends `@monochromatic-dev/config-typescript/dom`.
 Feeding Stryker the small
extends-based package config made the checker compile with unresolved or incomplete effective options,
 which
surfaced as `TS5097` and missing Node/Bun globals.
 The consumer-side fix is not to hand-code the shared
options.
 Instead,
 run TypeScript's own `tsc --showConfig --project tsconfig.json` in the target package and
write the resolved JSON to `tsconfig.mutation.json`.

After that,
 the resolved config included every package test.
 Several tests intentionally import built
`dist/final/node/index.mjs`,
 but the mutation runtime excludes `dist`.
 The consumer-side fix is to keep the
showConfig-derived compiler options while replacing `include` with `files: [mutateFile]`,
 so the checker
only validates the current production source file.

### Package integration tests spawned Bun directly

The repository has migrated away from Bun.
 The mutation runtime intentionally installs Node and pnpm only.
Some file-enforcer integration and regression fixture tests still spawned `bun` to execute temporary config
files.
 Once integration tests were selected by default,
 Stryker's initial run failed with `spawn bun ENOENT`.
The consumer-side fix is to update those tests to spawn `node` for temporary TypeScript config files.

### Fresh image rebuild fails: mise installs pnpm with pnpm

This surfaced later, when wiring a second consumer (`packages/module/jsonc-edit`) forced a fresh
runtime image build (the runtime-inputs hash had drifted, so no cached image matched).
The `Containerfile` bootstrap runs `mise trust /baked/mise.toml` then
`mise install --yes node npm:pnpm`.
The baked `mise.toml` sets `npm.package_manager = "pnpm"`, so once trusted, mise installs the
`npm:pnpm` tool by running `pnpm add --global pnpm@<version> ... --config.minimumReleaseAge=1440`.
In a fresh container pnpm does not exist yet, so that command fails:

```text
mise ERROR Failed to install npm:pnpm@latest: failed to execute command:
  pnpm add --global pnpm@11.9.0 ... --config.minimumReleaseAge=1440: No such file or directory (os error 2)
```

The image build aborts at that `RUN` step, so no consumer can run mutation testing until a fresh
image builds.
The pnpm-installs-pnpm bootstrap is circular only during the very first install; once pnpm exists,
the later `pnpm install --frozen-lockfile` step is fine.

## Verification

Source versions inspected:

- StrykerJS upstream clone:
   `/tmp/agent/stryker-js-20260606`,
   commit
  `bb4b05435c731a912f95299cfbd19eeff6e75c76`,
   origin
  `https://github.com/stryker-mutator/stryker-js.git`.
- tree-kill upstream clone:
   `/tmp/agent/node-tree-kill-20260607`,
   commit
  `cb478381547107f5c53362668533f634beff7e6e`,
   origin
  `https://github.com/pkrumins/node-tree-kill`.
- Installed runtime package versions under this repo:
   `@stryker-mutator/core@9.6.1`,
  `@stryker-mutator/typescript-checker@9.6.1`,
   and `tree-kill@1.2.2`.

Commands verified in this repository:

```bash
# /var/home/user/Monochromatic
mise run //packages/dev-script/mutation-test:build
mise run //packages/dev-script/mutation-test:lint:types
mise run //packages/dev-script/mutation-test:lint:oxlint
mise run //packages/dev-script/mutation-test:test:unit
mise run //packages/dev-script/file-enforcer:build
mise run //packages/dev-script/file-enforcer:lint:types
mise run //packages/dev-script/file-enforcer:lint:oxlint
mise run //packages/dev-script/file-enforcer:test:unit
mise run //packages/dev-script/file-enforcer:test:mutation -- \
  --dry-run-only --workers 1 --memory 2g --cpus 2 \
  --session-timeout-seconds 600 src/io/glob-mirror.ts
mise run //packages/dev-script/file-enforcer:test:mutation -- \
  --workers 1 --memory 2g --cpus 2 \
  --session-timeout-seconds 600 src/io/glob-mirror.ts
```

Working patterns:

- Explicit checker plugin path with `checkers: ['typescript']` loads the TypeScript checker in the container.
- Fedora runtime with `procps-ng` lets Stryker dispose child process trees without `spawn ps ENOENT`.
- `tsconfig.mutation.json` derived from `tsc --showConfig` preserves this repo's Node-native TypeScript
  options without hard-coded config duplication.
- `files: [mutateFile]` avoids package test imports of excluded built `dist` artifacts during checker startup.
- File-enforcer fixture configs spawned through `node` run in the mutation runtime without installing Bun.

Failing patterns that reproduced earlier:

- Relying on Stryker's default `@stryker-mutator/*` glob under this isolated pnpm layout failed to load the
  TypeScript checker.
- Omitting `procps-ng` from the Fedora runtime produced `spawn ps ENOENT` through `tree-kill`.
- Feeding the TypeScript checker the package's small extends-based tsconfig produced `TS5097` and missing
  runtime type diagnostics.
- Letting showConfig include every test produced missing `dist/final/node/index.mjs` diagnostics because the
  runtime source copy deliberately excludes `dist`.
- Keeping Bun spawns in selected file-enforcer tests produced `spawn bun ENOENT`.

## Verified workarounds

### Explicit checker plugin path

Patch the generated Stryker config to include the baked TypeScript checker entrypoint.
The applied code lives in `packages/dev-script/mutation-test/src/stryker-config.ts`.

Tradeoff:
 the path is runtime-image specific.
 That is acceptable here because the runtime image owns the
Stryker dependency tree,
 and the image hash includes mutation-test runtime source and dependency inputs.

### Install Fedora `procps-ng`

Patch `packages/dev-script/mutation-test/runtime/Containerfile` to install `procps-ng` with the other system
runtime dependencies.

Tradeoff:
 it adds a small system package to the image.
 It avoids changing Stryker or monkey-patching
`tree-kill`,
 and it matches Stryker's actual transitive cleanup path.

### Generate `tsconfig.mutation.json` from TypeScript showConfig

Patch `packages/dev-script/mutation-test/src/mutation-tsconfig.ts` to call `tsc --showConfig --project
 tsconfig.json`,
 parse the JSON,
 drop `include`,
 and write `files: [mutateFile]`.

Tradeoff:
 the checker compiles only the mutated production file,
 not every test.
 Stryker still executes the
selected tests at runtime.
 This keeps checker startup focused on type-invalid mutant classification instead
of package test build-artifact imports.

### Run file-enforcer config fixtures through Node

Patch selected file-enforcer tests and helpers to spawn `node` instead of `bun` for temporary config files.

Tradeoff:
 config fixtures now follow the repository's migration direction.
 Tests that are explicitly about
Bun behavior should stay out of mutation runtime selection or be rewritten separately.

### Force npm for the in-container pnpm bootstrap

`packages/dev-script/mutation-test/runtime/Containerfile` exports
`MISE_NPM_PACKAGE_MANAGER=npm` for the bootstrap `RUN` step, overriding the baked
`npm.package_manager = "pnpm"` setting so mise installs `npm:pnpm` with npm (bundled with
node) instead of the not-yet-present pnpm:

```dockerfile
RUN export MISE_NPM_PACKAGE_MANAGER=npm \
  && mise trust /baked/mise.toml \
  && mise install --yes node npm:pnpm \
  && ...
```

The override is scoped to that one `RUN` step, so the host config (which legitimately prefers
pnpm where pnpm already exists) is unchanged.
Verified by a fresh image build followed by a Stryker dry run: the in-container
`pnpm install --frozen-lockfile` completes, and `Initial test run succeeded` /
`The dry-run has been completed successfully`.

## `convert-source-map` is carried transitively but never loaded

StrykerJS pulls `convert-source-map` through `@stryker-mutator/instrumenter` ->
`@babel/core@7.29.7`.
 The repo bans that package,
 so the blocklist substitutes it with the
throw-on-import stub `@monochromatic-dev/stub-throwing`.
 This does not break mutation testing:
the instrumenter is parse-only (`babel.parseAsync` + manual `traverse` + `@babel/generator`)
and never enters Babel's `transform` pipeline,
 the only place `@babel/core` requires
`convert-source-map`.
 The stub is therefore never imported at runtime (verified empirically with
a `Module._load` interceptor:
 a real instrumentation run loaded it zero times).
 Do not treat the
install-time `[blocked-dep]` warning for `convert-source-map` as a Stryker runtime failure,
 and do
not add it to an allowlist.
 See the `convert-source-map` deep-dive in
`docs/troubleshooting/dependencies.md` for the full evidence and the revisit triggers.

## What does not work

- Installing Bun in the mutation runtime solves `spawn bun ENOENT`,
   but it works against the repository's
  Bun migration.
   The accepted fix is to run selected fixtures through Node.
- Handwriting the mutation tsconfig in source works briefly but duplicates shared TypeScript config.
   The
  accepted fix is TypeScript `--showConfig` post-processing.
- Stryker sandbox mode is still not suitable here because it excludes `node_modules`,
   which breaks isolated
  pnpm package-local dependency layout.
- Relying on root `/baked/node_modules` as a single symlink is not enough for package-export resolution through
  `/work`.
   The runtime recreates root and package-local symlink farms so workspace links resolve to `/work`
  source while package-manager store links resolve to `/baked`.

## Upstream filing artifact

### Upstream filing decision

`.out-of-scope/` was checked with `find .out-of-scope -maxdepth 2 -type f -print`;
 no Stryker or tree-kill
exemption was present.

Duplicate searches were run with:

```bash
# /var/home/user/Monochromatic
gh search issues --repo stryker-mutator/stryker-js "typescript checker pnpm plugins" --limit 5
gh search issues --repo stryker-mutator/stryker-js "Cannot find Checker plugin typescript pnpm" --limit 5
gh search issues --repo stryker-mutator/stryker-js "tree-kill ps ENOENT" --limit 5
gh search prs --repo stryker-mutator/stryker-js "typescript checker pnpm plugins" --limit 5
gh search prs --repo stryker-mutator/stryker-js "tree-kill ps ENOENT" --limit 5
```

Those searches returned no matching rows.

Six-constraint check:

1.  Is it really upstream's fault?
     No. Stryker documents that default plugin discovery expects plugins next
    to Stryker,
     `tree-kill` documents its Linux `ps` use in source,
     and the TypeScript checker behavior is
    compatible with a consumer-provided resolved config.
2.  Can upstream fix it?
     Partly,
     but not as a single upstream bug.
     Better plugin diagnostics or checker config
    docs could help,
     but our failures were container packaging and config choices.
3.  Are they supporting this use case?
     Stryker supports command runner and TypeScript checker usage.
     It does
    not specifically promise a minimal Fedora image or this repo's isolated workspace symlink topology.
4.  Would the repo welcome our contribution?
     Not evaluated further because constraint 1 failed.
     No
    `.out-of-scope/` exemption matched.
5.  Will they likely fix it?
     Not evaluated further because constraint 1 failed.
6.  Have we prototyped a minimal upstream fix?
     No upstream fix was prototyped because the accepted fixes are
    consumer-side runtime and config changes.

Decision:
 do not file upstream.
 There is no issue or comment draft to keep because the actionable fixes live
in this repository's runtime image,
 generated config,
 and tests.

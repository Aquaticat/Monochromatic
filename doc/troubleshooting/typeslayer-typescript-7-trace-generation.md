# TypeSlayer 0.1.32 fails TypeScript 7.0.2 trace generation at an unexported compiler subpath

## Symptom

Selecting any package in this workspace and asking TypeSlayer 0.1.32 to generate a trace fails before
TypeScript checks the selected project:

```text
Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './bin/tsc' is not defined by "exports" in
/var/home/user/Monochromatic/node_modules/typescript/package.json
```

The observed environment was:

```text
TypeSlayer 0.1.32
TypeScript 7.0.2
Node.js 26.5.0
pnpm 11.15.1
```

`pnpm-workspace.yaml:143` selects TypeScript 7 for the workspace catalog:

```yaml
  'typescript': '>=7.0.2'
```

The failure applies across selected packages because TypeSlayer deliberately runs the compiler that resolves from the
selected project.
 Packages in this workspace resolve the catalog's TypeScript 7.0.2 installation.

## Root cause

This is a TypeSlayer 0.1.32 compatibility gap with TypeScript 7,
 not a bad `tsconfig.json` and not a missing compiler.
There are two independent incompatibilities.

### TypeSlayer requires a private TypeScript package subpath

TypeSlayer selects a package-manager-specific Node command in
`packages/typeslayer/src-tauri/src/app_data/mod.rs:201-223` at TypeSlayer commit
`436dfa8ddd10802ec41137c1d8d0f53628ca8fff`:

```rust
pub fn get_tsc_call(&self, user_flags: &str) -> TSCCommand {
    // ...
    match self.package_manager {
        PackageManager::Yarn => args.extend(["yarn", "node"]),
        PackageManager::PNPM => args.extend(["pnpm", "exec", "node"]),
        PackageManager::Bun => args.extend(["bun", "run", "node"]),
        PackageManager::NPM => args.extend(["node"]),
    };
```

The same function constructs a `require()` call to the compiler's internal `bin` path at
`packages/typeslayer/src-tauri/src/app_data/mod.rs:243-253`:

```rust
args.push("--eval");

let compiler_variant = self.settings.typescript_compiler_variant;
let compiler_require = format!(
    r#""require('{}/bin/{}')""#,
    compiler_variant.npm_package(),
    compiler_variant.as_str()
);
args.push(&compiler_require);
```

For the default compiler and this pnpm workspace,
 the resulting command begins with:

```text
pnpm exec node --eval "require('typescript/bin/tsc')" slay-gurrrl-slay
```

TypeScript 7.0.2 does contain an executable at `bin/tsc`.
Its published manifest maps the command name to that file at
`node_modules/typescript/package.json:34-36`:

```json
"bin": {
    "tsc": "./bin/tsc"
}
```

The `bin` field tells package managers which command shim to create.
 It does not make the same path importable.
TypeScript 7 also defines an export map at `node_modules/typescript/package.json:37-51`,
 and that map does not include
`./bin/tsc`:

```json
"exports": {
    "./package.json": "./package.json",
    ".": "./lib/version.cjs",
    "./unstable/sync": "./dist/api/sync/api.js",
    "./unstable/async": "./dist/api/async/api.js",
    "./unstable/fs": "./dist/api/fs.js"
}
```

Node's package-entry-point rules make unlisted subpaths private once `exports` exists.
 Node therefore rejects
TypeSlayer's package specifier before loading the compiler.
 This behavior has existed since Node 12,
 so Node 26 emits
the diagnostic but did not introduce the incompatibility.

TypeScript 6.0.2 has no `exports` field and permits the same deep import.
 This version boundary was verified directly.

### TypeScript 7 trace output does not match TypeSlayer's loader

Resolving the compiler executable by its absolute package-bin path bypasses the first failure and starts TypeScript 7.
That alone is not a complete fix.

TypeScript 7 creates one type tracer for each checker.
 At the exact 7.0.2 source tag
`typescript/v7.0.2`,
 commit `2bd066d87f5bafd315be9f40889d0a60b9e58e0b`,
`internal/tracing/tracing.go:413-432` assigns each checker a separate file and records it in a legend:

```go
// NewTypeTracer creates a new tracer for a specific checker.
// The checkerIndex is used to create unique filenames for each checker's output.
func (tr *Tracing) NewTypeTracer(checkerIndex int) Tracer {
    // ...
    typesPath := tspath.CombinePaths(tr.traceDir, fmt.Sprintf("types_%d.json", checkerIndex))
    // ...
    tr.legend = append(tr.legend, TraceRecord{
        ConfigFilePath: tr.configFilePath,
        TracePath:      tr.tracePath,
        TypesPath:      typesPath,
        CheckerID:      checkerIndex,
    })
```

`internal/tracing/tracing.go:466-478` writes `legend.json`:

```go
// Sort legend entries by typesPath for deterministic output
slices.SortFunc(tr.legend, func(a, b TraceRecord) int {
    return strings.Compare(a.TypesPath, b.TypesPath)
})

// Write the legend file
legendPath := tspath.CombinePaths(tr.traceDir, "legend.json")
legendData, err := json.MarshalIndent(tr.legend, "", "  ")
// ...
if err := tr.fs.WriteFile(legendPath, string(legendData)); err != nil {
```

By contrast,
 TypeSlayer fixes its expected type filename to `types.json` in
`packages/typeslayer/src-tauri/src/validate/types_json.rs:9`:

```rust
pub const TYPES_JSON_FILENAME: &str = "types.json";
```

Its generation validator then reads that exact file at
`packages/typeslayer/src-tauri/src/commands/generate.rs:31-55`:

```rust
pub async fn validate_types_and_trace_async(
    outputs_dir: &str,
) -> Result<((TypesJsonSchema, usize), (Vec<TraceEvent>, usize)), String> {
    let types_path = Path::new(outputs_dir).join(TYPES_JSON_FILENAME.trim_start_matches('/'));
    // ...
    let (types_res, trace_res) = tokio::join!(
        load_types_json(types_path.clone()),
        load_trace_json(trace_path.clone())
    );
```

A TypeScript 7.0.2 trace of the fixture in the Verification section produced:

```text
legend.json
trace.json
types_0.json
types_1.json
types_2.json
types_3.json
```

Even `--singleThreaded` produced `legend.json`,
 `trace.json`,
 and `types_0.json`,
 not `types.json`.

The initial hypothesis that changing only the compiler entrypoint would restore TypeScript 7 support was therefore
incomplete.
 The package-bin resolver successfully printed `Version 7.0.2`,
 but a real trace exposed the second,
independent output-format mismatch.

## Verification

### Versions and source

- Installed TypeSlayer:
   npm package `typeslayer@0.1.32`,
   which was also the npm `latest` tag on 2026-07-25.
- TypeSlayer source:
   tag `typeslayer-v0.1.32`,
   commit
  `436dfa8ddd10802ec41137c1d8d0f53628ca8fff`.
- Installed TypeScript:
   npm package `typescript@7.0.2`,
   manifest `gitHead`
  `2bd066d87f5bafd315be9f40889d0a60b9e58e0b`.
- TypeScript native source:
   tag `typescript/v7.0.2`,
   the same commit.
- Comparison compiler:
   npm package `typescript@6.0.2`.
- Runtime:
   `Node.js` 26.5.0.

### Minimal resolver harness

From this repository:

```bash
node --eval "require('typescript/bin/tsc')"
```

Observed result with TypeScript 7.0.2:

```text
Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './bin/tsc' is not defined by "exports"
```

The same check against a disposable TypeScript 6.0.2 installation succeeds:

```bash
npm install --ignore-scripts --save-dev --save-exact typescript@6.0.2
node --eval "require('typescript/bin/tsc')" slay-gurrrl-slay --version
```

Observed result:

```text
Version 6.0.2
```

### Trace-layout harness

Fixture source:

```typescript
// index.ts
export type Box<T> = { readonly value: T };
export const box: Box<string> = { value: "ok" };
```

Fixture configuration:

```json
// tsconfig.json
{
  "compilerOptions": {
    "noEmit": true,
    "strict": true
  },
  "include": ["index.ts"]
}
```

TypeScript 6.0.2,
 using TypeSlayer's original compiler-loading pattern:

```bash
node --eval "require('typescript/bin/tsc')" slay-gurrrl-slay \
  --noEmit --incremental false --noErrorTruncation \
  --generateTrace outputs --project tsconfig.json
find outputs -maxdepth 1 -type f -printf '%f\n' | sort
```

Observed result:

```text
trace.json
types.json
```

Both files parsed as JSON arrays.
 The fixture produced 614 trace events and 30,563 type entries.

TypeScript 7.0.2,
 invoked through its actual executable so the export-map failure cannot mask later behavior:

```bash
node node_modules/typescript/bin/tsc \
  --noEmit --incremental false --noErrorTruncation \
  --generateTrace outputs --project tsconfig.json
find outputs -maxdepth 1 -type f -printf '%f\n' | sort
```

Observed result:

```text
legend.json
trace.json
types_0.json
types_1.json
types_2.json
types_3.json
```

### Behavior catalog

Works cleanly:

- TypeSlayer's `require('typescript/bin/tsc')` pattern with TypeScript 6.0.2.
- TypeScript 6.0.2 trace generation with the `trace.json` plus `types.json` layout TypeSlayer expects.
- Direct TypeScript 7.0.2 CLI invocation through `node_modules/typescript/bin/tsc`.

Fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`:

- `require('typescript/bin/tsc')` with TypeScript 7.0.2.
- TypeSlayer 0.1.32 trace generation when its default `tsc` variant resolves TypeScript 7.0.2.

Runs the compiler but remains incompatible with TypeSlayer's loader:

- Resolving TypeScript 7's `bin.tsc` through its exported `package.json` and requiring the resulting absolute path.
- Direct TypeScript 7 trace generation,
   which writes checker-specific `types_N.json` files and `legend.json`.
- TypeScript 7 with `--singleThreaded`,
   which writes `types_0.json` rather than `types.json`.

## Verified workarounds

### Run the analysis with the actual TypeScript 6.0.2 package named `typescript`

Use a disposable analysis checkout or fixture whose `typescript` dependency is exactly 6.0.2:

```json
{
  "devDependencies": {
    "typescript": "6.0.2"
  }
}
```

After installing that fixture,
 TypeSlayer's existing compiler command resolves and produces the two files its loader
expects.
 The full compiler invocation and output layout were verified in the Trace-layout harness.

Tradeoffs:

- The trace describes TypeScript 6 behavior and performance,
   not the native TypeScript 7 compiler.
- TypeScript 7-only configuration,
   syntax,
   or behavior can prevent the analysis checkout from compiling under 6.0.2.
- Replacing this workspace's catalog version would affect every TypeScript consumer,
   so a disposable analysis checkout
  is safer than changing the main workspace merely for TypeSlayer.

TypeSlayer's own FAQ documents importing an existing `trace.json` plus `types.json` pair through
`Raw Data | trace.json`,
 followed by regenerating its analyzed trace and type graph.
 That route can consume the verified
TypeScript 6 pair without asking TypeSlayer to launch the compiler.
 The UI upload itself was not exercised in this
investigation.

## What does not work

- **Selecting a different package in this monorepo.
  ** The selected packages still resolve the workspace's TypeScript
  7.0.2 catalog installation.
- **Reinstalling or updating the mise tool.
  ** TypeSlayer 0.1.32 was both the installed release and npm's current
  `latest` release during verification.
- **Changing only Node.
  ** The error follows the TypeScript 7 export map.
   Node's documented export encapsulation applies
  across supported Node releases,
   and the same TypeScript 7 error class has been reported under Node 24.
- **Changing the deep import to `typescript/lib/tsc.js`.
  ** TypeScript 7 does not export that subpath either.
- **Bypassing the export map with an absolute path.
  ** This starts TypeScript 7 but exposes the unsupported
  `legend.json` plus `types_N.json` layout.
- **Adding `--singleThreaded`.
  ** This reduces the trace to one checker shard,
   but its name remains `types_0.json` and
  TypeSlayer still asks for `types.json`.
   Renaming the file was not treated as a verified workaround because TypeSlayer's
  trace and type schemas have not been validated end to end against TypeScript 7 output.
- **Treating this as a pnpm layout bug.
  ** A plain Node `require()` in a minimal fixture reproduces the same export error.

## Upstream filing artifact

### Upstream filing decision

No matching `.out-of-scope/` exemption exists.
 The TypeScript project-reference and low-impact formatter exemptions are
unrelated to TypeSlayer compiler loading or trace formats.

The upstream tracker search inspected all 26 TypeSlayer issues and all 11 pull requests visible on 2026-07-25 for
`ERR_PACKAGE_PATH_NOT_EXPORTED`,
 `TypeScript 7`,
 `types_0.json`,
 and `legend.json`.
 It found no duplicate.
 Issue
[dimitropoulos/typeslayer#28](https://github.com/dimitropoulos/typeslayer/issues/28) mentions
`typescript/bin/tsc`,
 but it covers the distinct case where TypeScript is not installed.

The six filing constraints resolve as follows:

1. **Is it really upstream's fault?
   ** Yes as a TypeSlayer compatibility gap.
    TypeSlayer hardcodes an unexported compiler
   subpath and assumes the pre-TypeScript-7 trace layout.
    It is not a TypeScript defect because TypeScript's export map
   and checker-sharded trace files are deliberate package and compiler behavior.
2. **Can upstream fix it?
   ** Yes.
    TypeSlayer can invoke the package's declared executable rather than a private subpath,
   then teach its loader and graph model to consume `legend.json` and checker-specific type files.
3. **Are they supporting this use case?
   ** No documented TypeScript 7 support was found.
    TypeSlayer 0.1.32 shipped on
   2026-03-23,
    before TypeScript 7.0.2 shipped on 2026-07-08.
    Its FAQ explicitly says the native compiler available at
   that release did not yet generate the traces TypeSlayer required.
    This constraint fails.
4. **Would the repo welcome our contribution?
   ** Yes.
    The README invites contributions and imposes only its commit-message
   convention.
    `CONTRIBUTING.md`,
    the repository templates,
    and recent tracker contents contain no ban on external or
   AI-assisted reports.
5. **Will they likely fix it?
   ** Soft yes.
    No decline or non-goal was found.
    There is also no positive implementation
   signal:
    no matching issue or pull request exists,
    and the relevant TypeSlayer source has not changed since 0.1.32.
6. **Have we prototyped a minimal fix compatible with their architecture?
   ** No. A compiler-entrypoint prototype passed
   `--version` but failed the real compatibility requirement because TypeScript 7 writes a different trace layout.
    A
   complete fix must cover both boundaries and needs schema tests against multiple checker shards.

Constraint 3 fails,
 so the auto-prototype requirement does not trigger.
 The incomplete entrypoint-only experiment is
recorded under What does not work rather than retained as a candidate patch.
 Default policy is not to file.
 The draft
remains a record to revisit once TypeSlayer claims TypeScript 7 support or a complete multi-shard prototype exists.

### Draft issue, do not file as-is

~~~md
Title: TypeScript 7 trace generation fails at `typescript/bin/tsc` and uses an unsupported sharded output layout

Labels: bug, TypeScript 7

## Description

TypeSlayer 0.1.32 cannot generate traces for `typescript@7.0.2`.

The first failure is:

```text
Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './bin/tsc' is not defined by "exports"
```

TypeSlayer constructs `require('typescript/bin/tsc')` in
`packages/typeslayer/src-tauri/src/app_data/mod.rs:243-253`. TypeScript 7's published export map exposes
`./package.json`, the package root, and unstable API paths, but not `./bin/tsc`.

There is a second incompatibility after resolving the executable by absolute path. TypeScript 7 creates one
`types_N.json` file per checker and records those files in `legend.json`
(`microsoft/typescript-go` `internal/tracing/tracing.go:413-432,466-478`). TypeSlayer fixes
`TYPES_JSON_FILENAME` to `types.json` and reads that exact file in
`packages/typeslayer/src-tauri/src/commands/generate.rs:31-55`.

## Reproduction

With `typescript@7.0.2` installed:

```bash
node --eval "require('typescript/bin/tsc')"
```

This throws `ERR_PACKAGE_PATH_NOT_EXPORTED`.

Bypass that first failure and generate a real trace:

```bash
node node_modules/typescript/bin/tsc \
  --noEmit --incremental false --noErrorTruncation \
  --generateTrace outputs --project tsconfig.json
find outputs -maxdepth 1 -type f -printf '%f\n' | sort
```

A default run produces:

```text
legend.json
trace.json
types_0.json
types_1.json
types_2.json
types_3.json
```

`--singleThreaded` still produces `types_0.json`, not `types.json`.

For comparison, TypeScript 6.0.2 accepts TypeSlayer's current deep import and emits:

```text
trace.json
types.json
```

## Suggested fix

1. Resolve and execute each compiler package's declared `bin` entry without importing the private `package/bin/name`
   subpath. Preserve the existing Node memory-option behavior and Yarn PnP path.
2. Detect `legend.json`, load every referenced `types_N.json` file, and preserve `checkerId` while correlating trace
   events with type IDs.
3. Add integration fixtures for TypeScript 6's single `types.json` layout and TypeScript 7's default multi-checker and
   `--singleThreaded` layouts.

## Workaround

Run TypeSlayer against an actual `typescript@6.0.2` package in a disposable analysis checkout. This uses the classic
compiler and therefore does not profile TypeScript 7's native performance.
~~~

# Oxlint 1.74.0: prefer-readonly cache rebuild makes a 13-file lint take 62.9 seconds

## Symptom

The package-scoped command:

```bash
mise run //package/config/oxlint:lint:oxlint
```

reported no diagnostics,
but spent 62.9 seconds on 13 files:

```text
Found 0 warnings and 0 errors.
Finished in 62.9s on 13 files with 479 rules using 16 threads.
```

The file count and thread count are misleading for this incident.
The run paid for one cold,
whole-project analysis in the project-owned
`prefer-readonly-parameter-type/prefer-readonly-parameter-types` JavaScript rule.
An unchanged repeat of the exact mise task finished in 1.0 seconds.

## Root cause

### The package task enables a project-owned semantic rule

`mise.toml:581-588` builds the bundled config when necessary,
then invokes Oxlint with type-aware linting:

```toml
[task_templates."lint:oxlint"]
description = "Lint with Oxlint"
shell = "node --input-type=module-typescript -e"
run = """
{{vars.dispatch_workspace_node}}
ensureOxlintConfig()
runWorkspaceNode('package/dev-script/task-util', 'oxlint-wrapper', ['--type-aware'])
"""
```

The slow work is not Oxlint's Go type-aware engine.
The project-owned JavaScript rule opens its own TypeScript 7 synchronous API.
For every linted TypeScript file,
`package/oxlint-plugin/prefer-readonly-parameter-type/src/prefer-readonly-parameter-types.ts:154-181`
opens the semantic project and requests a whole-project effect index:

```typescript
Program(node: ForeignBorrowed<ESTree.Program>,): void {
  if (!isEnforcedTypeScriptSource(context.filename,))
    return;
  // ...
  const session = openSemanticFile({
    fileName: context.filename,
    sourceText: context.sourceCode.text,
    hasBOM: context.sourceCode.hasBOM,
  },);
  const effectIndex = buildEffectSummaryIndex({
    project: session.project,
    activeSourceFile: session.sourceFile,
  },);
```

The semantic project contained 834 source files in the reproduction.
Only 13 files were Oxlint targets.
`effect-summaries.ts:87-145` starts from every TypeScript project source and retains non-declaration
workspace dependencies,
so the semantic rule's workload is not bounded by Oxlint's displayed target count:

```typescript
const fileNames = [...new Set([
  ...project.program.getSourceFileNames(),
  activeSourceFile.fileName,
],),].toSorted();

const indexedSourceFiles = fileNames.flatMap(function retainIndexedSource(fileName,): SourceFile[] {
  // ...
  if (!project.program.isSourceFileFromExternalLibrary(sourceFile,))
    return [sourceFile,];
  if (isWorkspaceSourceFileName(fileName,))
    return [sourceFile,];
  // ...
},);
```

The current cache scope held 337 indexed source entries.
In the 62.9-second run,
the first `openSemanticFile` record appeared at `02:09:21.909Z`.
The second appeared at `02:10:23.792Z`.
The first file therefore consumed 61.883 seconds building the project index;
the remaining file callbacks reused the process-local final index.

`effect-final-index-cache.ts:99-108` explains that within-process reuse:

```typescript
const cached = finalIndexByProject.get(projectKey,);
if ((cached === undefined)
  || (cached.fileListDigest !== fileListDigest)
  || (!sourceSignaturesEqual({
    left: cached.sourceSignatures,
    right: sourceSignatures,
  },)))
  return FINAL_EFFECT_INDEX_CACHE_MISS;
```

### This run had no reusable persistent entry set

All 337 cache entries for
`package/config/oxlint/tsconfig.json`
had modification times inside the 63.030-second logger interval.
They totalled 2,755,625 bytes.
The rule rebuilt the current schema-2 entry set instead of reading a reusable set.

The evidence proves a cold current identity,
but does not distinguish among these immediate triggers:

- analyzer digest rotation after semantic-plugin source changes;
- project membership or declaration-surface changes;
- compiler-option or lockfile changes;
- first run after cache deletion or schema rotation.

A disposable-worktree probe confirmed the invalidation mechanism.
A project file-list change rotated `fileListDigest` and produced a 64.3-second rebuild.
With no further source change,
the same custom-rule run finished in 894 milliseconds,
and the exact mise task finished in 1.0 seconds.

### Cold analysis repeats synchronous manifest misses

The cold run also exposed a local hot path.
`intrinsic-effect-query.ts:69` caches parsed identities by discovered package root:

```typescript
const packageIdentityByRoot = new Map<string, PackageIdentity | typeof NO_PACKAGE_IDENTITY>();
```

However,
`intrinsic-effect-query.ts:115-139` walks from each declaration directory to a package manifest and logs every
missing candidate:

```typescript
if (markerIndex === (-1)) {
  for (const directory of ancestorDirectories(dirname(normalized,),)) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(
        `${directory}/package.json`,
        'utf8',
      ),);
      if (hasPackageIdentityFields(parsed,)) {
        return {
          packageRoot: directory,
          packageName: parsed.name,
        };
      }
    }
    catch (error) {
      l.debug(`could not read workspace package identity in ${directory}: ${String(error,)}`,);
    }
  }
}
```

`intrinsic-effect-query.ts:189-203` performs this directory walk before consulting the root cache:

```typescript
const rootAndName = packageRootAndName(fileName,);
if (rootAndName === NO_PACKAGE_IDENTITY)
  return NO_PACKAGE_IDENTITY;
const cached = packageIdentityByRoot.get(rootAndName.packageRoot,);
```

The observed run wrote 21,616 `intrinsic-effect-query` records,
including 11,878 failed reads of a `src/package.json` path.
The file sink appends every record as JSONL at
`package/module/logger/src/sink/file.ts:274-283`:

```typescript
async function write(record: object,): Promise<void> {
  // ...
  await state.appendFile(
    state.filePath,
    `${JSON.stringify(record,)}\n`,
  );
}
```

Caching each visited directory's resolved package root or negative result is a direct local optimization target.
The diagnosis did not modify that code because the user requested an explanation,
not a performance fix.

### Sixteen Rust threads do not parallelize the semantic callback

The upstream source audit used Oxc tag `apps_v1.74.0`,
commit `2d4e8d20644e0e7446f0a381894b45ea339a0625`.
`apps/oxlint/src/js_plugins/external_linter.rs:151-198` says the callback runs on the main JavaScript thread,
while the calling Rust worker blocks on `rx.recv()`:

```rust
/// `ThreadsafeFunction` executes the callback
/// on main JS thread, and therefore it may have to wait for a previous `lintFile` call to complete.
/// Use an `mpsc::channel` to wait for the result from JS side, and block current thread until `lintFile`
/// completes execution.
// ...
if status == Status::Ok {
    match rx.recv() {
```

The displayed `using 16 threads` describes Oxlint's Rust pool.
It does not make this synchronous project index build 16-way parallel.
The run also logged 8 later `spawn ENOMEM` failures during external package-effect inference.
That allocator interaction is documented separately in
`doc/troubleshooting/oxlint-js-plugin-lazy-child-enomem.md`.
It is a secondary failure signal,
not the cause isolated by the rule-disable probe.

### The summary is Oxlint time, not mise wrapper time

At the audited Oxc tag,
`apps/oxlint/src/lint.rs:103` starts the timer before lint setup,
and `:508-556` executes `lint_files` before passing `now.elapsed()` to the output formatter.
The 62.9-second line therefore includes the synchronous JavaScript callback.
It cannot be explained by mise after Oxlint exits.

## Invalidation model (cache schema 2)

Schema 1 addressed entries by a whole-project content digest,
so editing any file invalidated every entry in the scope
and one changed line forced a full rebuild.

Schema 2 addresses entries by scope,
file path,
and source digest.
Each envelope revalidates against:

- recorded content digest of every non-declaration workspace file in the entry's transitive module-dependency
  closure;
- project membership through a file-list digest;
- declaration file contents for:
    - `.d.ts`
    - `.d.mts`
    - `.d.cts`
- global or module augmentations authored in non-declaration sources;
- resolved compiler options;
- governing lockfile content.

An edit therefore invalidates the edited file and files whose closure contains it.
Declaration,
compiler-option,
lockfile,
and membership changes still invalidate the whole scope.
Analyzer source changes rotate `analyzerDigest` and rebuild everything once.

### Dependency closure edges

Closure edges come from static `import` and `export ... from` declarations,
`import name = require(...)` external references,
literal dynamic `import()` arguments,
and literal `import('...')` type queries.

A runtime-variable dynamic `import()` is deliberately not an edge.
The checker types its result independently of any workspace file's content,
so no other file can change the importing file's summaries through that call.
Value flow through the call stays fail-closed inside effect analysis itself.

Before this refinement,
files such as `file-enforcer/src/cli.ts` (`await import(configPath)`) fell back to whole-scope closures.
Every transitive dependent of such a file was then invalidated by any edit:
39 of 276 file-enforcer-scope entries revalidated against the whole scope.

A non-literal `import('...')` type-query argument does shape checker semantics and still fails the file's closure
closed to the whole scope.
Regression coverage lives in
`package/oxlint-plugin/prefer-readonly-parameter-type/src/effect-summary-invalidation.unit.test.ts`.

## Verification

### Versions and harness

- Oxlint:
  `1.74.0`.
- TypeScript synchronous API:
  `7.0.2`.
- Upstream source:
  Oxc tag `apps_v1.74.0`,
  commit `2d4e8d20644e0e7446f0a381894b45ea339a0625`.
- Target:
  13 files selected by `package/config/oxlint`.
- Semantic project:
  834 TypeScript source files,
  with 337 persistent effect-summary entries for the current scope.

The exact user-boundary harness was:

```bash
mise run //package/config/oxlint:lint:oxlint
```

The isolation harness used a disposable worktree and a temporary config that changed only one rule:

```javascript
import base from './package/config/oxlint/dist/final/node/index.mjs';

export default {
  ...base,
  rules: {
    ...base.rules,
    'prefer-readonly-parameter-type/prefer-readonly-parameter-types': 'off',
  },
};
```

### Working catalog

- Exact task,
  unchanged immediately after cache population:
  1.0 seconds,
  13 files,
  479 rules.
- Custom rule enabled,
  type-aware and type-check disabled,
  stable warm cache:
  894 milliseconds,
  13 files,
  428 rules.
- Custom rule disabled,
  type-aware and type-check enabled:
  396 milliseconds,
  13 files,
  478 rules.
- Custom rule disabled,
  type-aware and type-check disabled:
  234 milliseconds,
  13 files,
  427 rules.

### Cold or invalidated catalog

- Supplied exact task:
  62.9 seconds,
  13 files,
  479 rules.
- Custom rule enabled,
  type-aware and type-check disabled,
  after file-list invalidation:
  64.3 seconds,
  13 files,
  428 rules.
- The first semantic callback occupied 61.883 seconds of the supplied run.
- The cold logger contained 21,616 intrinsic-effect-query records and 8 `spawn ENOMEM` records.

The controlled comparison isolates one rule.
Retaining Oxlint type-aware and type-check analysis while disabling only that rule changed 62.9 seconds to
396 milliseconds.
Conversely,
retaining the custom rule while disabling Oxlint type-aware and type-check analysis still took 64.3 seconds.

### Earlier measured behavior

The 2026-07-20 file-enforcer scope contained 276 indexed files.
The `buildEffectSummaryIndex` phase,
with a fresh bridge per run,
measured:

- cold empty cache:
  30 seconds for 6,614 callables;
- warm unchanged cache:
  0.4 seconds with 276 persistent hits and zero scans;
- warm after a one-line entry-point or leaf edit:
  0.4 to 0.9 seconds,
  with one file rescanned and 275 entries preserved.

Before schema 2,
the same edit cost 13.7 seconds and preserved no entries.

End-to-end `mise run //package/dev-script/file-enforcer:lint:oxlint` measured:

- analyzer-digest rotation:
  24.5 seconds,
  compared with 45.1 seconds before the cache work;
- warm unchanged:
  3.2 seconds,
  with a 2.8-second rule-off floor;
- after a one-line edit:
  5.6 seconds.

## Verified workarounds

### Repeat after semantic inputs stabilize

The current package task fell from 62.9 seconds to 1.0 second on an unchanged repeat.
This is the normal path after a legitimate cache rebuild.

Tradeoff:
the first run after analyzer,
file-list,
declaration,
compiler-option,
or lockfile invalidation still pays the cold analysis cost.
Continuous edits on those surfaces can keep rotating the cache.

### Disable the project rule only for a narrow diagnostic run

The temporary config in the Verification section reduced the type-aware and type-check run to 396 milliseconds.
This is useful only to isolate another lint problem.

Tradeoff:
it removes readonly-parameter,
mutation-contract,
and external-effect enforcement for that run.
It is not an acceptable permanent package configuration.

### Preserve the persistent cache

Keep `node_modules/.cache/prefer-readonly-parameter-type` across ordinary lint invocations.
The cache is content-addressed and validates its dependency surfaces before reuse.

Tradeoff:
stale identities remain until cache maintenance evicts them,
and intentional cache deletion forces the next run cold.

## What does not work

- Removing `--type-aware` does not address this incident.
  The custom rule uses its own TypeScript API and still took 64.3 seconds without Oxlint type-aware or type-check
  analysis.
- Passing
  `--allow=prefer-readonly-parameter-type/prefer-readonly-parameter-types`
  did not disable the configured JavaScript rule in this setup.
  The measured command still ran 479 rules and took 62.2 seconds.
  An explicit config override to `off` was required for the isolation probe.
- `--debug=timings` does not attribute JavaScript-plugin rule time in Oxlint 1.74.0.
  The 64.3-second run's timing list showed only millisecond-scale native rules.
  Upstream issue
  [oxc-project/oxc#19745](https://github.com/oxc-project/oxc/issues/19745)
  already tracks JavaScript-plugin timing support.
- More Oxlint threads do not parallelize the callback.
  Upstream routes JavaScript rule execution through the main JavaScript thread.
- A cache directory containing files is not proof of a hit.
  Every envelope must match analyzer,
  project,
  declaration,
  compiler,
  lockfile,
  and dependency identities.

## When lint time regresses

Check these surfaces in order:

1.  Analyzer digest rotation.
    Any semantic-plugin source change rebuilds every scope once.
2.  Whole-scope surface churn.
    Lockfile,
    compiler-option,
    declaration,
    and project-membership changes legitimately invalidate whole scopes.
3.  Whole-scope closure fallback.
    Files whose module references cannot be statically resolved snapshot the whole indexed scope.
    Their transitive dependents inherit that fallback.
    Probe `directModuleDependencies` for `MODULE_DEPENDENCIES_UNRESOLVED`.
4.  Repeated manifest discovery.
    Count `could not read workspace package identity` records and cache ancestor-directory results when the count is
    high.
5.  Cold rebuild cost.
    Synchronous IPC to the TypeScript 7 Go child dominated the earlier profile.
    Incremental caching avoids repeated rebuilds,
    but does not reduce a legitimate cold rebuild.

Whole-repo serial warm lint above the 60-second goal remains tracked in issue #374.
Package fanout with per-child worker pinning remains the repository-wide path.

## Upstream filing decision

No `.out-of-scope/` entry matches Oxlint,
JavaScript plugins,
or this project-owned semantic rule.

The upstream duplicate search covered open and closed issues and pull requests for
`timings`,
`JS plugin`,
`custom rule timings`,
and `RuleTimingSource`.
It found open issue
[oxc-project/oxc#19745](https://github.com/oxc-project/oxc/issues/19745),
which already states that merged JavaScript visitors prevent per-rule attribution and requests a separate timing
path.
The issue has no comments.

The six filing constraints for the 62.9-second incident are:

### Is it really upstream's fault?

No.
Oxlint waited correctly for a project-owned synchronous rule.
The expensive whole-project algorithm,
cache identity,
repeated manifest probes,
and file logging belong to this repository.

### Can upstream fix it?

Oxlint can improve JavaScript-plugin timing visibility,
but it cannot make this custom effect analysis cheap without changing the rule's semantics or implementation.

### Are they supporting this use case?

Oxlint supports JavaScript plugins,
currently marked alpha.
Per-rule JavaScript timing is not present in 1.74.0 and is explicitly tracked as future work in issue #19745.

### Would the repository welcome a contribution?

Yes with review and disclosure.
Oxc `CONTRIBUTING.md:12-21` permits AI assistance,
requires disclosure,
and requires contributors to understand and test submissions.

### Will they likely fix it?

The timing capability is accepted as an open issue,
but there is no schedule or maintainer commitment in its empty thread.
The local cold-cache cost is not an upstream fix target.

### Have we prototyped a minimal upstream fix compatible with their architecture?

No.
Constraint 1 fails for the incident,
so the auto-prototype gate does not trigger.
The local consumer boundary already provides the cache and owns the remaining optimization targets.

Decision:
do not file a new upstream issue.
Issue #19745 already captures the only upstream capability gap encountered during diagnosis.
The project-specific reproduction confirms its stated consequence but adds no new architectural fact,
so there is no additive comment to post.

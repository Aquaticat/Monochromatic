# Prefer-readonly incremental persistent cache

The `prefer-readonly-parameter-type/prefer-readonly-parameter-types` rule
persists per-file direct effect summaries under
`node_modules/.cache/prefer-readonly-parameter-type`.
This document records the invalidation model,
its measured behavior,
and the failure modes worth checking when lint time regresses.

## Invalidation model (cache schema 2)

Schema 1 addressed entries by a whole-project content digest,
so editing any file invalidated every entry in the scope
and one changed line forced a full rebuild.

Schema 2 addresses entries by scope,
file path,
and source digest,
and each envelope revalidates against:

- the recorded content digest of every non-declaration workspace file in the
  entry's transitive module-dependency closure;
- whole-scope surfaces:
  project membership (file-list digest),
  declaration files (`.d.ts`/`.d.mts`/`.d.cts` content),
  global or module augmentations authored in non-declaration sources,
  resolved compiler options,
  and governing lockfile content.

An edit therefore invalidates exactly the edited file and the files whose
closure contains it,
while declaration,
compiler-option,
lockfile,
and membership changes still invalidate the whole scope.
Analyzer (plugin source) changes rotate `analyzerDigest` and rebuild
everything once.

## Dependency closure edges

Closure edges come from static `import`/`export ... from` declarations,
`import name = require(...)` external references,
literal dynamic `import()` arguments,
and literal `import('...')` type queries.

A runtime-variable dynamic `import()` is deliberately not an edge:
the checker types its result independently of any workspace file's content,
so no other file can change the importing file's summaries through that call,
and value flow through it stays fail-closed inside effect analysis itself.
Before this refinement,
files such as `file-enforcer/src/cli.ts` (`await import(configPath)`) fell
back to whole-scope closures,
and every transitive dependent of such a file was invalidated by any edit:
39 of 276 file-enforcer-scope entries revalidated against the whole scope.

A non-literal `import('...')` type-query argument does shape checker
semantics and still fails the file's closure closed to the whole scope.

Regression coverage:
`package/oxlint-plugin/prefer-readonly-parameter-type/src/effect-summary-invalidation.unit.test.ts`.

## Measured behavior (2026-07-20, file-enforcer scope, 276 indexed files)

Harness (`buildEffectSummaryIndex` phase, fresh bridge per run):

- cold, empty cache: 30s (6,614 callables scanned, sync-IPC bound);
- warm, unchanged: 0.4s (276 persistent hits, zero scans);
- warm after a one-line edit (entry point or leaf): 0.4s to 0.9s wall,
  one file rescanned,
  275 entries preserved.
  Before schema 2 the same edit cost 13.7s and preserved nothing.

End-to-end `mise run //package/dev-script/file-enforcer:lint:oxlint`:

- analyzer-digest rotation (full rebuild): 24.5s
  (45.1s before this work);
- warm, unchanged: 3.2s (rule-off floor 2.8s);
- after a one-line edit: 5.6s
  (previously any edit behaved like the full-rebuild case).

## When lint time regresses, check in this order

1. Analyzer digest rotation:
   any plugin source change rebuilds every scope once;
   the next run is warm again.
2. Whole-scope surface churn:
   lockfile updates,
   compiler-option changes,
   and declaration-file edits legitimately invalidate whole scopes.
3. Whole-scope closure fallback:
   files whose module references cannot be statically resolved snapshot the
   whole indexed scope and are invalidated by every edit;
   their transitive dependents inherit the fallback.
   Probe with `directModuleDependencies` over the indexed scope and look
   for `MODULE_DEPENDENCIES_UNRESOLVED`.
4. Cold rebuild cost itself is dominated by synchronous IPC to the
   TypeScript 7 Go child (about 60 percent of profiled time);
   incremental caching does not reduce it,
   only avoids repeating it.

Whole-repo serial warm lint remaining above the 60-second goal is tracked in
issue #374 and is not explained by this cache;
per-package fanout with per-child worker pinning stays the fast path.

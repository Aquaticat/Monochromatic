# File-enforcer staleness manifest is never recorded for the root config

## Symptom

The root `file-enforcer.config.ts` regenerates every destination on every run.
Nothing is ever skipped as unchanged, and the persisted staleness manifest at
`node_modules/.cache/file-enforcer/staleness-manifest.json` is never rewritten.

Measured on 2026-09-16:

- `/var/home/user/Monochromatic/node_modules/.cache/file-enforcer/staleness-manifest.json`
  had mtime `Jul 15 01:30`, two months stale against a config last changed `Sep 14`.
- `package/dev-script/file-enforcer/node_modules/.cache/file-enforcer/staleness-manifest.json`
  had mtime `Sep 9 15:11`.
- All 117 entries in the root manifest point at `/tmp/file-enforcer-integ-*`,
  the temporary directories of the package's own container and integration tests.
  None corresponds to a production destination.

Three runs of the unmodified root config in a throwaway worktree took
0.929s, 0.924s, and 0.926s, and all three log lines reporting writes were
identical: `overwriteEach: 10 files` twice, then the same
`generatePnprConfig` line. A content edit to `.browserslistrc` produced the
same wall time (0.920s) and still wrote `.browserslistrc.resolved.local.json`.

## Source audit

The staleness mechanism has three layers, and two of them are unreachable for
this config.

### No lazy builder exists in the root config

The staleness gate runs only inside the lazy builders. `writeLazyIfChanged`
and `writeLazyEach` call `freshStalenessEntryExists` and return early when the
entry is fresh (`package/dev-script/file-enforcer/src/io/write-lazy.ts`).
Eager writes go straight to `writeIfChanged` with no read of prior entries
(`package/dev-script/file-enforcer/src/io/write.ts`).

The root config uses no lazy builders. Every `content` value is computed
inline before the call:

```bash
rg -n "content: async|content: function" file-enforcer.config.ts   # 0 matches
rg -n "content: await" file-enforcer.config.ts                     # 11 matches
```

So even a correctly populated manifest could not skip any root-config work.
The manifest is write-only for this config.

### An absent watched path aborts every recording

Recording takes the global read set and stamps every path in it;
`readFileStamps` returns the `ABSENT_FILE_STAMPS` sentinel if *any* path is
absent (`src/io/staleness-stamps.ts`), and `rememberFreshStalenessEntry`
early-returns on that sentinel (`src/io/staleness.ts`).

`assertForbiddenRootContextAbsent()` calls `addWatchedPaths(['./CONTEXT.md'])`
(`file-enforcer.config.ts` line 579), and `addWatchedPaths` delegates to
`trackRead` (`src/tracker.ts`), so `./CONTEXT.md` joins the global read set
that `rememberEagerWrite` copies into `trackedReads`
(`src/io/write-staleness.ts` line 64).

`CONTEXT.md` is absent by design, and `AGENTS.md` rule DPL forbids it. Every
recording therefore hits the absent sentinel and returns without writing an
entry.

### Reproduction

Both layers were isolated in a throwaway worktree, not the live tree.

Absent watched path, then an eager overwrite:

```ts
import { cat, overwrite, addWatchedPaths } from '.../src/index.ts';
addWatchedPaths(['./CONTEXT.md']);
await overwrite({ dest: './p5.txt', content: await cat(['./.browserslistrc'])});
```

Result: `[]` entries recorded.

Same call without `addWatchedPaths`: one entry,
`single:/var/home/user/temp/agent/fe-bench/p6.txt`.

A lazy builder records even in isolation, confirming the gate itself works and
that eager writes are the un-gated path:

```ts
await overwrite({ dest: './p3.txt', content: async () => await cat(['./.browserslistrc'])});
await overwrite({ dest: './p4.txt', content: await cat(['./.browserslistrc'])});
```

Result: `after lazy: ['single:.../p3.txt']` then
`after eager: ['single:.../p3.txt', 'single:.../p4.txt']`.

### Test pollution shares the root cause

The 117 `/tmp/file-enforcer-integ-*` entries in the root manifest come from the
same two structural properties: a global mutable read/destination tracker
shared across configs, and a default manifest path resolved by walking up to
the nearest `node_modules`. Test runs that pass no `manifestPath` write into
whatever manifest their temporary directory resolves to, and a `node_modules`
symlink pointed at the live tree redirects them into the real manifest.

## Consequences

`package/dev-script/file-enforcer/TODO.md` claims "the current in-memory cache
makes full re-runs fast (~2ms warm)". That figure is unreachable for this
config, which has no lazy builder to consult a manifest. Treat it as a
measurement of a lazy-builder fixture, not of the root config.

`doc/audit/file-enforcer.md` scores file-enforcer as passing axis A5
(persisted manifest that skips unchanged work across separate runs). For the
root config, A5 currently earns nothing: the manifest is written only by tests
and read only by builders the config never uses.

## Fix directions

- Record staleness for eager writes behind an explicit opt-in, or drop the
  implicit global read set for them so an unrelated absent watched path cannot
  abort recording.
- Distinguish "watched path may be absent" from "read path must be present" in
  the tracker, since `assertForbiddenRootContextAbsent` needs the former.
- Stop resolving the default manifest path by directory walk when the config is
  not under a project-local `node_modules`, and keep test fixtures on explicit
  `manifestPath` values so they cannot reach a real manifest through a symlink.
- Convert root-config rules whose sources are stable to lazy builders if the
  skip is wanted, understanding that the whole config still re-executes.

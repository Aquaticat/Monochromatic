<!--
This document uses HTML <table> elements for numeric grids, matching the
companion benchmark report, overriding the repo's usual no-markdown-tables
convention. Deliberate, documented.
-->

# Implementation plan: replace the zstd CLI with node:zlib

This is an implementation plan for review. It is not yet applied. The evidence and benchmark behind
the engine, level, and threading choices live in the companion report
`docs/decisions/zstd-cli-to-node-zlib.md`; this document is the concrete change set.

## For the reviewer: what this is and what to check

The workspace shells out to the external `zstd` command-line tool in two places and declares it as a
mise-managed tool. Node 22.15+ and Bun 1.3+ ship Zstandard directly in `node:zlib`, so the external
tool and the subprocess plumbing can be removed in favor of the platform built-in. The workspace is
also migrating off Bun, so anything that must run at build time targets **Node**.

The change is three independent pieces:

1. Figma decompression: swap a CLI/optional-native subprocess for `node:zlib`'s `zstdDecompressSync`.
   Trivial, correctness-only, already validated.
2. ssg static-site compression: replace the `zstd ... -r dist` build task with a Node script that
   compresses each file with `node:zlib` across `worker_threads`. This is the substantive change and
   the one the benchmark exists to justify.
3. Cleanup: remove the `zstd` mise tool and the now-unused `nano-spawn` dependency from the Figma
   package.

The most useful things a reviewer can challenge: the `worker_threads` design and its worker-count
heuristic; whether the added build latency (~14 ms to ~170 ms on the current `dist/`) is worth the
better, reproducible compression; the keep-if-smaller and extension-skip exclusion policy; and the
decisions recorded at the end (now resolved by review).

## Background facts established by the benchmark

These are load-bearing and are proven in the companion report; restated here so this plan stands on
its own.

- `node:zlib` zstd output is **byte-identical to the system zstd CLI v1.5.7** at every level 1 to 19,
  and identical between Bun and Node. Every produced frame round-trips to the exact original bytes.
- The build runs under **Node**. Node's **async** `zstdCompress` (via `Promise.all`) is pathological
  here (~1 s at level 19, up to 7.8 s at level 22). The fast Node path is **`worker_threads` running
  synchronous `zstdCompressSync`**, which at matched level 19 beats the zstd CLI itself (168 ms vs
  217 ms on the real `dist/`) and is ~3x faster than Node-sequential on 2,000 files.
- Worker-count optimum is a **plateau of roughly 4 to 10 workers** (around the 8 physical cores),
  degrading above ~12. `os.availableParallelism()` returns 16 on the benchmark machine, which is
  already past optimal, so the worker count must be capped below the logical count.
- The current `zstd --adapt` is fast only because `--adapt` silently picks a weak level (level-3
  equivalent) and is **nondeterministic** across machines (its output size depends on observed I/O
  speed). A fixed level is reproducible.
- Incompressible input always grows under zstd (frame overhead), so "keep the `.zst` only if it is
  strictly smaller than the source" is both correct and necessary for the `wireSize` consumer.

## Change 1: Figma decompression (trivial, validated)

File: `packages/figma-parsers/kiwi/src/index.ts`, function `decompressZstd` (currently ~lines 1180
to 1271).

Replace the whole body. Today it tries an optional native module (`@bokuwatch/zstd`, never declared
as a dependency) and otherwise spawns `zstd -d` through `nano-spawn` with temp-file shuttling. It
becomes:

```ts
/**
 * Decompress a single zstd frame with Node's built-in node:zlib.
 *
 * Target runtimes ship native zstd in node:zlib (Node >= 22.15, Bun >= 1.3),
 * so no optional native module or zstd CLI subprocess is needed. Stays async
 * to preserve the call contract, mirroring the inflateRawSync schema decode
 * above; the decode itself is synchronous.
 *
 * @param data - zstd-compressed bytes spanning exactly one frame
 *
 * @returns decompressed document bytes
 *
 * @example
 * ```ts
 * const doc = await decompressZstd(frameBytes,);
 * ```
 */
async function decompressZstd(data: Uint8Array,): Promise<Uint8Array> {
  const { zstdDecompressSync, } = await import('node:zlib');
  return new Uint8Array(
    zstdDecompressSync(Buffer.from(data,),),
  );
}
```

It stays `async` to preserve the public call contract (the function is exported and awaited at its
one internal call site). The synchronous decode matches the `inflateRawSync` schema decode already in
the same file. The dynamic `import('node:zlib')` matches the file's existing ESM-friendly access
pattern (it already dynamically imports `node:zlib` for `inflateRawSync` / `createInflateRaw`).

Then remove `"nano-spawn": "catalog:"` from `packages/figma-parsers/kiwi/package.json` (the removed
fallback was its only use in that package; the dependency block becomes empty and is deleted).

Validation already performed during benchmarking: a real `.fig` frame produced by the system CLI
decodes correctly under `zstdDecompressSync`, and every frame produced by `node:zlib` round-trips to
the exact original. The package's existing integration test
(`packages/figma-parsers/kiwi/src/index.unit.test.ts`) decodes real `.fig` / `.deck` / `.jam` files
end-to-end through `decompressZstd`.

## Change 2: ssg static-site compression

### Task wiring

File: `packages/webapp-content/ssg-test/mise.toml`.

```toml
# before
[tasks."build:compress"]
description = "Compress dist/ with zstd"
run = "zstd -z -f --no-check -T0 --exclude-compressed --no-content-size -r --adapt dist"

# after
[tasks."build:compress"]
description = "Compress dist/ with zstd via node:zlib (worker_threads)"
run = "node src/build/compress.ts"
```

Run under `node` (not `bun`), since Bun is being removed. Node 26 runs the `.ts` file directly via
type stripping; the script uses only strippable type annotations (no enums, namespaces, or parameter
properties). The self-referential `new Worker(new URL(import.meta.url))` pattern was verified under
Node 26.3.0 during benchmarking. A separate check confirmed that a `.ts` file in this package run by
`node` both type-strips and successfully imports the workspace tagged logger (the package is
`type: module`, and the logger's `exports` map resolves to its built `dist/final/node/index.mjs`, so
the no-type-stripping-under-`node_modules` rule does not apply). The one prerequisite is that
workspace dependencies are built before the task runs, which is a property of the broader Bun-to-Node
build-script migration, not specific to this task.

### The script

New file `packages/webapp-content/ssg-test/src/build/compress.ts`, beside the existing
`postprocess.ts` and `favicon.ts`. Single self-dispatching file (main thread plus worker branch).
Proposed shape, to be adapted to the package's exact logger and module conventions:

The design below incorporates an external review of an earlier draft of this plan (GPT Pro); its
points are folded in throughout and called out where they changed a decision.

```ts
import { Worker, isMainThread, workerData, parentPort, } from 'node:worker_threads';
import { readdirSync, readFileSync, writeFileSync, statSync, rmSync, } from 'node:fs';
import { availableParallelism, } from 'node:os';
import { join, } from 'node:path';
import zlib from 'node:zlib';

/**
 * zstd compression level for precompressed static assets. Level 19 is the best
 * practical ratio; see docs/decisions/zstd-cli-to-node-zlib.md for the curve.
 */
const COMPRESSION_LEVEL = 19;

/**
 * Exact zstd parameters. Checksum and content-size flags are set explicitly to
 * 0 to match the old CLI flags (--no-check, --no-content-size) rather than rely
 * on library defaults.
 */
const ZSTD_OPTIONS = {
  params: {
    [zlib.constants.ZSTD_c_compressionLevel]: COMPRESSION_LEVEL,
    [zlib.constants.ZSTD_c_contentSizeFlag]: 0,
    [zlib.constants.ZSTD_c_checksumFlag]: 0,
  },
} as const;

/**
 * Extensions whose bytes are already compressed; skipped without being read.
 * Deliberately conservative: only formats that are genuinely pre-compressed.
 * ttf/otf/ico were removed on review (their tables are uncompressed and zstd
 * helps); keep-if-smaller covers any borderline case left in.
 */
const INCOMPRESSIBLE_EXTENSIONS: ReadonlySet<string> = new Set([
  'zst', 'gz', 'br', 'avif', 'webp', 'png', 'jpg', 'jpeg', 'gif', 'jxl',
  'woff', 'woff2', 'mp4', 'webm', 'mov', 'mp3', 'ogg', 'flac', 'aac', 'm4a',
]);
```

Design points, with the review's refinements folded in:

- **Engine:** `node:worker_threads`, each worker calling synchronous `zstdCompressSync`. Node's async
  `zstdCompress` is rejected (pathological). The validated reference engine is `compress-node-wt.ts`
  in the benchmark report's reproduction section.
- **Recursive snapshot, `.zst` excluded (review).** The main thread walks `dist/` **recursively**
  (`readdirSync(dist, { recursive: true })`), and snapshots the full candidate list **before**
  spawning any worker (so workers never observe `.zst` files being created mid-run). Existing `.zst`
  files are **excluded from the candidate set** (never recompress a `.zst` into a `.zst.zst`).
  **Symlinks are skipped** (`statSync` then `isFile()`, not following directory symlinks) to avoid
  escaping `dist/` or double-processing.
- **Worker count (resolved + review-hardened).** Order of precedence: (1) the `ZSTD_WORKERS` env var
  if set (mandatory escape hatch); (2) otherwise a heuristic **capped by `availableParallelism()`**.
  The cap matters: `os.availableParallelism()` is the value Node documents as the parallelism a
  program should use and it respects cgroup/CPU quotas, whereas `/proc/cpuinfo` reports host topology
  and would **oversubscribe a CPU-limited container or CI runner**. So:
  `workers = min(physicalCores ?? floor(availableParallelism() / 2), availableParallelism(), fileCount)`,
  where `physicalCores` is the count of distinct `(physical id, core id)` pairs parsed from
  `/proc/cpuinfo` on Linux (a plain file read) or `undefined` elsewhere. **Zero candidate files is a
  defined path: spawn no workers, log `0 compressed, N skipped`, exit cleanly.**
- **Level:** `ZSTD_OPTIONS` above; level 19, content-size off, checksum off (all explicit).
- **Exclusion (extension skip):** files whose extension is in `INCOMPRESSIBLE_EXTENSIONS` are skipped
  without being read. The list is intentionally conservative (review): only genuinely pre-compressed
  formats; everything else falls through to keep-if-smaller.
- **Exclusion (keep if smaller) and stale-output safety (review).** For **every** candidate (whether
  skipped by extension or compressed), the worker first removes any pre-existing `<file>.zst`. Then,
  for a compressed file, it writes a fresh `<file>.zst` only if it is strictly smaller than the
  source. This makes the task **idempotent and self-cleaning even when run standalone** (not just
  after `build:clean`): no stale companion can survive when its source no longer compresses smaller or
  becomes a skipped extension. This is stricter than the CLI's extension-only `--exclude-compressed`
  and is the correct behavior for `wireSize` and any precompressed server. The produced `.zst` set
  therefore differs from the CLI's by design.
- **Orphan `.zst` (source deleted).** Per-source removal does not catch a `.zst` whose source file no
  longer exists (it is never visited). A full build runs `build:clean` (`rm -rf dist`) first, so
  orphans cannot survive a full build; `postprocess.ts` already prunes stale fingerprinted `.zst`.
  Standalone reruns rely on those. If stronger guarantees are wanted, the script can also enumerate
  existing `.zst` and drop any with no surviving source; flagged, not required.
- **Output location:** `<file>.zst` next to the source inside `dist/`, identical to the CLI's in-place
  behavior.

### Worker lifecycle contract (review)

Each worker is wrapped in a promise that **resolves only after the expected completion message** and
**rejects on either an `error` event or a non-zero `exit` code** (Node's own worker example handles
both; an `error` alone is not a sufficient contract because a worker can exit non-zero without
emitting `error`). Workers post a `{ written, skipped, savedBytes }` tally on success; the main
thread aggregates and logs one summary line. A rejection rethrows on the main thread (no
`process.exit`, no silent catch).

### Conventions to honor (from AGENTS.md)

- Tagged logger from `@monochromatic-dev/module-logger` (already a dependency of the package); no raw
  `console.log` in the main-thread path. Workers stay silent and report tallies back to the main
  thread, which logs the summary. Verified empirically that `node src/build/compress.ts` type-strips
  and imports the workspace logger (which resolves through its `exports` map to the built
  `dist/final/node/index.mjs`, not TS source, so Node's no-type-stripping-under-`node_modules` rule
  does not bite), provided workspace deps are built first.
- Comprehensive TSDoc on every declaration; `//region` markers for the main and worker branches.
- Throw on errors, do not `process.exit`; worker failures reject per the lifecycle contract above and
  rethrow on the main thread. No silent catches.
- Stay under the max-lines budget; if the single file would exceed it, split the worker branch into a
  sibling `compress.worker.ts` and load it by URL (this needs a quick check that Node strips types in
  a separately-loaded worker module; the single-file self-referential form is already verified).

## Change 3: tool and dependency cleanup

- Remove `"github:facebook/zstd" = "latest"` (and its `# Compression` comment if it then has no other
  entries) from `mise.toml` and `mise.no-env.toml`. No other workspace code invokes the `zstd`
  binary; the only remaining textual reference is a generic tool-name entry in the
  bash-output-filter allowlist, which is harmless and stays.
- Remove `nano-spawn` from `packages/figma-parsers/kiwi/package.json` (covered in Change 1).
- `nano-spawn` stays in the workspace catalog and other packages; it is widely used elsewhere.

## Verification plan

Cross the integration boundary, not just "it compiled."

1. **Figma decode (real frames).** Run the package integration test, which decodes real
   `.fig` / `.deck` / `.jam` files through `decompressZstd`:
   `bun packages/figma-parsers/kiwi/src/index.unit.test.ts` (no `test` task exists in that package;
   run the file directly per the repo's test convention). Confirm the `.fig` / `.deck` / `.jam`
   integration cases pass.
2. **ssg compress end-to-end, through the real mise task (review).** Run the actual task, not the
   benchmark script, so `.ts` type-stripping, ESM resolution, and workspace dependency resolution are
   all exercised under the package's real module graph:
   - `mise run //packages/webapp-content/ssg-test:build:site` then
     `mise run //packages/webapp-content/ssg-test:build:compress`.
   - Confirm `.zst` companions appear next to compressible assets and not next to skipped extensions,
     and that no `.zst.zst` is produced (existing `.zst` excluded from candidates).
   - Confirm no `.zst` is larger than its source (keep-if-smaller guard).
3. **Verify every `.zst`, not a sample (review).** Recursively find all `.zst` companions, decompress
   each with `zstdDecompressSync`, and byte-compare to its source; require zero mismatches across the
   whole tree.
4. **Stale-output test (review).** Plant a bogus, deliberately larger `<file>.zst` next to a known
   source (and a `.zst` next to a now-skipped-extension file), rerun `build:compress` standalone
   (without `build:clean`), and confirm each is either replaced with a valid strictly-smaller file or
   removed. This exercises the idempotent self-cleaning contract.
5. **page-weight still resolves wire sizes.** Run
   `mise run //packages/webapp-content/ssg-test:audit:weight` and confirm it reports `.zst` sizes
   where present and raw sizes otherwise (it reads the `.zst` companions via `wireSize`).
6. **Type-check and lint** the touched packages:
   `mise run //packages/figma-parsers/kiwi:lint:types`,
   `mise run //packages/webapp-content/ssg-test:lint:types`, and the corresponding `lint` tasks. Zero
   errors and zero warnings.
7. **Tool removal sanity.** After removing the mise tool, confirm a fresh `mise install` / task run
   does not error for a missing `zstd`, and that nothing in the build path still calls the binary.

## Risks and rollback

- **Added build latency.** `build:compress` goes from ~14 ms (current weak `--adapt`) to ~170 ms
  (worker_threads, level 19) on today's `dist/`. The `dev` task reruns the full `build` on every
  source change, so this is felt in the dev loop, though it stays well under 200 ms. Mitigations if
  it matters: level 15 (~140 ms, within 0.1 ratio points), or restructure so compress runs only on
  final builds. Not proposed now.
- **worker_threads under Node type stripping.** The self-referential single-file pattern is verified
  under Node 26.3.0. If the file is later split into a separate worker module, re-verify type
  stripping loads the worker correctly.
- **Experimental zstd APIs (review).** Node's docs still mark the `node:zlib` zstd APIs and Zstd
  options as experimental. With a pinned Node runtime this is acceptable, but it is recorded here
  because removing the CLI tool removes the fallback: if a future Node changes the zstd API surface,
  both the figma decode and the ssg compress depend on it with no CLI escape hatch. The `decompress`
  direction is the higher-stakes one (it parses real Figma files); its round-trip is already
  validated against CLI-produced frames.
- **Build-script runtime depends on the Bun-to-Node migration (review).** `node src/build/compress.ts`
  requires workspace dependencies (the tagged logger) to be built, and assumes the package stays
  `type: module`. This is verified to work today, but it couples the task to the broader migration's
  build-ordering story; verify under the real module graph (see verification step 2), not just the
  dependency-free benchmark file.
- **Rollback** is a clean revert of the three changes; the `.zst` output format is unchanged (still
  standard zstd frames), so consumers (`wireSize`, any precompressed server) are unaffected by a
  revert.

## Resolved decisions (from review)

The four open questions have been answered by review; recorded here so the plan is final.

1. **worker_threads versus sequential: use worker_threads.** The added complexity is acceptable.
   (worker_threads ~168 ms vs sequential ~243 ms on the current `dist/`, ~3x advantage at 2,000
   files.)
2. **Worker count: detect physical cores when simple, else `floor(availableParallelism() / 2)`,
   hardened on review to cap by `availableParallelism()`.** `min(physicalCores ?? floor(avail/2),
   avail, fileCount)`, where `physicalCores` comes from a Linux `/proc/cpuinfo` parse (else
   `undefined`). The `availableParallelism()` cap is mandatory because `/proc/cpuinfo` reports host
   topology and would oversubscribe a CPU-limited container or CI runner, whereas
   `availableParallelism()` respects cgroup quotas. Zero candidate files spawns no workers. A
   `ZSTD_WORKERS` env override is provided as the escape hatch. See the Change 2 worker-count bullet.
3. **Level: 19.** Best ratio; the dev-loop latency (~170 ms) is acceptable.
4. **File naming: `src/build/compress.ts` (package pattern) is accepted**, consistent with the
   sibling `postprocess.ts` / `favicon.ts`, in deliberate preference to the global `SCR`
   `mise.<action>.ts` naming.

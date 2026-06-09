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
open questions listed at the end.

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
properties). The self-referential `new Worker(new URL(import.meta.url))` pattern was verified to run
under Node 26.3.0 during benchmarking.

### The script

New file `packages/webapp-content/ssg-test/src/build/compress.ts`, beside the existing
`postprocess.ts` and `favicon.ts`. Single self-dispatching file (main thread plus worker branch).
Proposed shape, to be adapted to the package's exact logger and module conventions:

```ts
import { Worker, isMainThread, workerData, parentPort, } from 'node:worker_threads';
import { readdirSync, readFileSync, writeFileSync, statSync, } from 'node:fs';
import { availableParallelism, } from 'node:os';
import { join, } from 'node:path';
import zlib from 'node:zlib';

/**
 * zstd compression level for precompressed static assets. Level 19 is the best
 * practical ratio; see docs/decisions/zstd-cli-to-node-zlib.md for the curve.
 */
const COMPRESSION_LEVEL = 19;

/**
 * File extensions whose contents are already compressed; skipped without being
 * read, since recompressing them wastes CPU and never shrinks them.
 */
const INCOMPRESSIBLE_EXTENSIONS: ReadonlySet<string> = new Set([
  'zst', 'gz', 'br', 'avif', 'webp', 'png', 'jpg', 'jpeg', 'gif', 'jxl', 'ico',
  'woff', 'woff2', 'ttf', 'otf', 'mp4', 'webm', 'mov', 'mp3', 'ogg', 'flac',
]);

// ... main-thread branch: enumerate dist, filter extensions, shard, spawn
//     workers, aggregate results, log a summary via the package tagged logger.
// ... worker branch: compress its shard with zstdCompressSync, write
//     <file>.zst only when strictly smaller, postMessage a {written, saved} tally.
```

Design points, each tied to the benchmark:

- **Engine:** `node:worker_threads`, each worker calling synchronous `zstdCompressSync`. Node's async
  `zstdCompress` is rejected (pathological). The validated reference engine is `compress-node-wt.ts`
  in the benchmark report's reproduction section.
- **Worker count:** capped below the logical CPU count. Proposed default
  `Math.max(1, Math.min(Math.floor(availableParallelism() / 2), fileCount,),)`, which yields 8 on the
  benchmark machine (2-way SMT, 8 physical cores) and lands inside the measured 4-to-10 plateau,
  while never oversubscribing. See open questions for alternatives.
- **Level:** `COMPRESSION_LEVEL = 19`, with `ZSTD_c_contentSizeFlag = 0` (matching the current task's
  `--no-content-size`; checksums are already off by default, matching `--no-check`).
- **Exclusion (extension skip):** files whose extension is in `INCOMPRESSIBLE_EXTENSIONS` are skipped
  without being read. This is the spirit of the CLI's `--exclude-compressed`.
- **Exclusion (keep if smaller):** for the files that are compressed, write `<file>.zst` only when it
  is strictly smaller than the source. Stricter than `--exclude-compressed` (which is extension-only
  and can leave a `.zst` larger than its source). The set of produced `.zst` files therefore differs
  from the CLI's by design; this is correct for `wireSize` and any precompressed server.
- **Output location:** `<file>.zst` written next to the source inside `dist/`, identical to the CLI's
  in-place behavior. `build:clean` (`rm -rf dist`) runs before every build, so there are no stale
  `.zst` to reap.

### Conventions to honor (from AGENTS.md)

- Tagged logger from `@monochromatic-dev/module-logger` (already a dependency of the package); no raw
  `console.log` in the main-thread path. Workers stay silent and report tallies back to the main
  thread, which logs one summary line (files compressed, files skipped, bytes saved).
- Comprehensive TSDoc on every declaration; `//region` markers for the main and worker branches.
- Throw on errors, do not `process.exit`; a worker error propagates via the worker `error` event and
  is rethrown on the main thread. No silent catches.
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
2. **ssg compress end-to-end.** Build the site, run the new task, and confirm correctness at the user
   boundary:
   - `mise run //packages/webapp-content/ssg-test:build:site` then
     `mise run //packages/webapp-content/ssg-test:build:compress`.
   - Confirm `.zst` companions appear next to compressible assets and not next to skipped
     extensions.
   - Decode a sample `.zst` and diff against its source (round-trip): the decompressed bytes must
     equal the original. Use `node -e` with `zstdDecompressSync`, or the system `zstd -d` if still
     installed during the transition.
   - Confirm no `.zst` is larger than its source (the keep-if-smaller guard).
3. **page-weight still resolves wire sizes.** Run
   `mise run //packages/webapp-content/ssg-test:audit:weight` and confirm it reports `.zst` sizes
   where present and raw sizes otherwise (it reads the `.zst` companions via `wireSize`).
4. **Type-check and lint** the touched packages:
   `mise run //packages/figma-parsers/kiwi:lint:types`,
   `mise run //packages/webapp-content/ssg-test:lint:types`, and the corresponding `lint` tasks. Zero
   errors and zero warnings.
5. **Tool removal sanity.** After removing the mise tool, confirm a fresh `mise install` / task run
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
- **Rollback** is a clean revert of the three changes; the `.zst` output format is unchanged (still
  standard zstd frames), so consumers (`wireSize`, any precompressed server) are unaffected by a
  revert.

## Open questions for the reviewer

1. **worker_threads versus sequential.** For the current 138-file `dist/`, Node-sequential
   `zstdCompressSync` (243 ms, no worker machinery) is simpler than worker_threads (168 ms). The
   worker approach wins more as the blog grows (3x at 2,000 files). Is the complexity worth it now,
   or start sequential and switch when `dist/` grows?
2. **Worker-count heuristic.** `floor(availableParallelism() / 2)` assumes 2-way SMT. On a non-SMT
   host it underuses cores (safe, since the plateau extends down to 4 and oversubscription is the
   real penalty). Alternatives: an explicit physical-core detection, or an env-var override
   (`ZSTD_WORKERS`). Preference?
3. **Level 19 versus 15.** Level 19 is best ratio; level 15 is the knee (within 0.1 ratio points,
   ~20% faster). Default 19, or 15 to keep the dev loop snappier?
4. **File naming.** The repo's global `SCR` rule prefers `mise.<action>.ts`, but this package's
   established pattern is `src/build/<name>.ts` (`postprocess.ts`, `favicon.ts`). The plan follows the
   package pattern for consistency with siblings. Acceptable, or prefer the global rule?

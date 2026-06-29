# pnpm modules cache benchmark handover

## Status

The user is questioning whether pnpm's project-local virtual-store orphan retention is worth its
machinery and bug surface.
They asked to continue investigating and benchmarking pnpm,
with benchmarks on filesystem-backed storage.
They explicitly noted `/tmp` is RAM-backed and `~/temp` is filesystem-backed.

This handover file is intentionally persisted in the main worktree at the user's request.
Keep updating it as the benchmark and interpretation change.

## Current benchmark setup

Benchmark root:

```txt
/home/user/temp/pnpm-cache-bench-20260629-120008
```

Worktrees created from `/var/home/user/Monochromatic` at `3fd737249`:

- `/home/user/temp/pnpm-cache-bench-20260629-120008/default-cache`
- `/home/user/temp/pnpm-cache-bench-20260629-120008/zero-cache`

Both are detached worktrees.
They are under `~/temp`, not `/tmp`, so benchmark IO lands on the filesystem-backed Btrfs volume.

Scripts are banned in both worktrees by adding `ignoreScripts: true` to `pnpm-workspace.yaml`.
The benchmark runner also invokes pnpm with `--ignore-scripts` and `npm_config_ignore_scripts=true`.

`modulesCacheMaxAge` differs intentionally:

- `default-cache`: `modulesCacheMaxAge: 10080`
- `zero-cache`: `modulesCacheMaxAge: 0`

The benchmark runner is:

```txt
/home/user/temp/pnpm-cache-bench-20260629-120008/bench.mjs
```

It changes the catalog entries for `oxlint` and `@oxlint/plugins` between exact `1.70.0` and
`1.71.0`, then runs:

```sh
pnpm install --ignore-scripts --no-frozen-lockfile --prefer-offline --reporter=append-only
```

Planned output paths:

```txt
/home/user/temp/pnpm-cache-bench-20260629-120008/results.json
/home/user/temp/pnpm-cache-bench-20260629-120008/results.csv
```

## Source evidence already collected

Official pnpm docs fetched from `https://pnpm.io/settings#modulescachemaxage` say:

- `nodeLinker: isolated` uses a virtual store at `node_modules/.pnpm`.
- `packageImportMethod: clone-or-copy` first tries CoW clones, then falls back to copying.
- `modulesCacheMaxAge` defaults to `10080`, which is seven days in minutes.
- `modulesCacheMaxAge` controls when orphan packages from the modules directory are removed.
- The stated reason is installation speed when switching branches or downgrading dependencies.

Official pnpm docs fetched from `https://pnpm.io/cli/store` say `pnpm store prune` removes
unreferenced packages from the global store and that pnpm intentionally does not remove them
automatically during normal installs.

Source clone:

```txt
/tmp/agent/pnpm-20260629
```

Relevant source paths in the clone:

- `pnpm11/installing/deps-installer/src/install/extendInstallOptions.ts`
  sets default `modulesCacheMaxAge: 7 * 24 * 60`.
- `pnpm11/installing/deps-installer/src/install/index.ts`
  computes `pruneVirtualStore` from `ctx.modulesFile.prunedAt` and `modulesCacheMaxAge`.
- `pnpm11/installing/linking/modules-cleaner/src/prune.ts`
  finds `orphanDepPaths` by comparing current lockfile packages to wanted lockfile packages.
  When `pruneVirtualStore !== false`, it removes orphan package directories from
  `node_modules/.pnpm` and removes available virtual-store directories not present in the wanted
  package set.
- `pnpm11/installing/deps-installer/test/install/modulesCache.ts`
  verifies that an uninstalled package remains in `.pnpm` until the configured modules cache age
  expires.
- `pnpm11/installing/commands/src/prune.ts`
  makes `pnpm prune` call install with `modulesCacheMaxAge: 0`, `pruneDirectDependencies: true`,
  and `pruneStore: true`.

## Local observations already made

In the main worktree:

- `pnpm why --recursive @oxlint/plugins` reports only `@oxlint/plugins@1.71.0`.
- `node_modules/@oxlint/plugins` points to `../.pnpm/@oxlint+plugins@1.71.0/...`.
- `node_modules/.pnpm` contains both `@oxlint+plugins@1.70.0` and `@oxlint+plugins@1.71.0`.
- `pnpm-lock.yaml` contains `1.71.0`, not `1.70.0`.
- `@oxlint/plugins` package versions each contain only six files.
- `du` reports both directories as `208K`, but apparent size is `193K` for each.
- The filesystem is Btrfs.
- Matching files across the two package versions have identical SHA-256 hashes except
  `package.json`.
- `filefrag -v` on `index.d.ts` shows both versions share the same physical extent with
  the `shared` flag.

Interpretation so far:

- The duplicate `@oxlint/plugins` versions are not two active dependency versions.
- They are project-local virtual-store cache entries.
- On this repo's Btrfs setup with `packageImportMethod: clone-or-copy`, most identical file content
  is physically shared by CoW reflinks rather than hardlinks.
- `du` is not enough evidence of unique disk usage on this filesystem.
- The human confusion and stale-version noise remain real even when physical data blocks are shared.

## User preferences and constraints

- The user is skeptical of pnpm's cache benefit versus the machinery and bugs.
- Benchmark using new worktrees off this repo.
- Benchmarks must run under `~/temp`, not `/tmp`.
- Ban all scripts in benchmark worktrees after creating them.
- Changing dependency specs to exact versions inside benchmark worktrees is allowed.

## Next steps

- Run `node /home/user/temp/pnpm-cache-bench-20260629-120008/bench.mjs /home/user/temp/pnpm-cache-bench-20260629-120008`.
- If the benchmark fails because exact catalog pins conflict with overrides or lockfile state,
  adjust only the benchmark worktrees.
- Record elapsed times, virtual-store entry counts, `du`, apparent size, and oxlint-related entries.
- Consider a second benchmark with a dependency family larger than `@oxlint/plugins`, because the
  plugin package is tiny and mostly unchanged between versions.
- Synthesize whether setting `modulesCacheMaxAge: 0` in this repo would materially hurt realistic
  install flows.

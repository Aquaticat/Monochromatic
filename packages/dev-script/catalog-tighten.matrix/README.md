# @monochromatic-dev/dev-script-catalog-tighten.matrix

Containerised end-to-end matrix for `catalog-tighten`. A sidecar of
`packages/dev-script/catalog-tighten`, it proves the tool resolves the active
installed version and tightens the catalog floor correctly across every pnpm
install layout, in isolated containers.

## What it covers

Each combination installs a tiny fixture workspace under one pnpm layout and
asserts catalog-tighten tightens `picomatch` from `>=4.0.0` to `>=4.0.2` (the
version the fixture pins via an override):

- `nodeLinker: isolated`, hoist on and off.
- `nodeLinker: hoisted`, hoist on and off.
- `nodeLinker: pnp` (no `node_modules`; resolved through `.pnp.cjs`).
- A stale-orphan case: a higher `picomatch@4.0.4` is seeded into the virtual
  store with no symlink pointing at it; the tool must still tighten to the
  active `4.0.2`, never the orphan. This is the regression that proves removing
  the old store-scan was correct (see `docs/troubleshooting/pnpm-modules-cache.md`).

## How it runs

`test:matrix` runs the orchestrator, which for each combination launches a
podman container:

- The monorepo is bind-mounted read-only at `/repo`, so catalog-tighten and its
  `yaml` dependency resolve through the mounted symlinks without a build.
- The fixture is written and installed in a writable tmpfs at `/work`.
- pnpm is provisioned by corepack at the pinned version; the rootfs is
  read-only and caches go to tmpfs.
- Per-container memory, cpu, and pid caps bound resource use.

Network is required (the fixture install pulls from the registry), so this is
not part of the standard `test:unit` run.

## Usage

```sh
# Run the full container matrix (needs podman + network)
mise run //packages/dev-script/catalog-tighten.matrix:test:matrix

# Fast host-only unit tests for the fixture builder
mise run //packages/dev-script/catalog-tighten.matrix:test:unit
```

## Layout

- `src/combos.ts`: the combinations and the fixture file content (pure, unit-tested).
- `src/in-container.ts`: the per-combination entrypoint that runs inside a container.
- `src/matrix.unit.matrix.test.ts`: the orchestrator that launches one container per combination.

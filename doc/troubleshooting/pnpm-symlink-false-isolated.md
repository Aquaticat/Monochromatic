# pnpm 11.8.0: `symlink: false` with `nodeLinker: isolated` builds an unresolvable virtual store

This document records what pnpm's `symlink: false` setting does when the node linker remains
`isolated`.
The behavior is intentional enough to explain from pnpm's docs and source,
but it is surprising because the resulting `node_modules` is not a drop-in,
symlink-free replacement for the default isolated layout.

Current status (2026-06-22,
 pnpm 11.8.0):
 `symlink: false` suppresses the symlink layer that
makes the isolated virtual store resolvable by Node.
It still imports package files into `node_modules/.pnpm`,
 writes metadata,
and may write command shims in `node_modules/.bin`,
 but it does not expose direct dependencies at
`node_modules/<name>`.
Use `nodeLinker: hoisted` when the requirement is a runnable `node_modules` tree without symlinks.

## Symptom

A project configured like this installs successfully:

```yaml
# pnpm-workspace.yaml
nodeLinker: isolated
symlink: false
```

After `pnpm install`,
 the project has package contents under `node_modules/.pnpm`,
but no direct dependency entry such as `node_modules/is-odd`.
Normal Node resolution from the project root fails:

```text
ERR_MODULE_NOT_FOUND
```

This can be mistaken for a symlink-free isolated install.
It is not.
It is an isolated virtual store without the symlink graph that normally connects that store to
Node's resolver.

## Root cause

### Step 1: pnpm documents `isolated` as symlink-based and `symlink: false` as a PnP companion

The pnpm 11 settings page defines `nodeLinker: isolated` as:

```text
isolated - dependencies are symlinked from a virtual store at node_modules/.pnpm.
```

The same page defines `symlink` as:

```text
When symlink is set to false, pnpm creates a virtual store directory without any symlinks.
It is a useful setting together with nodeLinker=pnp.
```

So the documented combination for `symlink: false` is PnP,
not a runnable isolated `node_modules` without symlinks.
The older pnpm blog post says the same for the strict PnP setup:

```text
node-linker=pnp
symlink=false
```

Sources:

- <https://pnpm.io/settings#nodelinker>
- <https://pnpm.io/settings#symlink>
- <https://pnpm.io/blog/2020/10/17/node-modules-configuration-options-with-pnpm#plugnplay-the-strictest-configuration>

### Step 2: `symlink: false` deletes hoist patterns before install

In pnpm commit `f742b04` from `/tmp/agent/pnpm-symlink-20260622`,
`pnpm11/pnpm/src/getConfig.ts:152-154` removes both private and public hoist patterns when
`config.symlink` is false:

```ts
// /tmp/agent/pnpm-symlink-20260622/pnpm11/pnpm/src/getConfig.ts
if (!config.symlink) {
  delete config.hoistPattern
  delete config.publicHoistPattern
}
```

This is why explicit `hoistPattern` or `publicHoistPattern` does not rescue the isolated layout
when `symlink: false` is set.
The hoist linker creates symlinks,
 so pnpm removes that path too.

### Step 3: fresh installs skip both child dependency symlinks and direct dependency symlinks

Fresh isolated installs route through `linkPackages`.
`pnpm11/installing/deps-installer/src/install/link.ts:441-447` skips the child dependency
symlink pass when `opts.symlink` is false,
 but still runs package import into the virtual store:

```ts
// /tmp/agent/pnpm-symlink-20260622/pnpm11/installing/deps-installer/src/install/link.ts
!opts.symlink
  ? Promise.resolve()
  : linkAllModules([...newPkgs, ...existingWithUpdatedDeps], depGraph, {
    lockfileDir: opts.lockfileDir,
    optional: opts.optional,
  }),
linkAllPkgs(opts.storeController, newPkgs, {
```

`pnpm11/installing/deps-installer/src/install/link.ts:538-542` is the import call that still
materializes package files in `node_modules/.pnpm`:

```ts
// /tmp/agent/pnpm-symlink-20260622/pnpm11/installing/deps-installer/src/install/link.ts
const { importMethod, isBuilt } = await storeController.importPackage(depNode.dir, {
  disableRelinkLocalDirDeps: opts.disableRelinkLocalDirDeps,
  filesResponse: files,
  force: opts.force,
  safeToSkip: opts.enableGlobalVirtualStore,
```

The importer/root symlinks are gated separately.
`pnpm11/installing/deps-installer/src/install/link.ts:262-263` only links direct dependencies
when `opts.symlink` is true:

```ts
// /tmp/agent/pnpm-symlink-20260622/pnpm11/installing/deps-installer/src/install/link.ts
let linkedToRoot = 0
if (opts.symlink && !opts.virtualStoreOnly) {
```

So with `nodeLinker: isolated` and `symlink: false`,
 package files exist inside the virtual store,
but neither the transitive graph symlinks nor the root direct dependency symlinks are created.

### Step 4: headless installs make the same choice

Frozen and headless installs use the same meaning.
`pnpm11/installing/deps-restorer/src/index.ts:456-461` skips `linkAllModules` when
`opts.symlink === false`,
 while still running `linkAllPkgs`:

```ts
// /tmp/agent/pnpm-symlink-20260622/pnpm11/installing/deps-restorer/src/index.ts
opts.symlink === false || opts.enableModulesDir === false
  ? Promise.resolve()
  : linkAllModules(depNodes, {
    optional: opts.include.optionalDependencies,
  }),
linkAllPkgs(opts.storeController, depNodes, {
```

`pnpm11/installing/deps-restorer/src/index.ts:818` also returns before linking direct dependencies:

```ts
// /tmp/agent/pnpm-symlink-20260622/pnpm11/installing/deps-restorer/src/index.ts
if (symlink === false) return 0
```

### Step 5: isolated mode does not add a PnP resolver

PnP resolution is enabled only when `nodeLinker` is `pnp`.
`pnpm11/config/reader/src/index.ts:640-642` sets `enablePnp` in that case:

```ts
// /tmp/agent/pnpm-symlink-20260622/pnpm11/config/reader/src/index.ts
switch (pnpmConfig.nodeLinker) {
  case 'pnp':
    pnpmConfig.enablePnp = pnpmConfig.nodeLinker === 'pnp'
```

The installer writes `.pnp.cjs` only when `opts.enablePnp` is true.
`pnpm11/installing/deps-installer/src/install/index.ts:1750-1754`:

```ts
// /tmp/agent/pnpm-symlink-20260622/pnpm11/installing/deps-installer/src/install/index.ts
if (opts.enablePnp) {
  const importerNames = Object.fromEntries(
    projects.map(({ manifest, id }) => [id, manifest.name ?? id])
  )
  await writePnpFile(result.currentLockfile, {
```

With `nodeLinker: isolated`,
 no PnP resolver replaces the missing symlink graph.
That is why normal project-root imports fail.

## Verification

Version under test:

```text
pnpm 11.8.0
node v26.3.1
pnpm source clone: /tmp/agent/pnpm-symlink-20260622 at commit f742b04
```

### Failing catalog: isolated plus `symlink: false`

Runnable harness:

```sh
# /tmp/pnpm-symlink-false-harness.sh
work=$(mktemp --directory /tmp/pnpm-symlink-false.XXXXXXXX)
printf '{"dependencies":{"is-odd":"3.0.1"}}\n' > "$work/package.json"
printf 'nodeLinker: isolated\nsymlink: false\nstoreDir: .pnpm-store\nstrictDepBuilds: false\n' \
  > "$work/pnpm-workspace.yaml"
cd "$work" || exit 1
pnpm install --ignore-scripts --reporter=silent
find node_modules -type l -print | sort
find node_modules -mindepth 1 -maxdepth 1 -print | sort
find node_modules/.pnpm -maxdepth 3 -print | sort | head --lines=80
node --input-type=module -e \
  "import('is-odd').then(() => console.log('ok')).catch((error) => { console.log(error.code); process.exitCode = 1 })"
```

Observed output:

```text
symlinks:

top-level entries:
node_modules/.modules.yaml
node_modules/.package-map.json
node_modules/.pnpm
node_modules/.pnpm-workspace-state-v1.json
virtual-store entries:
node_modules/.pnpm/is-number@6.0.0/node_modules/is-number
node_modules/.pnpm/is-odd@3.0.1/node_modules/is-odd
require result:
ERR_MODULE_NOT_FOUND
```

The virtual store is populated and contains no symlinks,
 but the direct dependency is not reachable
from project-root Node resolution.

### Working catalog: isolated with default symlinks

Changing only `symlink: true` gives the normal isolated layout:

```text
symlinks:
node_modules/is-odd
node_modules/.pnpm/is-odd@3.0.1/node_modules/is-number
node_modules/.pnpm/node_modules/is-number
require result:
true
```

This verifies that the missing symlink graph is what breaks project-root imports in the failing case.

### Working catalog: hoisted linker for a symlink-free runnable tree

For a runnable `node_modules` tree without symlinks,
 use the hoisted linker:

```yaml
# pnpm-workspace.yaml
nodeLinker: hoisted
```

The verification harness with `is-odd@3.0.1` produced:

```text
symlinks:
require result:
true
```

### Partial working catalog: bins are still command shims

A package with binaries still gets non-symlink shim files in `node_modules/.bin`.
With `cowsay@1.6.0`,
 `nodeLinker: isolated`,
 and `symlink: false`,
 the harness found zero symlinks
and these file entries:

```text
node_modules/.bin/cowsay
node_modules/.bin/cowthink
```

This does not make package imports resolvable.
It only means direct package binaries can still be exposed as shims.

## Verified workarounds

### Keep isolated mode and leave `symlink` enabled

Use:

```yaml
# pnpm-workspace.yaml
nodeLinker: isolated
symlink: true
```

Tradeoff:
 this preserves pnpm's strict isolated layout,
but it requires tools and deployment targets to tolerate symlinks.

### Use the hoisted linker when symlinks are forbidden

Use:

```yaml
# pnpm-workspace.yaml
nodeLinker: hoisted
```

Tradeoff:
 this creates a flat `node_modules` that is compatible with tools and platforms that reject
symlinks,
but it gives up the stricter isolated graph shape.
The pnpm settings page names serverless deployments,
React Native,
`bundledDependencies`,
and `--preserve-symlinks` as legitimate reasons for `nodeLinker: hoisted`.

### Use PnP only when the runtime and tooling path is PnP-aware

Use:

```yaml
# pnpm-workspace.yaml
nodeLinker: pnp
symlink: false
```

Tradeoff:
 PnP is the documented companion for `symlink: false`,
but it changes runtime resolution and tool compatibility.
Do not treat it as a `node_modules` layout.

### Use `virtualStoreOnly` when the goal is prepopulation

Use:

```yaml
# pnpm-workspace.yaml
virtualStoreOnly: true
```

Tradeoff:
 pnpm 11 documents this as a way to populate the virtual store without importer symlinks,
hoisting,
bin links,
or lifecycle scripts.
It is useful for preloading artifacts,
not for a runnable project dependency tree.

## What does not work

### `symlink: false` is not a no-symlink isolated install

It removes the symlink graph that makes isolated mode work with Node's normal resolver.
The package files stay in `node_modules/.pnpm`,
 but the import path from the project root is absent.

### Explicit hoist patterns do not restore links

This configuration still produced zero symlinks in the harness:

```yaml
# pnpm-workspace.yaml
nodeLinker: isolated
symlink: false
hoistPattern:
  - "*"
publicHoistPattern:
  - "is-number"
```

The source explains why:
 pnpm deletes hoist patterns when `symlink` is false.

### `packageImportMethod` is the wrong knob

The pnpm settings page says `packageImportMethod` controls how package files are imported from the
store,
and that disabling symlinks inside `node_modules` is a `nodeLinker` decision.
Changing import method can switch among clone,
hardlink,
and copy behavior for package files,
but it does not create a runnable isolated tree without dependency symlinks.

## Upstream filing artifact

### Upstream filing decision

1.  Is it really upstream's fault?
    No.
    The behavior matches pnpm's documented meaning:
     isolated mode is symlink-based,
    and `symlink: false` is documented as useful with PnP.
2.  Can upstream fix it?
    A documentation clarification could make the isolated case more explicit,
    but the implementation is internally consistent.
3.  Are they supporting this use case?
    pnpm supports PnP plus `symlink: false` and hoisted `node_modules` without symlinks.
    The docs do not present isolated plus `symlink: false` as a runnable no-symlink layout.
4.  Would the repo welcome our contribution?
    `CONTRIBUTING.md` and `.github/ISSUE_TEMPLATE/*` accept actionable reports and PRs.
    No AI-assistance ban was found in those files.
5.  Will they likely fix it?
    Not applicable for a bug fix because this is intended behavior.
    A docs patch might be accepted if the wording is concrete.
6.  Have we prototyped a minimal fix compatible with their architecture?
    No.
    Constraint 1 fails for a bug report,
    and a docs-only clarification was not needed to answer the current behavior question.

### Duplicate search

Searches run on 2026-06-22:

```sh
# /tmp/agent/pnpm-symlink-duplicate-search.txt
gh search issues --repo pnpm/pnpm "symlink false isolated node-linker" --state open --limit 20
gh search issues --repo pnpm/pnpm "symlink false isolated node-linker" --state closed --limit 20
gh search prs --repo pnpm/pnpm "symlink false isolated node-linker" --state open --limit 20
gh search prs --repo pnpm/pnpm "symlink false isolated node-linker" --state closed --limit 20
gh search issues --repo pnpm/pnpm "\"symlink=false\" \"node-linker=isolated\"" --state open --limit 20
gh search issues --repo pnpm/pnpm "\"symlink=false\" \"node-linker=isolated\"" --state closed --limit 20
```

All returned no results for the isolated-specific query.
Related but different upstream material exists for PnP confusion:

- [pnpm/pnpm#8146](https://github.com/pnpm/pnpm/issues/8146),
  `node-linker=pnp` plus `symlink=false` still creating `node_modules`.
- [pnpm discussion #8486](https://github.com/orgs/pnpm/discussions/8486),
  why PnP docs recommend `symlink=false`.

### Filing artifact

Do not file as-is.
There is no upstream bug report to make from this investigation.
If future work wants to clarify docs,
file a docs PR rather than a bug issue,
and scope it to saying that `symlink: false` with `nodeLinker: isolated` populates the virtual
store without creating a runnable Node-resolvable `node_modules` tree.

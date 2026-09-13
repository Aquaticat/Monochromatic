# Rolldown 1.2.3 inlining Satteri 0.9.5 relocates its native binding lookup

## Symptom

The package-local dependency-bundling prototype builds and type-checks,
but its JavaScript-only output fails during import:

```text
Cannot find native binding. npm has a bug related to optional dependencies ...
```

Satteri's retained cause chain identifies the actual failed lookups:

```text
Cannot find module '@bruits/satteri-linux-x64-gnu'
Cannot find module './satteri_napi.linux-x64-gnu.node'
```

Both use the emitted `assembly-orphan-trim-*.mjs` chunk as their require origin.
The failure precedes unit assertions.
Do not follow the generic npm-reinstallation advice for this measured relocation failure.

## Root cause

The default repository build keeps declared third-party packages external.
`package/config/rolldown/src/package-externals.ts:219`
constructs that list from dependency maps,
then removes names selected for bundling:

```ts
// package/config/rolldown/src/package-externals.ts
const externalNames = Object.keys({
  ...manifest.dependencies,
  ...manifest.peerDependencies,
}).filter(/* configured bundle-inclusion predicate */);
```

The prototype sets `nodeExternal({ alwaysBundle: ['**'] })` through the existing package-level override.
That moves Satteri's loader into an emitted chunk.
The installed `satteri@0.9.5` package's `index.js:6` establishes a file-relative require:

```js
// Installed satteri/index.js
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
```

Its Linux x64 GNU branch at `index.js:287` first tries the adjacent native asset,
then the optional package at `:292`:

```js
// Installed satteri/index.js, separate attempts
return require('./satteri_napi.linux-x64-gnu.node');
const binding = require('@bruits/satteri-linux-x64-gnu');
```

The JavaScript-only output contains neither the adjacent binary nor a resolvable optional package at that new origin.
The existing installed native package is present under Satteri's own dependency directory.
It is not missing from the installation.

## Version evidence

The actual JavaScript package and resolved native package are `0.9.5`.
Direct `createRequire` resolution from both the development and temporary worktrees reaches those same files.
The generated loader nevertheless contains a `0.8.1` version-check literal.
That literal does not identify the installed package version and is not the cause of the observed missing-file failure.
No version-enforcement override was supplied to these containers.

The readonly upstream clone is
`/var/home/user/temp/agent/satteri-runtime-source-20260913`,
commit `4171b78ae86ed815c7e6040715e96e49e7b74969`.
Its package is already `0.10.5`,
so it is architectural corroboration,
not the source of claims about installed `0.9.5` behavior.
`packages/satteri/src/binding.ts:39` forwards to generated `../index.js`;
`packages/satteri/patch-binding.js:3` locates that generated file:

```js
// Upstream packages/satteri/patch-binding.js
const bindingPath = new URL('./index.js', import.meta.url);
```

## Verification

Runtime is Node `26.8.2`,
Linux x64,
in no-network containers capped at 2 GiB RAM,
2 CPUs and 512 PIDs.
The experiment uses the current repository-owned `nodeConfig` override,
not a global configuration or dependency installation change.

Working catalog:

- The JavaScript-plus-native-asset copied artifact loads with no workspace or `node_modules` mount.
- It reproduces the actual 93-entry listing,
  90 eligible entries,
  272-parent population and frozen forty-parent membership.
- Its consumer matches all sixty-three supporting artifacts,
  their semantic roles,
  184 raw corpus documents and ninety archive-origin maps.
- Fetch and provider request counts remain zero.

Refused catalog:

- Original unbundled artifact with dependencies unavailable:
  `ERR_MODULE_NOT_FOUND` for `p-limit`.
- JavaScript-only bundled artifact:
  Satteri's missing native-binding cause chain.
- Copied native-asset artifact with only the `.node` file removed:
  the same native-binding failure.

Retained standalone evidence:

- `/var/home/user/temp/agent/runtime-closure-standalone-YOM2iV`:
  original dependency-absence control.
- `/var/home/user/temp/agent/runtime-closure-standalone-2Oy55F`:
  copied native-asset consumer.
- `/var/home/user/temp/agent/runtime-closure-standalone-ImrE1u`:
  native-asset removal control.

Each launch records copied file hashes,
mounts,
image identity,
environment and terminal status.
The successful consumer's peak container memory is 1675886592 bytes.
The matched-environment R7 full suite also passes build,
types and all 629 test-entry processes,
with `test:unit exit 0` inspected at line 10374 of its unit log.
All 192 copied R2 files match the R7 artifact by name and byte hash;
the comparator includes an actual one-byte-file-change positive control.
This is not yet a complete runtime-closure or adoption claim:
remaining loader paths and the final target/environment contract still require review.

## Verified remedy at the measured target

The prototype resolves the native package relative to the package's Satteri entry,
then emits its exact bytes as `satteri_napi.linux-x64-gnu.node` beside the generated JavaScript.
Rolldown's current `EmittedAsset` declaration supports a fixed `fileName` and binary `source`;
the build and copied-artifact consumer exercise that path.

The prototype helper lives only in the owned experiment worktree,
`package/module/translation-repair/src/build-native-runtime-assets.ts`.
It also emits `runtime-imports.json` for later inspection.

Tradeoffs:

- This prototype targets the measured Linux x64 GNU runtime,
  not every supported Satteri platform.
- Native bytes must be included in the frozen runtime digest.
- Native-loader environment overrides remain separate execution inputs to reject or bind.
- System libraries and the Node binary remain separate from JavaScript dependency closure.

## Separate full-suite harness prerequisites

The native-asset build exposes test-environment failures distinct from missing parser assets:

- Temporary Git fixtures were created under the prototype repository,
  inheriting its unmounted trust configuration.
  Moving container `TMPDIR` to an independently mounted `/tmp` makes the ordinary fixture draws pass.
- A benchmark child deliberately keeps only `PATH` and `HOME`.
  Its Node process loses `LD_LIBRARY_PATH` and exits `127` because `libatomic.so.1` is unavailable on default search paths.
  A direct inherited-versus-minimal child probe reproduces `0` versus `127`.
- The missing-visual fixture expects an absent path inside a valid pinned corpus.
  With the corpus itself unavailable it reports `CorpusReadError` kind `other`
  and `resumable-failure`,
  not the expected missing-object stop.

The R7 full-suite harness supplies default-path libatomic,
independent `/tmp` and a readonly corpus at the temporary home's default corpus path.
An intermediate global clone-directory override changed the expected CLI defaults,
so it was removed rather than changing that assertion.
These harness corrections pass the full suite without changing provider behavior or relaxing assertions.

## Dedicated build follow-up

The separate `runtime:seal` task keeps normal build policy intact and writes candidates under package `node_modules`,
not published `dist/final` or `src`.
Its initial emitted-file verifier caught the declaration plugin reporting `.d.mts` files as chunks;
those are now excluded from executable identity.
The target/native/Node manifest is build evidence only.
Pre-import enforcement and location-independent repeated builds remain under verification.

The AST audit reconciles 790 static JavaScript edges and two literal Node dynamic imports
with 794 emitted edges:
the additional edges are declaration-only imports from `index.d.mts` and `roster-bench.d.mts`.
It retains every indirect loader observation for target/environment classification.
`readelf --dynamic` on the resolved native file names `libgcc_s.so.1`,
`libpthread.so.0`,
`libc.so.6` and `ld-linux-x86-64.so.2`.
This enumerates native dependencies;
it does not establish general operating-system compatibility.

## Podman launch controls before application import

Task 47 probes the host launch contract before implementing the native input runner.
Podman `5.8.4` uses source commit `5431df23c742e5edea35bef34eed696f4db0106b`.
The independently selected base image ID is
`4251fdebd86463aba655f5069e9890cd3c99cf12e18479840888a74f7f60bab8`.
A disposable derived image adds a benign `NODE_OPTIONS` preload and a separate image entrypoint,
each writing only a marker into an owned output directory.
The derived image and seed container are removed by the probe's cleanup.
No application or model client is imported.

The first probe stops before container execution because it incorrectly expects image inspection's `Id`
to carry a `sha256:` prefix.
The measured field is a bare 64-character lowercase hexadecimal identifier.
Correcting that assertion allows the launch controls to run;
it is not evidence of an image-resolution failure.

### Environment and entrypoint are separate controls

`pkg/specgen/generate/container.go:218-243` clears default and image environment first,
then adds eligible host proxies and explicit environment:

```go
// Podman pkg/specgen/generate/container.go, separate excerpts
if s.UnsetEnvAll != nil && *s.UnsetEnvAll {
    defaultEnvs = make(map[string]string)
}
osEnv := envLib.Map(os.Environ())
if envHost {
    defaultEnvs = envLib.Join(defaultEnvs, osEnv)
} else if httpProxy {
    for _, envSpec := range config.ProxyEnv {
        if v, ok := osEnv[envSpec]; ok {
            defaultEnvs[envSpec] = v
        }
    }
}
s.Env = envLib.Join(defaultEnvs, s.Env)
```

`pkg/specgen/generate/oci.go:31-34` independently chooses the image entrypoint only when the caller supplies none:

```go
// Podman pkg/specgen/generate/oci.go
entrypoint := s.Entrypoint
if entrypoint == nil && imageData != nil {
    entrypoint = imageData.Config.Entrypoint
}
```

The tested command therefore combines `--unsetenv-all`,
`--http-proxy=false` and a fixed `--entrypoint`.
None substitutes for the others.

The working child still receives `HOSTNAME`.
`libpod/container_internal_linux.go:537-546` adds it after spec generation when the caller did not provide it:

```go
// Podman libpod/container_internal_linux.go
needEnv := true
for _, checkEnv := range g.Config.Process.Env {
    if strings.SplitN(checkEnv, "=", 2)[0] == "HOSTNAME" {
        needEnv = false
        break
    }
}
if needEnv {
    g.AddProcessEnv("HOSTNAME", hostname)
}
```

A child environment allowlist must account for that explicit platform behavior rather than assuming an empty map.

### Verified launch catalog

`preparation-launch-contract-probe-r3-20260913.out` and
`/home/user/temp/agent/preparation-launch-probe-SyU6K2/report.json` record the controls:

- Fixed entrypoint without environment clearing:
  the image preload executes before the inspection script,
  and the synthetic host proxy is inherited.
- `--unsetenv-all` alone:
  the preload is absent,
  but the synthetic host proxy is still inherited.
- `--unsetenv-all --http-proxy=false` with the fixed entrypoint:
  neither marker executes and neither loader nor proxy canary is present.
- Environment clearing without the entrypoint override:
  the separate image entrypoint marker executes.

The working child sees only `HOME`,
`HOSTNAME`,
`PATH` and `TMPDIR` environment names.
It reports Node `26.8.2`,
GNU libc `2.40`,
only loopback interfaces,
`memory.max=2147483648`,
`memory.swap.max=2147483648`,
`cpu.max=200000 100000` and `pids.max=512`.
Its UID/GID are the caller's `1000`,
and host-side stat confirms the created receipt belongs to that caller.
The mounted default-path libatomic hashes to
`b08060687ffb5768003b0c283cac5bddaa84ea5526d4d7bcb5994af98af5a130` inside the child.
These are observations of this image and launch,
not universal IDs or runtime values to hardcode into production.

The probe requests a read-only root,
read-only Node/library/probe mounts,
a private writable output mount,
no network,
dropped capabilities,
no new privileges,
no healthcheck or image-created volume,
and a bounded temporary filesystem.
Those flags must still be integrated and verified through the actual preparation CLI.

Clearing image defaults requires reintroducing a deliberate environment allowlist.
Disabling host proxy forwarding is appropriate for this no-network operation,
not a policy change for later live acquisition.
Overriding the image entrypoint makes the owning runner responsible for child lifecycle.
Child hash checks happen before application import,
not before Node,
the dynamic linker or its libraries execute;
the trusted host launch establishes their pre-start binding.
No upstream fault or installed-source change is established by these documented flag controls.

## What does not work

- JavaScript bundling alone does not carry this native resource.
- Build and TypeScript success do not prove importability.
- Checking `NODE_OPTIONS` only after Node starts does not prevent the measured image preload from executing.
- `--unsetenv-all` alone does not suppress subsequent host-proxy forwarding.
- Environment clearing does not replace the image entrypoint.
- A generated loader's version literal does not prove a dependency-version change.
- Keeping libraries available only through inherited environment variables does not cover minimal-environment children.
- A missing corpus and a missing path inside a valid corpus are different inputs.
- The historical pipeline-digest comment calling dependency bundling a repo-wide-only configuration change
  does not describe the current per-package override.

## Upstream filing decision

1.  Upstream fault:
    not established.
    The application prototype moved a file-relative loader without its asset.
2.  Fixability:
    the measured consumer-side asset emission succeeds.
3.  Supported use:
    Rolldown supports emitted binary assets;
    this report does not claim Satteri promises resource-free JavaScript bundling.
4.  Contribution policy:
    not reached because no upstream patch or filing is proposed.
5.  Maintainer intent:
    not inferred from the generic npm diagnostic or these application probes.
6.  Prototype:
    the asset-carrying artifact and removal control were exercised without installed dependency patches.

Nothing to file upstream for the observed relocation failure.
No issue,
comment,
package reinstall or installed-source edit occurred.

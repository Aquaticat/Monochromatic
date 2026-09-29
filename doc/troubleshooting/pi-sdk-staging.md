# Pi 0.87.1 nominal dependency inventory rejects the configured workspace graph

## Symptom

The private auto-mode SDK preparation controller stopped before evaluating package code:

```text
AssertionError [ERR_ASSERTION]: Dependency staging prerequisites unresolved; retain inventory
3 !== 0
```

The emitter was the owned `contract/sdk/inventory.mjs:89`,
not Pi,
pnpm,
or a provider.
Process `proc_1af5` retained its output before throwing.
It recorded missing declared `@aws-sdk/client-bedrock-runtime` and `@google/genai` dependencies,
and rejected `proper-lockfile` because its resolved directory was outside the external package store.
This was not an SDK startup failure.

This preparation incident is separate from the
[instruction-view observations](pi-instruction-snapshots.md)
and the unresolved historical preparation stall.
No production package,
lockfile,
policy,
or provider configuration was changed.

## Source identity

The private repository is `~/temp/agent/auto-mode-consumer-contract.mDLkyNoP`.
Private paths in this report are relative to it.
The nominal inventory is retained at `contract/sdk/sdk-dependency-inventory.json`,
SHA-256 `a4db9a8556e7dc3e272a58cea164cc16e749b121b9d922d06a05c95445429f05`.

The installed SDK and Pi AI versions are `0.87.1`.
Read-only upstream source is `~/temp/agent/pi-input-provenance-2026-09-26`,
commit `f07218c4d4bbc12bef056a7058c3dd49dfe41abe`.
`packages/ai/` paths refer to that checkout.
The host metadata controllers reported Node `v26.10.0`;
no SDK runtime was started by these inventories.

## Root cause trace

### The owned admission rule excluded the existing shim

The initial controller admitted only directories under `node_modules/.pnpm`:

```javascript
// Private contract/sdk/inventory.mjs:42
const fromStore = relative(store, path);
if (fromStore === '..' || fromStore.startsWith(`..${sep}`)) {
  failures.push({ path, reason: 'dependency resolves outside the installed external package store' });
  continue;
}
```

Repository configuration intentionally selects a different owner:

```yaml
# pnpm-workspace.yaml:358
'proper-lockfile': 'link:package/shim/proper-lockfile'
```

The [existing removal decision](../decision/proper-lockfile-removal.md)
and [dependency audit](dependencies.md)
already document this substitution.
The current shim's `package.json:24` declares no runtime dependencies.
Its current `index.cjs:3` imports Node filesystem,
timer,
and path builtins:

```javascript
// package/shim/proper-lockfile/index.cjs:3
const { mkdirSync, rmdirSync, } = require('node:fs',);
const { setTimeout: sleep, } = require('node:timers/promises',);
const { dirname, basename, resolve, } = require('node:path',);
```

The remedy is to preserve and bind this exact owner,
not silently omit it or restore the upstream dependency.
No general claim of shim parity is established by reading its metadata.

### Published declarations are not the effective workspace selection

The initial controller combined package dependency declarations
and treated every unresolved non-optional declaration as a staging failure:

```javascript
// Private contract/sdk/inventory.mjs:56 and 63, selected statements
const declared = { ...metadata.dependencies, ...metadata.peerDependencies, ...metadata.optionalDependencies };
else failures.push({ ...record, reason: 'required installed dependency missing' });
```

Current repository configuration explicitly removes the reported cloud SDK edges:

```yaml
# pnpm-workspace.yaml:234
'@earendil-works/pi-ai>@aws-sdk/client-bedrock-runtime': '-'
'@earendil-works/pi-ai>@google/genai': '-'
```

The reviewed configuration hash is
`4a6a413b76bc2d6cea134bffd552f7eb77668aea9710bba29b70ef48a191b55c`.
The original controller's store-only and all-declarations-installed assumptions
were not valid for this configured graph.
The inventory did not demonstrate that these packages were needed by the planned scripted provider.

### Lazy provider entry points are narrower evidence than startup qualification

Current source defers the Google implementation imports:

```typescript
// packages/ai/src/api/google-generative-ai.lazy.ts:4
export const googleGenerativeAIApi = (): ProviderStreams => lazyApi(() => import("./google-generative-ai.ts"));
```

```typescript
// packages/ai/src/api/google-vertex.lazy.ts:4
export const googleVertexApi = (): ProviderStreams => lazyApi(() => import("./google-vertex.ts"));
```

`packages/ai/src/api/bedrock-converse-stream.lazy.ts:26` similarly supplies
an asynchronous implementation loader to `lazyApi`.
The loader is called from the streaming paths:

```typescript
// packages/ai/src/api/lazy.ts:73, selected statements
stream: (model, context, options) =>
  lazyStream(model, async () => (await load()).stream(model, context, options)),
streamSimple: (model, context, options) =>
  lazyStream(model, async () => (await load()).streamSimple(model, context, options)),
```

The installed compiled lazy-route files were also inspected and hashed.
This supports retaining the configured removals for the proposed scripted-provider path.
It does not prove complete static reachability,
actual package import success,
or availability of the removed providers.
An unexpected attempt to use a removed route must stop the probe,
not install dependencies or fall back to another provider.

## Verification

These are recorded private invocations,
not replay instructions:

```bash
# Private contract/sdk
mise --no-env --no-hooks run inventory
```

```bash
# Private contract/sdk/effective
mise --no-env --no-hooks run compose
mise --no-env --no-hooks run files
```

```bash
# Private contract/sdk/topology
mise --no-env --no-hooks run collect
```

The original inventory stopped with 54 external package records and 26 missing optional declarations.
The separate effective composition passed with 55 package roots,
including the measured shim,
while retaining every original failure and its disposition.
It verified the retained inventory hash,
reviewed override configuration,
current package metadata,
and exact shim code.

The file walk recorded 11,850 candidate files totaling 119,118,689 bytes,
no package-content symlinks,
and 11 skipped package-internal `node_modules` directories.
These are candidate filesystem entries,
not an admitted package-byte snapshot or hermetic runtime closure.

The separate topology collector recorded 96 declared edges:
68 existing symlink lookups,
2 configured cloud SDK removals,
22 absent non-Linux-x64 esbuild platform packages,
and 4 absent optional peers.
The peers are Anthropic's `zod`,
OpenAI's `ws` and `zod`,
and `proxy-agent-negotiate`'s `kerberos`.
The optional entries were not additional Pi removal overrides.

### Clean observations

- Current resolved targets still matched the retained package identities.
- Previously absent edges remained absent.
- The existing shim was admitted explicitly without broadening access to arbitrary workspace packages.
- The follow-on walk inspected the skipped directories within its fixed entry and byte caps.
- No SDK code,
  external model,
  native addon,
  session,
  or represented operation was executed.

### Rejected assumptions and artifact exclusions

- The nominal inventory failed its external-store-only and required-declaration gates.
- The skipped directories were not interchangeable with the adjacent dependency-link directories.
  They contained generated executable wrappers and local logger artifacts.
  The collector retained names,
  sizes,
  and hashes,
  not raw log contents.
  Neither category should be copied into the SDK probe automatically.
- The candidate shim subtree included a TypeScript build cache and workspace build configuration.
  Staging must select the shim's runtime files,
  declarations,
  documentation,
  and licenses rather than copying the cache or build configuration.
- Staged resolution,
  native/Wasm compatibility,
  and actual import/startup remain unverified.

### Selected artifact bytes

The separate `contract/sdk/artifacts/freeze.mjs` phase completed once in `proc_490f`.
It selected and hashed 11,847 files totaling 119,045,169 bytes
and retained 68 dependency lookup placements.
It excluded the shim's `mise.toml`,
`tsconfig.json`,
and TypeScript build cache;
none of the skipped logger artifacts or executable wrappers was admitted.

The create-new manifest is `contract/sdk/artifacts/manifest.json`,
SHA-256 `d9df0286368eecc8a54f826c80b2524f5eb22344085ed5cd9cdd84d2ec86e1e3`.
This establishes listed artifact-byte identity before staging,
not publisher authenticity,
a copied image,
or actual SDK execution.
A later policy freshness check found a changed `AGENTS.md`;
the [separate policy-epoch intake](../handover/pi-auto-mode-axiom-evaluation.md#policy-freshness-checkpoint)
must precede the SDK probe.
The dependency-byte inventory does not refresh the policy evidence.

## Verified workaround and remaining gates

`contract/sdk/effective/compose.mjs` is the verified metadata-level workaround.
It consumes the original result in a new output namespace,
binds the reviewed configuration and shim,
and gives the original failures explicit dispositions.
Its tradeoff is a deliberately restricted scripted-provider profile,
not general SDK dependency completeness.
No completed constructor or stopped original inventory was replayed.

Before SDK execution,
copy the admitted artifact bytes with hash checks,
preserve measured lookup topology,
verify staged resolution and required-dependency omission controls,
and bind the actual runtime and image identity.
Use a read-only image with declared disposable tmpfs for writable session state,
not host state mounts.
Seal the invocation,
transcript,
provider,
resource,
and lifetime caps before session construction.

## Module-preflight environment admission

The first actual-module preflight `proc_0e8c` stopped at the owned probe's assertion:

```text
Unexpected environment variable names
```

This occurred before SDK import.
A separate names-only diagnostic `proc_bf98` found `HOSTNAME`
besides the explicitly configured probe variables,
`HOME`,
and `PATH`.
No environment values were printed.
The installed tool reported Podman `5.8.7`.

The read-only source checkout is `~/temp/agent/podman-sdk-env-5.8.7`,
commit `c593b672bf3db1173aebea565ebf1a724ea196dc`.
Its default-environment processing clears defaults:

```go
// Podman pkg/specgen/generate/container.go:222
if s.UnsetEnvAll != nil && *s.UnsetEnvAll {
    defaultEnvs = make(map[string]string)
}
```

At line 240 it combines those defaults with explicit environment values.
Later hostname handling checks whether an explicit value already exists:

```go
// Podman libpod/container_internal_linux.go:537
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

The owned assumption that `--unsetenv-all` left only the enumerated explicit names was wrong.
The correction is not to admit arbitrary environment variables.
The new `contract/sdk/module-preflight-hostname` epoch supplies
`--env=HOSTNAME=sdk-preflight`,
requires that exact synthetic value,
and still rejects every other unexpected name.
Its diagnostic names unexpected keys without exposing values.

`proc_4708` passed both fixed cases:

- The intact image verified recorded bytes,
  links,
  package lookup/absence edges,
  and the resource envelope,
  then imported the real SDK barrel and observed the expected exported APIs.
- The preserved throwaway image with only TypeBox's package metadata removed
  failed the same SDK import with `ERR_MODULE_NOT_FOUND` naming TypeBox.
  This control intentionally was not admitted as an intact artifact.

Both cases observed Node `v26.10.0`,
2 GiB memory,
zero extra swap,
2 CPUs,
64 PIDs,
read-only root,
and loopback-only networking.
They used declared disposable tmpfs and a synthetic home.
Stderr was empty and the fetch counter stayed zero.
No `AgentSession` was constructed and no external model call ran.
The original failed epoch and unused original control schedule remain preserved;
the existing omission image was reused rather than rebuilt.
This qualifies the measured module-import boundary,
not actual session lifecycle,
human-input authority,
or every native/API path.

No Podman source or host configuration was modified.
No upstream contribution is proposed for the owned allowlist correction;
no claim about absence of an upstream issue or contribution policy is made.

## Fixture import-condition correction

The first actual-session attempt `proc_5d43` stopped before constructing any session:

```text
Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: No "exports" main defined in .../@earendil-works/pi-ai/package.json
```

Node's stack identifies `require.resolve` at the owned `contract/sdk/session/probe.mjs:41`.
The fixture first imported the SDK barrel successfully,
then incorrectly used a CommonJS resolver to select Pi AI's helper entry:

```javascript
// Private contract/sdk/session/probe.mjs:41
const ai = await import(pathToFileURL(require.resolve('@earendil-works/pi-ai')).href);
```

The staged Pi AI `0.87.1` package metadata declares an import-only root condition:

```jsonc
// Staged @earendil-works/pi-ai/package.json:13, selected root export.
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  }
}
```

This is the owned resolver choosing the wrong public condition,
not missing SDK files or an instruction-view finding.
It does not establish a general inability to use ESM from CommonJS.
The separate `contract/sdk/session-esm` correction follows the already verified dependency edge,
checks the published `exports['.'].import` target,
and imports that file URL.
The original failed epoch remains unchanged.
The case-reference hashes remain identical:
`9acfe7b38a559b9044dceeed88b24c4caf5886d46093d0087f2743de9fa83020`.
No expectation was relabeled to pass.
The corrected phase passed all 4 actual-session cases in `proc_da53`,
with 8 scripted responses,
4 inert tool executions,
empty stderr,
and zero fetch or external model calls.
`proc_a79f` reconciled the saved raw outputs and unchanged references without replay.
Result SHA-256:
`18ae734862240c7c28d7fb235cfce2972f6de015841311fcf0c45762f8a17e98`.
The [SDK observations](pi-instruction-snapshots.md#actual-sdk-session-observations)
record the measured instruction-view differences and remaining authority limits.

## Owned documentation renderer dependency-path drift

The `proc_2b5e` handoff renderer failed under Node `v26.10.0` with `ERR_MODULE_NOT_FOUND`:
its absolute `micromark@4.0.2` import no longer existed.
The failing owned import is retained:

```javascript
// Private contract/sdk/docs/render-confirmation-handoff.mjs:5
import { micromark } from '/var/home/user/Monochromatic/node_modules/.pnpm/micromark@4.0.2_supports-color@10.2.2/node_modules/micromark/index.js';
```

An uncapped `find node_modules -type d -name micromark` found the existing `4.0.3` package.
The installed declarations were read before invoking it.
A separate `render-confirmation-handoff-current.mjs` changed only the consumer's import coordinate
and passed the complete handoff render and heading/key/emphasis assertions through
`mise --no-env --no-hooks run confirmation-handoff-current:render`.
The old failed renderer and diagnostic are preserved.
No installation,
lockfile edit,
production linter patch,
SDK restaging,
or frozen genuine-input change was made.

This is an owned stale import coordinate,
not an established micromark or package-manager defect.
The concurrent lockfile change does not identify the actor or mechanism that removed the old package directory.
The tradeoff is renderer version `4.0.3` for this separate documentation check;
old renders and frozen runtime references are not silently refreshed.
Do not use the obsolete absolute coordinate or claim the new render proves semantic equivalence.
No upstream filing or upstream-fix prototype is justified by this consumer mistake.

## What does not work

Treating every nominal dependency declaration as a mandatory installation
would undo intentional repository selection.
Treating every workspace-resolved package as inadmissible would discard the incumbent shim.
Neither assumption is repaired by installing another provider,
rewriting the lockfile,
or editing upstream source.
Those changes were not attempted.

A package name,
manifest hash,
or successful metadata walk does not prove actual SDK startup,
complete instruction coverage,
or genuine human authority.

## Upstream filing artifact

Nothing is filed or drafted.
The diagnostic came from the owned inventory's admission assumptions,
not an established upstream defect.
The existing dependency decision and audit already cover the configured removals and shim.

### Upstream filing decision

1.  Upstream fault is not established;
    the rejecting controller is owned private preparation code.
2.  The measured remedy belongs in consumer staging,
    not an upstream package modification.
3.  Pi's SDK and custom-provider surfaces are supported;
    this exact staged profile still needs actual execution verification.
4.  The previously inspected pinned `CONTRIBUTING.md` requires understood contributions
    and appropriate human-voice or disclosed AI participation.
    No contribution is proposed here.
5.  No maintainer refusal or willingness is inferred from a local inventory failure.
6.  No upstream patch was prototyped because there is no upstream defect target.
    The tested artifact is a separate owned metadata composition.

No new upstream tracker search was used to claim absence of an issue.
A future upstream filing would require its own scope,
duplicate,
contribution,
and demonstrated-fix checks.

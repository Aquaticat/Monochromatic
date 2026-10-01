# Pi 0.87.1 nominal dependency inventory rejects the configured workspace graph

## Owned fork consumer omitted a persisted system entry

### Symptom and evidence

The separate private fork mechanics controller `proc_90f8` failed after one second.
Node emitted `AssertionError [ERR_ASSERTION]` at the parent acceptance gate:
`Historical fork consumer failed; detailed diagnostics remain private; stop without replay`.
The child exited one without a signal or bounded stop,
with empty stdout and 818 bytes of private stderr.

Fixed-coordinate inspection `proc_5f79` identified the owned assertion at
`contract/lifecycle/fork-mechanical-controls/attachment.mjs:128`.
Strict role metadata reader `proc_2412` failed without exporting its rejected token.
Separately declared enum-only correction `proc_ef03` admitted:
`system/user/assistant/toolResult/assistant`.
The reference expected `user/assistant/toolResult/assistant`.
The consumed runtime reached the completed origin-session reference,
but rejected before actual fork construction.
Its child/reset suffix remains unqualified.

### Source cause and rejected premise

The error was in the owned consumer's four-role expectation,
not demonstrated upstream behavior failure.
The earlier source-only clearance missed the persisted-prefix premise.

Pinned Pi source `packages/coding-agent/src/core/agent-session.ts:1420`
constructs a structured system message when prompt sections change:

```ts
// packages/coding-agent/src/core/agent-session.ts:1420
return sections ? { role: "system", content: "", sections, timestamp: Date.now() } : undefined;
```

The same file at line 934 includes system messages in ordinary persistence:

```ts
// packages/coding-agent/src/core/agent-session.ts:934
event.message.role === "system" ||
event.message.role === "user" ||
event.message.role === "assistant" ||
event.message.role === "toolResult"
```

This source admits persisted system entries;
the private enum receipt establishes the actual fixture's leading role.
Those facts do not establish every section's producer,
configuration binding,
or authority.
Read-only source remains commit `f07218c4d4bbc12bef056a7058c3dd49dfe41abe`.

### Verification and next correction

The consumed command was `mise --no-env --no-hooks run probe`
from the private `contract/lifecycle/fork-mechanical-controls/` directory.
It must not be launched again.
The separate full closure freeze `proc_2cae` passed ten syntax checks,
not runtime correctness.
The completed root sensitivity controls remain a different passing catalog,
not evidence for added fork guards.

At the consumed failure frontier,
no verified fork correction had run.
A separately declared correction must preserve the exact SDK prefix,
ordered call/result/stop,
selected records,
complete branch JSON,
and original immutable evidence linkage.
Accepting a system role cannot admit instruction authority or a human grant.
Any configuration-bound prefix assertion needs its deciding getter/projection source,
not a guessed section schema.
Do not fix the consumed source,
filter away every system message,
or relabel an intact test as guard sensitivity.

### Separate corrected consumer result

The consumed source and runtime remain unchanged.
Separate `contract/lifecycle/fork-system-prefix-controls/` captures an opaque immutable origin prefix
and full branch JSON after completed SDK origin execution,
then validates exact message order with named positions.
Before child publication,
a private helper follows actual persisted parent links and checks selected path/prefix JSON.
Configuration-derived sections equality is not needed for copying consistency;
configuration fidelity and instruction authority remain unqualified.

Pure freeze `proc_ba0c` and eight-case synthetic acceptance/rejection `proc_16e6` passed.
New full digest intake `proc_bd33` and twelve-module freeze `proc_7264` preceded one protected runtime.
`proc_72e8` passed two actual SDK sessions,
four scripted responses,
two inert callbacks,
and one reserved fork:
exit zero,
stdout 1,058 bytes,
empty stderr,
no signal or bounded stop.
Both sessions had their own completed non-error persisted result;
origin reset and independent child reset preserved the described evidence/snapshot boundaries.
No external fetch/models,
fixture action,
or grant write occurred;
current human eligibility remained unestablished.
This fresh pass is not a replay or retroactive pass for `proc_90f8`.

Input rejection controls do not prove guard necessity or omission sensitivity.
Wrong-root/cross-owner capture,
ledger recapture,
and persisted-path rejection branches remain untested.
Full cache/target/source/deadline finalization,
raw-byte/complete-property freshness,
current human grants/directives,
and five-second preparation-inclusive handback remain open.

### Upstream filing decision

- Fault:
   the observed mismatch is the owned transcript expectation;
  no upstream defect is established.
- Fixability:
  intact consumer correction passed separately;
  sensitivity and complete finalization remain open;
  no upstream change is required by this evidence.
- Supported use:
   the inspected SDK persistence path explicitly includes system messages.
- Contribution policy:
   no external contribution is proposed.
- Maintainer disposition:
   not assessed because no defect or contribution is established.
- Prototype:
   no upstream patch is justified;
  the separate consumer epoch passed only its finite intact mechanical reference.

Nothing is filed or drafted upstream.
This incident does not establish current human-grant eligibility,
human-authorized transfer,
complete lifecycle coverage,
or five-second handback.

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

## Separate lifecycle API intake stop and staged diagnostic

### Symptom and established boundary

The new synthetic SDK API intake `proc_256c` stopped at its 15-second child bound.
Its outer Node driver emitted
`AssertionError [ERR_ASSERTION]: SDK API intake failed; synthetic diagnostics retained privately; no replay`.
Retained outcome metadata reports child status null,
`SIGTERM`,
`ETIMEDOUT`-based bounded stop,
and empty private stdout/stderr.
No synthetic fixture-cwd or session-files directory was created.
No actual SDK session-manager instance,
provider,
model,
genuine original,
or GUI interaction was reached.
The failed epoch is preserved without replay.

### Source trace and cause limit

The owned `contract/lifecycle/api-intake/run.mjs:21` launches Node with
`timeout: plan.childDeadlineMs` and private file-backed stdout/stderr.
Its `run.mjs:23` records `child.error?.code === 'ETIMEDOUT'`.
The worker's `probe.mjs:17` verifies every retained dependency file before importing the SDK.
`probe.mjs:25` then awaits the SDK barrel;
`probe.mjs:27` creates the synthetic fixture directory before
`probe.mjs:28` constructs the first `SessionManager`.
These are private qualification-repository paths,
not production changes or upstream patches.

```javascript
// Private contract/lifecycle/api-intake/probe.mjs:25 to 28
const { SessionManager } = await import(pathToFileURL(join(staging, 'repository', manifest.sdkRoot, 'dist/index.js')).href);
const fixtureCwd = join(privateRoot, 'fixture-cwd');
mkdirSync(fixtureCwd, { mode: 0o700 });
const manager = SessionManager.inMemory(fixtureCwd);
```

This places the recorded stop before API construction,
not at a reset,
fork,
or permission decision.
The original worker had no stage markers;
dependency validation versus import versus filesystem setup remains unassigned.
Empty output alone does not identify a cause.

### Verification and non-workaround result

A distinct staged diagnostic `proc_0a95` used the same retained SDK graph and a 60-second bound
within the historical SDK consumer envelope.
It constructed no session manager and did not replay any original lifecycle API check.
It checked 11,847 dependency files,
completed the barrel import and synthetic directory creation,
and exited zero with empty private stderr.
Its observed cumulative dependency/import completion times were
`5299.591325` ms and `5777.045059` ms.
These are this diagnostic's observations,
not a timing comparison or proof of the original stage/cause.

The clean catalog is the separately staged graph/import/setup diagnostic.
The failing catalog is the preserved original bounded stop with no fixture directory.
A larger bound is not established as a fix for that original incident.
No SDK API,
permission lifecycle,
producer coverage,
or five-second handback claim follows from the diagnostic success.
Unopened API checks require a separately declared namespace and their own outcome.

### What does not work

- Replaying the consumed original probe would destroy its once-only history.
- Inferring import failure from absent stdout skips dependency checking and setup.
- Calling the later successful diagnostic a reproduced fix would conflate distinct runs.
- Treating copied session headers or IDs as authority would bypass original-source admission.

### Upstream filing decision

No upstream defect or fileable draft is established.
The existing pinned source clone remains read-only.
The failure is at an owned diagnostic boundary,
not an identified SDK or Node implementation path.
Upstream fault,
a supported failing API use case,
a deciding source cause,
contribution/maintainer acceptance,
a compatible tested fix,
and duplicate-tracker applicability remain unestablished for this incident.
No vendor contact,
account change,
or upstream filing was made.

## Scoped Git source-frontier commit rejection

### Symptom

During the pure prefix source handoff,
`proc_7306` failed with exit code 128 at `git add`.
Its diagnostic was:

```text
fatal: Unable to create '<private repository>/.git/index.lock': File exists.
```

The repository path is redacted;
the original diagnostic remains in retained process logs.
`git --version` subsequently reported Git `2.55.0` with the configured `cli-git` wrapper.
This is separate from earlier renderer receipt lock incidents.
The source smoke `proc_29bd` passed;
a rejected documentation commit is not a failed source test.

### Owned dispatch and cause limit

The assistant dispatched receipt commit `proc_28ae` and frontier commit `proc_7306`
concurrently against the same private repository.
The receipt writer completed successfully.
The rejected command identifies the index-lock path,
not its actual owner or whether it was stale.
No lock owner,
upstream defect,
or source-level Git cause is established.
Future owned writers are serialized rather than treating concurrency as harmless.

### Verification and recovery

Scoped `git status --short` showed the frontier `README.md` modified and the source-check `README.md` untracked.
Scoped `git log` had no commit for the new source-check document.
A subsequent `git rev-parse --verify HEAD` returned `73f68daf332837a08b21b2f35d0a46adb4ab7f88`;
`test ! -e .git/index.lock` passed.
After observing the receipt writer's completion,
`proc_9aca` committed the already existing documents and incident note with explicit scoped paths.
No lock was removed and no source smoke or renderer was replayed.
The failed catalog is `proc_7306`;
the clean catalog is the inspected existing-document recovery `proc_9aca`.
Recovery establishes this scoped retention,
not general Git process-tree or lock-owner guarantees.

### What does not work

Blindly repeating a commit can duplicate an ambiguous success.
Removing an unassigned lock can interfere with another writer.
Rerunning a consumed test or renderer cannot repair a rejected Git operation.
Scoped document retention is not global worktree cleanliness.

### Upstream filing decision

Nothing to add or file:
upstream fault,
a deciding implementation cause,
a supported failing Git use case,
contribution acceptance,
maintainer response,
and a compatible tested upstream patch are unestablished.
No source clone,
account change,
vendor contact,
or upstream mutation is needed for this owned command-serialization correction.

## Owned command-result admission after a root-cwd rejection

### Symptom and source

The persisted source-smoke preflight ran `git diff` from `contract/lifecycle`.
The configured `cli-git` wrapper returned `require-root/not-at-root`,
exit code one,
before Git diff or the chained namespace-absence test ran.
The owned boundary is `package/git-policy/cli/src/rule/require-root.ts:181`:

```typescript
// package/git-policy/cli/src/rule/require-root.ts:181 to 187
if (repoRoot !== effectiveCwd) {
  throw new RequireRootViolationError(
    `cli-git: not at the root of the git repository. `
      + `Repo root is ${repoRoot} but effective cwd is ${effectiveCwd}. `
      + `Tip: cd to ${repoRoot} or pass -C ${repoRoot} before the subcommand.`,
  );
}
```

The orchestration awaited the returned tool object but did not gate on its exit status.
It then falsely described the diff and namespace checks as successful and dispatched the pure source smoke.
This is an owned orchestration failure,
not a broken Git root guard.

### Verification and authoritative correction

The failing catalog is the recorded preflight exit one.
The clean catalog is the subsequent scoped root-cwd `git diff` returning zero.
That later measurement is post-dispatch,
not retroactive evidence that the skipped checks ran.
The pure new-baseline smoke itself passed once as `proc_7dd8`:
all ordered aggregate movements,
four direct domain rejections,
exit zero,
no signal,
stdout 427 bytes,
and stderr zero.
Complete prior body review,
successful predispatch byte hashes,
validated fixed worker projection,
and matching post-run sources support that finite source result.
They do not turn the failed admission procedure into success.
`preflight-git-scope-correction.json` and `result-disposition.json` retain the authoritative scope;
the original false metadata and consumed code remain preserved.

### Prospective correction and rejected approaches

Require each prerequisite command's successful exit status before dependent claims or dispatch.
Tool-response fulfillment is not command success.
For `bash`,
inspect `exit_code` explicitly;
an intended failure needs its own predeclared accepted result.
Use repository-root cwd for scoped Git operations.
Later measurements must retain their actual observation time.
Do not erase false historical metadata,
repeat consumed source tests,
or treat create-new markers as complete historical namespace proof.
The [instruction-tightening proposal](../planning/pi-command-result-admission.md) is unaccepted;
`AGENTS.md` remains untouched.

### Upstream filing decision

Nothing to add or file:
the deciding guard is owned source and rejected the observed non-root cwd.
An upstream failing use case,
upstream root cause,
maintainer/contribution acceptance,
upstream fix necessity,
and compatible upstream prototype are not established.
No clone,
account change,
vendor contact,
or upstream mutation follows from the owned exit-status correction.

## Owned read-only checkpoint rejected native normalization

### Symptom and source

The consumed read-only document checkpoint,
`proc_78cc`,
stopped with Node 26.10.0 exit code 1:

```text
// Owned private contract: contract/sdk/docs/render-combined-source-policy-correction.mjs:22
AssertionError [ERR_ASSERTION]: Read-only checkpoint must not rewrite audit or any documentation
```

Its owned assertion compared the native formatter result with unchanged input:

```javascript
// Owned private contract: contract/sdk/docs/render-combined-source-policy-correction.mjs:22
assert.equal(fixed.source, bytes.toString('utf8'), 'Read-only checkpoint must not rewrite audit or any documentation');
```

The audit HTML was created before the handover comparison failed.
No completed checkpoint receipt existed for that run.
This is a consumer assumption failure,
not evidence of a Node or Sätteri defect.

### Verification and recovery

A separately named renderer,
`render-combined-source-policy-correction-normalized.mjs`,
used the already qualified native-coordinate formatter.
It kept the historical audit read-only,
allowed native formatting of other task documents,
checked source freshness before replacement,
and created new source-path-hashed HTML artifacts.

`proc_95b6` exited successfully with 31 rendered documents and zero native diagnostics.
The retained receipt is
`contract/sdk/docs/combined-source-policy-correction-normalized-result.json`.
It explicitly leaves audit-context compatibility unvalidated.
No genuine witness inputs were read;
`AGENTS.md` and the retiring Markdown linter were unchanged.

### Rejected approaches and upstream filing decision

Do not rerun the consumed renderer,
delete its audit HTML,
weaken the native linter,
or infer a complete pass from its partial artifact.
The new renderer namespace preserves the failed attempt.

No upstream filing:
the failed assertion was owned consumer code.
There is no established upstream defect,
supported upstream change request,
or upstream patch to evaluate.

## Owned fork source-accounting and encoded import boundary

### Symptom and source

Independent draft review found that counters called constructor invocations actually counted owner-delegate entries.
It also found a replacement-string boundary after URL/JSON encoding and a masked extra-system test.
These were owned prototype defects,
corrected before the new source smoke was consumed.
They do not establish an SDK defect or previously executed allocation failure.

In the private qualification repository,
`contract/lifecycle/fork-sensitivity-controls/fork-owner-wrapper.mjs:50` records a boundary request before admission.
Its delegate counter at line 56 records entering the owned factory,
not observing an SDK-internal constructor:

```javascript
// Private contract repository: contract/lifecycle/fork-sensitivity-controls/fork-owner-wrapper.mjs:50 to 57
childRequests += 1;
if (!configured || returnedRoot === undefined) throw new SyntheticForkFixtureError('Declared synthetic origin construction is unavailable');
if (originManager !== returnedRoot) throw new SyntheticForkFixtureError('Declared synthetic fork source is not the returned origin manager');
assertBaselineOwnedManager(originManager);
if (childReserved) throw new SyntheticForkBudgetError();
childReserved = true;
childOwnerDelegateCalls += 1;
const manager = forkBaselineOwnedManager(originManager);
```

The controlled fault follows the owned returned child,
not an SDK-internal allocation-then-throw event.
The recovered child cannot be relabeled as successful ledger publication.
The import fix is at `contract/lifecycle/fork-sensitivity-controls/encoded-owner-import.mjs:7`:

```javascript
// Private contract repository: contract/lifecycle/fork-sensitivity-controls/encoded-owner-import.mjs:7
return source.replace(selector, () => JSON.stringify(pathToFileURL(ownerPath).href));
```

The callback preserves encoded path text as data rather than replacement directives.
The corrected extra-system reference test supplies a valid frozen return and checks capture was never called;
a malformed return can no longer mask that rejection.

### Verification and limits

One separately declared source-only `proc_d55f` passed on the pinned Node v26.10.0 runtime:
exit zero,
stdout 494 bytes,
stderr zero,
and no signal.
Its working catalog includes eight parsed ledger variants,
four dedicated mock wrapper copies,
six fork classifier rows,
two recapture rows,
and thirteen source/JSON import-literal cases.
The unsafe string-replacement positive control differs for a dollar replacement token.
The rejection catalog includes unknown errors,
sink failure,
pair-inappropriate domain errors,
invalid ledger permission metadata,
malformed recapture output,
and extra system entries.

The actual SDK owner is only read/pinned;
all twelve loaded wrapper modules are mock-bound.
Ledger guards were not behaviorally exercised.
The new decoder originals are synthetic,
not a configured-host human witness.
The real body-identity gate compared complete reviewed tool-read sources against dispatch bytes.
Successful root-cwd Git and checked creation boundaries were explicitly admitted before dispatch.
The consumed task was `mise --no-env --no-hooks run check` from `fork-source-check/`;
do not rerun it.
SDK imports,
genuine originals,
models,
grants,
and represented actions are zero.

### Rejected interpretations and next verification

Do not equate delegate entries with constructor or complete internal-allocation counts,
return events with unique identities,
fault recovery with published inheritance,
or source literal round trips with filesystem confinement.
Mock rows and imported ledger variants do not establish actual SDK guard sensitivity.
Helper recovery and documented invalid configuration/delegate/return branches remain unexercised.
The shared actual SDK closure needs a new review,
freeze,
and bounded phase with own callback/result/persistence/stop/idle observations.
The worker old-space,
post-exit stream-size,
and timeout controls do not establish total memory,
live-write caps,
or parent-stall resistance.

### Upstream filing decision

Nothing to add or file.
The deciding counters,
interpolation,
and reference-test isolation are owned code.
An upstream defect,
upstream fix necessity,
supported upstream failing use case,
contribution acceptance,
maintainer response,
and compatible upstream patch are not established.
No external source edit,
account change,
vendor contact,
or upstream mutation follows from this source-only correction.

## Owned Mise 2026.9.12 descriptor contrast assumed non-inheritance

### Symptom

The normal-task negative `proc_fddd` exited one.
Node 26.10.0 emitted `AssertionError [ERR_ASSERTION]` at the owned
`sdk-startup/fd-pair-control/check.mjs:20:8`:

```text
// Private contract: combined-sdk-phase/sdk-startup/fd-pair-control/check.mjs:20
Expected values to be strictly equal:
true !== false
```

Mise also printed `[normal] ERROR task failed`.
The control expected both descriptors not to match their private files merely because the task lacked `raw = true`.
The stdout comparison was true.
The stderr assertion was not reached,
and no accepted negative projection was produced.

### Root cause and source trace

The failed assumption was owned:
absence of `raw = true` does not imply piped output.
The installed `mise --version` reported `2026.9.12 linux-x64 (2026-09-20)`.
The deciding published `v2026.9.12` sources were inspected read-only.

`src/cli/run.rs:1284` obtains the dependency graph's linearity:

```rust
// Mise v2026.9.12, src/cli/run.rs:1284
self.is_linear = tasks.is_linear();
```

`src/task/task_output_handler.rs:554` permits interleaved output for a linear graph without raw mode:

```rust
// Mise v2026.9.12, src/task/task_output_handler.rs:554 to 558
if self.raw(task) || self.jobs() == 1 || self.is_linear {
    TaskOutput::Interleave
} else {
    TaskOutput::Prefix
}
```

`src/task/task_executor.rs:1790` permits inherited descriptors when raw mode is false but redactions are empty:

```rust
// Mise v2026.9.12, src/task/task_executor.rs:1790 to 1797
} else if raw || redactions.is_empty() {
    if !task.silent.suppresses_stdout() {
        cmd = cmd.stdout(Stdio::inherit());
    } else {
        cmd = cmd.stdout(Stdio::null());
    }
    if !task.silent.suppresses_stderr() {
        cmd = cmd.stderr(Stdio::inherit());
```

The one-task control defines no dependencies.
Its measured global `raw` setting was false and `jobs` was eight;
`settings get task.output` returned `Setting [task.output] is not set`.
The failed control is consistent with the source's linear-graph inheritance path,
not evidence that Mise ignored an output guarantee.

### Verification catalog

The consumed raw controls `proc_2662` and `proc_f108` exited zero.
The former checked only stdout.
The latter checked both actual descriptors against their named files and returned
`stdoutBound: true` and `stderrBound: true`.
Both retained Mise command echoes privately.

The normal-task negative `proc_fddd` is the failing catalog.
Its frozen expectation and original output remain unchanged.
It is not replayed or relabeled.
These controls contain no SDK imports,
genuine input reads,
models,
grants,
or represented actions.

The fresh `sdk-startup/fd-identity-control/plan.json` declares a different contrast:
matched destinations first,
then distinct existing decoy destinations,
with independent expected pairs `[true, true]` and `[false, false]`.
The fresh positive `proc_2a24` and negative `proc_1506` each exited zero with their exact expected projection.
That independently declared contrast adds prospective evidence;
it does not repair or relabel `proc_fddd`.

### Verified boundary and tradeoffs

The consumed raw positive establishes descriptor identity for its own invocation.
The prospective caller redirects the entire Mise startup into precreated private files.
The builtin startup gate additionally compares its actual descriptors using
`fstatSync()`,
device,
and inode before importing the controller.

This preserves parsing and loader diagnostics privately.
It does not establish total memory,
live disk-write bounds,
startup timing,
or descriptor identity for an invocation that has not run.
A false decoy comparison alone does not identify the actual destination or prove it is regular.

### What does not work

- Treating `raw = false` as the complement of descriptor inheritance.
- Checking named file modes without comparing inherited descriptor identities.
- Counting an assertion failure as an accepted negative result.
- Replaying a consumed control or replacing its frozen expectation.
- Running the startup gate as a harmless preflight:
  it imports the controller and launches the actual phase.

### Upstream filing decision

Nothing to add or file.

- Upstream fault:
  not established;
  the failed expectation was owned and published source permits the observed behavior.
- Upstream fix:
  unnecessary for this caller-owned admission boundary.
- Supported failing use case:
  no violated output guarantee was established.
- Contribution acceptance:
  not investigated because no upstream change is proposed.
- Maintainer willingness:
  not investigated because no upstream defect is claimed.
- Compatible upstream patch:
  none;
  the separately declared correction belongs in the owned control.

No upstream source edit,
issue,
comment,
or vendor contact follows.

## Owned GNU install 9.10 argument grouping stopped preparation

### Symptom and evidence boundary

The prospective SDK-ID caller created an empty `0700` preparation directory,
then rejected its destination-file command before source-data admission or SDK startup.
The original command's stderr was not retained in the model-visible transcript.
Do not substitute a later control's diagnostic for that historical receipt.

The owned command passed `/dev/null`,
`stdout`,
and `stderr` as operands to one `install` invocation.
Installed GNU coreutils 9.10 documents `SOURCE DEST` and `SOURCE... DIRECTORY` in `install --help`.
That operand grouping is not two destinations.

### Verification and correction

Fresh disposable controls ran independently of the consumed namespace.
Two separate `SOURCE DEST` invocations exited zero and produced distinct empty `0600` regular files.
The failing control supplied an absent final destination:
it exited one with `install: target 'missing-destination': No such file or directory`.

```sh
# Fresh disposable GNU install grammar fixture, not an existing consumed namespace.
fixture=$(mktemp --directory)
install --mode=600 /dev/null "$fixture/stdout"
install --mode=600 /dev/null "$fixture/stderr"
stat --format='%a:%F' -- "$fixture" "$fixture/stdout" "$fixture/stderr"
install --mode=600 /dev/null "$fixture/missing-second-source" "$fixture/missing-destination"
```

Individual destination commands preserve stdout/stderr separation.
Their success is not inherited descriptor identity:
the invoked Node gate must still compare actual descriptors to the named files.
The old directory remains untouched;
only separately named future preparation namespaces may be created.

### Upstream filing decision

Nothing to file or draft.

- Upstream fault:
  none established;
  the caller contradicted documented operand grammar.
- Fixability:
  the fix belongs in the owned caller.
- Supported use case:
  the documented individual source/destination form passed.
- Contribution acceptance:
  not investigated because no upstream change is proposed.
- Maintainer willingness:
  not investigated because no upstream defect is claimed.
- Compatible upstream patch:
  unnecessary;
  no public issue or vendor contact follows.

## Owned empty stdin stopped Node 26.10.0 source-data admission

### Symptom and root cause

Consumed `proc_1e6f` exited one.
Node's `JSON.parse` emitted `SyntaxError: Unexpected end of JSON input` at
`contract/lifecycle/prospective-sdk-id-controls/prepare-reviewed-source-v2.mjs:45:34`
in the private prototype repository.
The caller sent zero stdin bytes and EOF instead of its retained original source record.
No SDK startup or manager construction occurred.

The data helper correctly rejected the missing input.
Changing its parser,
accepting empty input,
or reopening the consumed process would undermine admission rather than fix delivery.

### Verification and corrected boundary

Fresh `proc_53ff` used a separately named v3 helper and namespace.
One orchestration loaded the retained records,
verified their nonempty UTF-8 size,
started the managed process,
and sent all 17,974 bytes plus EOF to that returned process ID.
It exited zero with exact stdout/result projections and a byte-identical `0600` saved record.
Actual private stdout/stderr identity checks ran before record creation.
The original v2 helper,
diagnostics,
and failed namespace remain preserved.

The correction qualifies only this source-data transaction:
zero SDK imports,
zero helper imports,
and no human authority.
It does not qualify arbitrary stdin producers,
general process cleanup,
or an SDK invocation that has not run.

### Upstream filing decision

Nothing to file or draft.

- Upstream fault:
  no;
  the owned caller sent no document.
- Fixability:
  the correction belongs in orchestration.
- Supported use case:
  nonempty JSON passed in the fresh source-data transaction.
- Contribution acceptance:
  not investigated because no upstream change is proposed.
- Maintainer willingness:
  not investigated because no upstream defect is claimed.
- Compatible upstream patch:
  unnecessary;
  the parser's rejection remains required.

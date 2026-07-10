# cli-git policies platform implementation grilling handover

## Status

Shared understanding was confirmed and implementation was authorized on 2026-07-09.
Issues #280 and #341 through #343 are complete and closed.
Engine issue #344 is the next unblocked implementation slice.

The canonical decision is
`docs/decisions/cli-git-policies-platform.md`.
The implementation interface is
`packages/cli/git/SPEC.md`.
This handover remains the current execution-state and evidence record.

Concurrent worktree state:
`.pi/settings.json`,
`.pi/teams/`,
and `mise.lock` are unrelated external work.
Do not edit,
stage,
stash,
restore,
or otherwise disturb them as part of this plan.
Issue #343 legitimately regenerated `pnpm-lock.yaml` from the current workspace state when package dependencies changed.

## Original implementation objective

Turn `packages/cli/git` into a standalone pluggable Git policy platform,
migrate the current cli-git safeguards and hk-managed checks,
then retire hk and Pkl after parity,
performance,
CI,
and cleanup requirements pass.

The wrapper continues to shadow `git` on `PATH` and forwards ordinary Git work to the resolved real Git executable by
absolute path.

## Verified current-state facts

- `packages/cli/git/package.json` exposes only the `git` binary today.
- `packages/cli/git/src/index.ts` runs a sequential `RULES` array and stops when a rule throws.
- Current rule order is:
  - `requireRoot`
  - `linkedWorktreeOnly`
  - `branchWorktreeOnly`
  - `addExplicit`
  - `atomicPush`
  - `commitOnly`
  - `statusHintsOff`
- `branch-worktree-only` is active,
  documented in `packages/cli/git/README.md`,
  and tested,
  but the source decision omitted it from the supposedly complete behavior classification.
- Current Git is 2.54.0 on this host.
  `git help --all` lists none of `policy`,
  `trust`,
  `check`,
  or `fix` as complete Git subcommands.
- Git has a real `git for-each-repo --keep-going` option,
  so cli-git must not consume a generic `--keep-going` token.
- Current Git documentation confirms that explicit-path `git commit` records worktree contents for the named paths and
  ignores staged contents for other paths.
- A disposable Git 2.54.0 fixture verified:
  - two unified patches based on the same blob and touching different lines compose through
    `git apply --cached --3way` against a copied index;
  - an overlapping patch creates unmerged temporary-index stages and exits nonzero;
  - the real index and worktree remain untouched when `GIT_INDEX_FILE` points at the copied index.
- Mise behavior was verified at upstream commit `21091fd55736794c1c8ef33da9f535c30bb20188`:
  - normal `mise trust` trusts one config;
  - `mise trust --all` walks ancestors and descendants;
  - automatic descendant trust occurs only when the trusted root config declares `monorepo_root = true`;
  - the relevant source is `src/cli/trust.rs`,
    `src/config/mod.rs:1903-1908`,
    and `src/config/config_file/mod.rs:378-386` in the disposable clone
    `/tmp/agent/mise-trust-20260709`.
- The repository Oxlint wrapper uses an eight-pass autofix cap in
  `packages/dev-script/task-util/src/oxlint-fix-loop.ts` and detects stable and cyclic states.

## Settled policy inventory revisions

### Existing branch safeguard

`branch-worktree-only` becomes a built-in configurable policy.

- Default severity remains `error`,
  preserving current behavior.
- `warn` is considered safe metadata-wise;
  configuring it does not emit an additional dangerous-warning diagnostic.
- Its per-invocation escape hatch skips the policy for the complete invocation lifecycle,
  including findings,
  fixes,
  post-commit checks,
  and auto-push gating.

Warn-safety metadata follows consequence:

- warn-unsafe:
  `require-root`,
  `add-explicit`,
  `linked-worktree-only`,
  and `forbidden-strings`;
- warn-safe:
  `branch-worktree-only`,
  `forbidden-root-context`,
  and `final-newline`.

An unsafe `warn` remains a valid explicit configuration but emits a configuration warning.

### Unified Oxlint-style policy shape

The earlier mutually exclusive validator,
scanner,
and normalizer policy kinds are rejected.
One policy can combine all three behaviors.

- A policy returns structured findings.
- A finding may be command-level,
  path-located,
  or fixable.
- Fixability is represented by optional patch bytes on a finding.
- Expected violations are findings,
  not thrown exceptions.
- A thrown exception or incomplete policy run is an engine failure and always blocks.
- Option-bearing policies use Valibot schemas directly for runtime validation.
- Invalid config or invalid policy options are engine failures.
- One unified policy context exposes cheap parsed command facts directly and expensive Git-derived inputs through lazy
  async methods.
- Lazy Git queries are memoized only for one candidate-tree version.
  Applying a patch invalidates tree-dependent memoized data before the next policy runs.

The exact TypeScript types remain open.

### Config composition

Cli-git does not merge shared and local config layers.
`defineConfig` receives one final config object and is only a typed identity helper.
A consumer that wants inheritance performs an ordered deep merge in ordinary JavaScript before calling
`defineConfig`,
using `deepmerge-ts` or its own explicit merge logic.
The merge library and its array or collection semantics remain consumer dependencies and visible source code;
they are not cli-git runtime behavior.

### Policy registration and defaults

Plugins use an Oxlint-style consumer-chosen namespace map:

```js
export default defineConfig({
  plugins: {
    mono: forbiddenStringsPlugin,
  },
  policies: {
    'mono/forbidden-strings': 'error',
    'require-root': 'error',
  },
});
```

- Built-in IDs are unprefixed.
- Plugin IDs are `<namespace>/<policy>`.
- Every registered policy,
  built-in or plugin,
  uses its own declared default severity when omitted from `policies`.
- Registering a plugin therefore activates its policy defaults.
- An explicit `off` override disables a policy persistently.

### Execution order and stopping

The earlier phase-gated aggregation model was replaced.

Each policy pass uses this staged order:

1. Built-in configurable safety policies run in fixed core order.
2. Fixed command transformers derive the forwarded command.
3. Plugin policies run in namespace registration order and each plugin's policy declaration order.

Core policies can inspect raw and semantic command facts.
Plugin policies receive both raw and transformed command facts and predict candidate content from the transformed
command.
Fixed transforms must be idempotent because a changed candidate tree restarts the whole pass.

- Policies execute sequentially.
- Severity and option overrides do not reorder policies.
- The engine stops at the first remaining error-severity finding by default.
- Warning findings do not stop execution.
- `--cli-git-keep-going` continues later policies after an error finding,
  but Git still does not run if any error remains.
- `--cli-git-keep-going` never continues after an engine,
  plugin,
  patch,
  or transaction failure.
  Those failures stop immediately with exit code `2`.
- Cli-git does not infer policy independence or parallelize policies.
  A plugin that needs parallel checks composes them inside one policy,
  for example with `Promise.all`.

## Settled distribution and management surface

### Distribution

`@monochromatic-dev/cli-git` becomes npm-ready instead of remaining private.
The prepared artifact is the Node package only;
standalone native executables are out of the first platform release.
Actual npm registry publication is recorded in #358 and deferred indefinitely until a maintainer explicitly resumes
it.
The package installs the shadowing `git` bin and includes the runtime needed for trusted TypeScript config bundling.
The same package exposes side-effect-free public config and plugin API entry points,
including `defineConfig`,
`definePlugin`,
`definePolicy`,
Valibot-backed option helpers,
and public types.
Importing an API entry point must never execute bin startup code.
Third-party plugins peer-depend on the compatible `@monochromatic-dev/cli-git` API version;
there is no separate API or types package.
External non-mise users install the npm package and put its bin directory before real Git on `PATH`.

The initial Node engine range must satisfy the shipped tsdown version;
tsdown 0.22.4 declares `^22.18.0 || >=24.11.0`.
Re-verify that constraint at implementation time.

`publishConfig`,
package contents,
installation documentation,
and end-user PATH verification remain active implementation work.
Registry authentication,
publish-workflow enablement,
and the upload itself belong only to deferred issue #358.

### Management commands

Cli-git intercepts a namespaced Git subcommand rather than installing a second executable:

```text
git cli-git trust
git cli-git check
git cli-git fix
git cli-git untrust
git cli-git status
```

Management commands use Optique.
Direct `check` and `fix` require exactly one scope source:
`--all` or Git pathspecs after `--`.
A repeatable policy filter narrows the otherwise complete enabled policy set.
The exact option names beyond the settled surface remain implementation work.
Management commands do not load repo config before performing trust recovery or inspection.

The real Git executable continues to be invoked by its resolved absolute path for forwarded commands.

## Settled config discovery and build model

### Discovery precedence

- If repo-root `cli-git.config.mjs` exists,
  it wins and is treated as a consumer-built runtime artifact.
- Otherwise,
  repo-root `cli-git.config.ts` is supported as cli-git-built source.
- Keeping both files is valid;
  `.mjs` wins.
- No config means built-in policies only.

### Consumer-built MJS

`cli-git.config.mjs` must be self-contained except for Node built-in imports.
All local and package JavaScript is expected to be bundled into the artifact.
Imports from the cli-git authoring API or plugin packages exist in consumer source only and must be bundled away;
a directly hand-written MJS artifact instead exports raw validated data or inlines its helpers.
The artifact contract is reproducibility guidance,
not a sandbox:
trusted code can use Node APIs to access files,
the network,
processes,
or dynamically loaded code.

### Cli-git-built TypeScript

`git cli-git trust` owns the first TypeScript build.
Ordinary Git commands never build an untrusted TypeScript config.
A previously trusted path explicitly relaxed through `CLI_GIT_NO_PARANOID` is the exception described below.

- Use tsdown with Node platform targeting.
- Call tsdown's public `build()` API with config-file discovery disabled,
  Node ESM output,
  every package forced into the bundle,
  and Rolldown inline dynamic imports.
- Accept exactly one JavaScript output chunk with no unresolved non-Node imports or extra assets.
- A failed or incomplete bundle aborts trust.
- The trusted cache executes an immutable bundle,
  not live source modules.
- Automatic invalidation covers:
  - `cli-git.config.ts`;
  - its statically resolved relative local module graph.
- Lockfiles do not participate in invalidation.
- Bare package imports,
  including repo-local workspace package imports,
  do not participate in invalidation.
- An explicit repeat `git cli-git trust` always rebuilds TypeScript and is the refresh path for excluded package
  imports.
  Changed cached bundle bytes are disclosed before replacement even when tracked source bytes are unchanged.
- Under `CLI_GIT_NO_PARANOID`,
  an MJS mtime/size change triggers private snapshot replacement and validation,
  while a TypeScript entry or tracked-relative-module mtime/size change triggers an automatic tsdown rebuild during the
  next config-loading Git command.
  Those metadata values are cache signals only,
  not trust checks;
  replacement or rebuild failure blocks with exit code `2` and retains the previous record.
- Package-only changes still require explicit trust refresh because package imports are outside tracked invalidation.
- Trust prints a warning when TypeScript source uses bare package imports excluded from automatic invalidation,
  even though their current JavaScript is bundled into the cached artifact.
- Tsdown source was inspected at commit `b89bc3f7bd6615158fb77dfacbe103546a4b722e`,
  package version 0.22.4,
  under `/tmp/agent/tsdown-cli-git-20260709`.
  Its public `build()` returns output bundles;
  `deps.alwaysBundle` can force dependencies;
  config discovery can be disabled;
  and tsdown does not expose an esbuild-style metafile option.
- Exact local-module graph extraction from Rolldown output chunks,
  absolute imports,
  native modules,
  and package assets still require a disposable integration prototype.

## Settled config-loading boundary

- Known read-only and inspection commands do not load repo config.
- Mixed commands such as `branch` and `tag` receive argument-aware classification so read-only forms can skip loading.
- Unknown aliases,
  external subcommands,
  and future Git commands load trusted config by default.
- Classifier ambiguity must take the config-loading path unless later revised.
- An untrusted or changed config blocks a config-loading Git command.
  Cli-git does not proceed with built-ins only.
- The diagnostic directs the user to `git cli-git trust`.
- The previously planned global config-discovery environment kill-switch is deleted;
  it was added in error.

The complete read-only and mixed-command grammar remains open and needs source-backed tests.

## Settled trust model revisions

### Trust consent

Trust uses two stages because recursive-child intent lives inside arbitrary config code and cannot be discovered safely
before authorizing that code.

Before the first consent prompt,
`git cli-git trust` prints every fact available without executing config:

- config path and format;
- filesystem ID;
- exact source-snapshot status and changed path list on re-trust;
- exact cached-bundle snapshot status for TypeScript;
- non-self-contained TypeScript imports or equivalent warning;
- explicit arbitrary-code authority;
- notice that recursive-child intent will be evaluated only after root execution is authorized.

The warning must state that config and bundled plugins run with user permissions and may:

- read and write files;
- run programs;
- access the network;
- automatically modify Git content;
- behave incorrectly despite cli-git's transaction safeguards.

Local use then asks `Trust this config? [y/N]`.
The root approval stays in-memory until config execution and validation succeed;
a thrown or invalid config leaves no persistent trust record.

After successful authorized execution:

- no child-trust declaration completes root trust with no second prompt;
- a child-trust declaration prints the exact recursive root and descendant authority,
  then asks for separate consent before recording the recursive marker.

`git cli-git trust --yes` prints both disclosures when applicable and skips both input reads for explicit CI use.

### Untrusted and changed artifacts

- Default posture uses exact stored byte snapshots,
  not cryptographic content hashes.
- Consumer-built MJS stores and compares the complete artifact bytes.
  After an exact match,
  cli-git executes the stored snapshot copy rather than the live entry file,
  closing the entry-file compare-then-swap window.
  Trusted code still has ambient Node authority and may deliberately load other live files.
- Cli-git-built TypeScript compares tracked live source bytes to stored source snapshots during ordinary strict
  execution and executes the stored cached bundle without rebuilding.
  Explicit trust and relaxed rebuild compare candidate bundle bytes to the stored bundle before replacement.
- Recursively auto-enrolled child configs also execute their stored snapshot or cached bundle,
  never a live file that was merely compared.
- First execution blocks until explicit trust.
- A later covered source or artifact byte change blocks until re-trust.
- Trust and plugin failures are exit code `2`.

### Registry

- Trust records are per-user and stored as one record directory per trust key,
  containing validated metadata and exact snapshot files.
- Production registry location derives from the OS account home,
  not `HOME`,
  XDG,
  AppData,
  or a dedicated environment override.
- Tests inject a registry location through internal APIs.
- Per-key files must use atomic replacement and safe permissions.
- Exact platform paths,
  record schema,
  canonicalization,
  symlink handling,
  and crash recovery remain open.

The underlying trust identity remains the pair of filesystem ID and canonical artifact path.
Cli-git does not hash that key or trusted content;
registry path mapping and exact byte comparisons must preserve the complete identity.
`@monochromatic-dev/module-fs-id` remains a prerequisite.

### No-paranoid relaxation syntax

`CLI_GIT_NO_PARANOID` is a comma-separated list of `<filesystem-id>:<path>` entries.
Percent escaping protects comma and percent characters.
Entries split on the first decoded colon because filesystem IDs are colon-free and Windows paths may contain later
colons.

Malformed or suspicious entries emit a prominent warning,
are ignored,
and leave the affected path under strict snapshot behavior.
They do not waive first trust.
Exact canonical encoding and decoder-error behavior still need tests.

### Recursive root trust

Recursive trust is declared as `trust: { children: true }`,
matching mise's config-declared monorepo-root model rather than making every trust command recursive.

- A root declaration triggers the second trust-consent stage after root config execution and validation.
- The second disclosure warns before consent that descendant authority will be recorded and names the exact root.
- The root declaration waives separate first approval for descendant configs only after that second consent.
- Recursive path authority intentionally crosses filesystem and mount boundaries without another prompt.
  The disclosure states that descendants on current or future mounted volumes inherit authority and that mount swaps can
  introduce newly authorized child configs.
- Descendant filesystem IDs are still recorded for exact identity and revocation provenance,
  but a new child filesystem does not require separate consent.
- First descendant encounter auto-enrolls exact snapshots of that descendant's covered files.
- Later descendant byte changes block for re-trust.
- Trust records track provenance.
- Untrusting a recursive root revokes descendant records inherited from that root.
- Untrusting a nested recursive root also revokes every outer recursive root that currently authorizes that nested path.
  This intentionally removes inherited authority from sibling subtrees too and avoids persistent deny-boundary state.
- Before revocation,
  `git cli-git untrust` lists every affected recursive root.
- Descendants explicitly trusted separately remain trusted.

The config property name remains open.

### CI

External consumers use an explicit CI step:

```text
git cli-git trust --yes
```

There is no detected-CI auto-trust path and no separate expected-snapshot environment bypass.

## Settled finding and process contract

- Policy findings use stable JSONL only.
- Autofix passes buffer findings internally and emit only the final stable pass to the public JSONL stream.
  Intermediate findings are provisional and never appear as authoritative output.
- There is no separate prose,
  JSON-array,
  or SARIF policy formatter.
- Every finding includes a human-readable `message` field.
- Wrapper-mode findings go to stderr so real Git stdout remains intact.
- Direct `git cli-git check` and `fix` findings go to stdout.
- Exit meanings when real Git was not run:
  - `0`:
     success or warning findings only;
  - `1`:
     one or more error-severity findings;
  - `2`:
     trust,
    config,
    plugin,
    transaction,
    or engine failure.
- A forwarded real Git command normally preserves real Git's exit code.
- Exception:
  a post-commit policy or engine failure after Git created the commit returns exit code `2`,
  blocks auto-push,
  and does not roll back the commit.
  Its JSONL event must state that the commit landed and include the new commit OID so callers do not retry blindly.

The JSONL schema and schema-version field remain open.

## Settled normalizer and patch model

### Patch ownership

- A fixable finding returns unified Git patch bytes for exactly its located path and against the candidate bytes the
  context supplied.
- A composed policy returns multiple findings for multiple paths rather than one cross-path patch.
- The plugin does not choose or write a patch path.
- Cli-git writes patch bytes into a private temporary `.patch` file,
  applies it,
  and removes it.
- Git diff and three-way merge semantics compose patches.
- Patch conflicts remain in temporary state only and block the command.
- Patch path traversal,
  renames,
  mode changes,
  submodules,
  unexpected paths,
  and binary behavior need an explicit allowlist and tests.

### Automatic fixing

- Matching pre-forward commit normalizers always auto-fix.
- Trust disclosure is the consent boundary for that mutation authority.
- Push and direct check remain read-only.
- `git cli-git fix` is the explicit direct worktree-fix surface.
- Direct `check` and `fix` require explicit paths or `--all`.
- Direct fix leaves the real index unchanged.

### Unsupported commit modes

For `git commit --patch`,
`--interactive`,
`--include`,
or another mode not yet reproduced transactionally:

- run the applicable policy in check mode;
- proceed if no fix is required;
- block with direct-fix guidance if a fix is required;
- never skip the policy silently.

### Multipass convergence

- Within one pass,
  policies run in settled order and later policies see patches applied by earlier policies.
- An error finding whose patch applies cleanly is provisional:
  it does not block that pass,
  and a later global pass must prove the finding disappeared.
- If any policy changes the candidate tree,
  every finding from that pass is provisional and the next pass restarts from the first core policy.
- Without keep-going,
  an unpatched error stops the current pass before later policies run.
- With keep-going,
  later patches may change the candidate and cause a restart;
  only findings from the final unchanged pass can block or emit.
- Use an eight-pass cap for the complete policy sequence,
  matching the repository Oxlint wrapper.
- Store each pass candidate in private temporary storage and compare complete file bytes instead of hashing them.
- Detect stability by exact ordered path-and-byte equality with the preceding state.
- Detect cross-policy cycles by streaming exact comparisons against non-adjacent candidate states retained only for the
  eight-pass run;
  do not retain duplicate complete snapshots in process memory.
- A stable candidate with remaining error findings is exit code `1`.
- A cycle or cap reached while still changing is exit code `2`.

### Working commit transaction design

This design was independently reviewed but still needs a complete disposable-repository prototype before it becomes an
implementation commitment.

- Never let plugins mutate the real index or worktree through the normalizer API.
- Hold the real index lock for the transaction.
- Journal the gap between Git's ref update and cli-git's real-index replacement.
- For index commits such as explicit `--no-only`:
  - copy the real index;
  - apply normalizer patches through `GIT_INDEX_FILE`;
  - invoke real Git against the temporary index;
  - atomically install the resulting index after commit success.
- For normal explicit-path commits with injected `--only`:
  - build a commit index from `HEAD` plus selected worktree paths;
  - apply normalizer patches there;
  - internally remove `--only` and pathspecs because the temporary index now represents the intended tree;
  - build a post-commit index from the original real index plus selected paths from the new commit;
  - atomically install that post-commit index after success.
- For merge,
  cherry-pick,
  and revert conclusions:
  - use index-commit semantics only;
  - do not emulate partial explicit-path conclusions.
- On patch conflict or commit failure:
  - discard temporary indexes and patches;
  - leave the real index and worktree unchanged by cli-git.
- No Git primitive atomically updates both the commit ref and a separate real index.
  The implementation therefore needs a durable journal and recovery on the next cli-git invocation.

Required prototype coverage includes partial staging,
unrelated staged paths,
unstaged tails,
deletions,
untracked selected paths,
pathspec files,
amend,
allow-empty,
sequencer conclusions,
hook failure,
commit failure,
patch conflict,
process interruption,
and recovery after the ref moved but before index replacement.

## Existing source-decision choices not yet reopened

Unless later grilling changes them:

- Fixed core transformers remain:
  - atomic push;
  - commit-only;
  - status hints off.
- Post-commit auto-push remains a fixed core side effect.
- Built-in configurable safety policies include:
  - require-root;
  - add-explicit;
  - linked-worktree-only;
  - branch-worktree-only,
    added during grilling.
- Repo/plugin policies include:
  - forbidden-root-context;
  - forbidden-strings;
  - final-newline.
- Forbidden-strings scans predicted commit content before forwarding,
  committed ground truth before auto-push,
  and manual push ranges.
- The source decision's derived fail-open rule for an indeterminate content-bearing manual push range is superseded.
  An enabled scanner that cannot determine required content has not completed its policy run,
  so it blocks with engine exit code `2`.
- A pure ref deletion carries no content and does not fail merely for lacking a content range.
- CI remains authoritative and independent of the wrapper.
- Final-newline exclusions and exact-byte semantics remain those in the source decision.
- Platform-first sequencing remains in force.
- hk and Pkl retirement remains the capstone after parity,
  performance,
  docs,
  CI,
  and per-machine cleanup requirements pass.

## Implementation checkpoints

### Issue #280 validated Git roots

- Reproduced fs-path and cli-git disagreement with Git through deterministic empty-directory,
  malformed-gitfile,
  and unusable-target fixtures before applying the fix.
- Added shared Git administrative validation for regular and symbolic HEAD,
  SHA-1 and SHA-256 detached IDs,
  objects,
  refs,
  relative gitfile targets,
  linked-worktree `commondir`,
  regular-file checks,
  and NUL rejection.
- Invalid nearer `.git` entries are skipped so a valid outer root remains discoverable.
- Added typed `GitRepositoryRootNotFoundError` and made cli-git consume the shared finder instead of independent
  `find-up` existence checks.
- Fs-path build,
  full tests,
  type lint,
  and zero-warning Oxlint pass.
  Cli-git build,
  all unit and integration tests,
  type lint,
  and zero-warning Oxlint pass.
- A disposable built-wrapper fixture verified native Git 2.54.0 handling for an invalid ancestor and cli-git handling
  for real normal,
  linked-worktree,
  linked subdirectory,
  and submodule roots.
- Commits `cdf023791`,
  `3c848a747`,
  `1499ed61e`,
  and `8609616c8` contain implementation,
  adversarial coverage,
  symbolic HEAD parity,
  and source-backed troubleshooting evidence.
- Independent final review reported no required corrections.

### Issue #343 package and authoring API

- Split executable startup into `src/bin.ts` and made the package-root `src/index.ts` a side-effect-free authoring API.
- Added identity-preserving `defineConfig`,
  `definePlugin`,
  `definePolicy`,
  and `definePolicyOptions` helpers plus policy,
  finding,
  patch,
  config,
  trigger,
  and lazy-context contracts.
- Added exported `ABSENT_GIT_VALUE` unique symbol for domain absence without nullable unions.
- Prepared public package metadata with Node `^22.18.0 || >=24.11.0`,
  built declarations,
  licenses,
  side-effect metadata,
  shadow `git` bin,
  tsdown runtime,
  TypeScript 7,
  Valibot,
  and Optique.
- `pack:npm` works around pnpm issue #9566 with a command-local forced non-deduplicated install before `pnpm pack`.
- The tarball has exactly eight expected files,
  no `workspace:` or `catalog:` specs,
  and no repository-only or sensitive content.
- A disposable npm consumer imported the API without filesystem changes,
  compiled valid config,
  rejected unknown IDs and wrong options,
  emitted and ran a self-contained tsdown config bundle,
  resolved the packaged bin first on `PATH`,
  and forwarded real Git 2.54.0.
- Build,
  type lint,
  zero-warning Oxlint,
  all package unit tests,
  README lint,
  final standalone install,
  and independent review pass.
- Commits `ae4c09853` and `58f1d7754` contain the implementation and contract evidence.
  Commits `9ced4d01e`,
  `e36b89d73`,
  and `0108b0db2` preserve the tested but ineffective Valibot allow-list path and its removal.
- Registry publication and workflow enablement were not performed;
  deferred issue #358 remains untouched.

### Issue #342 filesystem identity

- Added `@monochromatic-dev/module-fs-id` with source-qualified colon-free IDs,
  stable and warned degraded results,
  adapter fixtures,
  fresh per-call volume observation,
  and a narrow package-root interface.
- Linux uses `findmnt` UUID with GNU `stat` `f_fsid` fallback.
- macOS maps arbitrary paths through `df -P`,
  parses structured `diskutil` plist Volume UUID,
  and falls back to BSD `stat` device identity.
- Windows reads locale-invariant CIM volume serial and accepts only a nonzero Node-stat device fallback.
- Build,
  type lint,
  Oxlint with zero warnings,
  unit tests,
  README lint,
  and a disposable built consumer call pass.
- Workflow run [29064685354](https://github.com/Aquaticat/Monochromatic/actions/runs/29064685354) passed preferred and
  degraded evidence on Linux,
  macOS,
  and Windows.
- A physical macOS 26.5.2 host at `ssh m1` independently passed the same script;
  its tiny disposable directory was removed after verification.
- Commits `5b5b6b098`,
  `b7636ce69`,
  `9641fb381`,
  `b058283d2`,
  and `91db0a466` contain the package,
  fixes,
  tests,
  host evidence,
  and required troubleshooting record.
- Independent final review reported no required corrections.

### Issue #341 contract

- Reconciled `docs/decisions/cli-git-policies-platform.md` with every settled grilling revision.
- Added canonical implementation interface `packages/cli/git/SPEC.md`.
- A disposable TypeScript 7.0.1-rc consumer compiled both authoring examples and proved statically known unknown policy IDs
  and wrong option values are rejected.
- An Optique 1.1.1 fixture parsed every documented management form and rejected missing,
  conflicting,
  empty,
  and misplaced scope forms.
- Repository Markdown lint passes for the decision,
  spec,
  and handover.
- Commits `0a22e16e3` and `32c938a8b` contain the contract and final strict-TypeScript correction.
- Independent final review reported no required corrections and #341 was closed.

## GitHub implementation tracker

The confirmed plan is recorded as dependency-linked GitHub issues.
Dependency-ordered implementation slices:

- [#341](https://github.com/Aquaticat/Monochromatic/issues/341),
   completed:
  finalized the canonical decision and implementation contract.
- [#342](https://github.com/Aquaticat/Monochromatic/issues/342),
   completed:
  built and verified the cross-platform filesystem-ID prerequisite.
- [#343](https://github.com/Aquaticat/Monochromatic/issues/343),
  completed:
  prepared and externally verified the npm tarball boundary and side-effect-free public API without publishing.
- [#344](https://github.com/Aquaticat/Monochromatic/issues/344):
  run a built-in policy through the packaged JSONL engine;
  former Git-root blocker #280 is complete.
- [#345](https://github.com/Aquaticat/Monochromatic/issues/345):
  trust and execute one stored MJS plugin snapshot.
- [#346](https://github.com/Aquaticat/Monochromatic/issues/346):
  add recursive snapshot trust and cascading revocation.
- [#347](https://github.com/Aquaticat/Monochromatic/issues/347):
  build and cache trusted TypeScript config.
- [#348](https://github.com/Aquaticat/Monochromatic/issues/348):
  migrate configurable command safeguards.
- [#349](https://github.com/Aquaticat/Monochromatic/issues/349):
  stage fixed command transforms.
- [#350](https://github.com/Aquaticat/Monochromatic/issues/350):
  gate post-commit auto-push through policy lifecycle.
- [#351](https://github.com/Aquaticat/Monochromatic/issues/351):
  deliver the first real private-index autofix transaction.
- [#352](https://github.com/Aquaticat/Monochromatic/issues/352):
  harden commit modes and interrupted-index recovery.
- [#353](https://github.com/Aquaticat/Monochromatic/issues/353):
  migrate forbidden-root-context as the first repo plugin.
- [#354](https://github.com/Aquaticat/Monochromatic/issues/354):
  migrate forbidden-strings across commit and push lifecycle.
- [#355](https://github.com/Aquaticat/Monochromatic/issues/355):
  migrate transactional final-newline normalization and direct check/fix.
- [#356](https://github.com/Aquaticat/Monochromatic/issues/356):
  close CI,
  platform,
  performance,
  documentation,
  and npm-pack readiness gaps without publishing.
- [#357](https://github.com/Aquaticat/Monochromatic/issues/357):
  retire hk and Pkl after every capstone gate passes.

Deferred issue:

- [#358](https://github.com/Aquaticat/Monochromatic/issues/358):
  actually publish the npm package and verify the registry artifact.
  It is recorded now,
  labeled not-ready,
  blocked by #356,
  and deferred indefinitely pending an explicit maintainer resume decision.

Existing #139 remains relevant to packaged CLI shebang behavior.
Existing #143 and #160 now have tracker comments,
no longer carry `ready-for-agent`,
and remain open under `needs-triage` for explicit final disposition in #357 rather than contradictory hk expansion.

## Implementation sequence

This is platform-first and checkpointed.
Each phase receives scoped commits as soon as changes exist;
a later phase does not wait to record an earlier phase's work.

### Reconcile the decision and write the implementation contract

- Update `docs/decisions/cli-git-policies-platform.md` from this handover:
  unified policies,
  exact snapshots,
  two-stage recursive trust,
  npm distribution,
  fixed-transform ordering,
  global autofix passes,
  and post-commit exits.
- Write the implementation spec deferred by that decision.
- Freeze public TypeScript API shapes,
  JSONL event schema,
  management grammar,
  trust-record schema,
  and benchmark methods before production implementation depends on them.
- Verify examples by compiling and invoking the smallest consumer fixture.

### Build the filesystem-ID prerequisite

- Implement `@monochromatic-dev/module-fs-id` from its completed contract now documented in
  `packages/module/fs-id/README.md`.
- Keep OS command execution behind injected adapters so Linux,
  macOS,
  and Windows branches have fixture coverage.
- Verify real command output on all three operating systems through CI or real hosts before trusting parser claims.
- Guarantee a registry-path-safe ID representation and exact stable/degraded metadata.
- Finish the package only after README,
  lint,
  type checks,
  unit tests,
  and a consuming import call pass.

### Reshape the npm-ready cli-git package boundary

- Separate side-effectful bin startup from side-effect-free public API modules.
- Export `defineConfig`,
  `definePlugin`,
  `definePolicy`,
  Valibot-backed helpers,
  and public types from `@monochromatic-dev/cli-git`.
- Make the package manifest npm-ready,
  add publication metadata without enabling registry upload,
  and include only required build artifacts,
  source declarations,
  README,
  and licenses.
- Bundle private workspace helpers such as fs-id and logger into the public Node artifact rather than publishing them as
  unresolved private runtime dependencies.
- Verify `npm pack`,
  install the tarball in a disposable non-workspace project,
  import the API,
  place the bin first on `PATH`,
  and run both wrapper and management commands.
- Do not enable publish workflow or upload the package;
  those actions belong only to indefinitely deferred issue #358.

### Implement the core policy engine and migrate current safeguards

- Add immutable parsed-command facts and lazy memoized Git context methods.
- Add Valibot config and option validation.
- Add unified findings with optional single-path patch bytes.
- Add default severity,
  warn-safety,
  namespace registration,
  core/plugin ordering,
  lifecycle escape hatches,
  and `--cli-git-keep-going`.
- Add final-pass-only JSONL and settled exit-code behavior.
- Split fixed transformers from configurable policies and make transforms idempotent.
- Migrate `require-root`,
  `linked-worktree-only`,
  `branch-worktree-only`,
  and `add-explicit` with behavior-parity fixtures before deleting their old rule functions.
- Keep atomic-push,
  commit-only,
  status-hints-off,
  and auto-push fixed while moving them into the staged pipeline.

### Implement config discovery and trust

- Build the read-only and mixed-command classifier from current Git documentation and parser fixtures.
- Implement account-derived registry paths,
  per-key snapshot directories,
  atomic writes,
  permissions,
  canonicalization,
  and symlink defenses.
- Implement MJS self-contained validation,
  exact snapshot copies,
  and execution from stored bytes.
- Prototype tsdown programmatic output,
  local graph extraction,
  one-chunk enforcement,
  assets/native failures,
  and immutable cache loading before landing the TypeScript path.
- Implement strict snapshot comparison,
  relaxed metadata-triggered rebuilds,
  comma/percent `CLI_GIT_NO_PARANOID` parsing,
  malformed-entry warnings,
  and no global discovery bypass.
- Implement two-stage recursive trust,
  cross-filesystem inheritance,
  child auto-enrollment,
  provenance,
  nested outer-root revocation,
  and explicit CI trust.
- Exercise races and interrupted writes with concurrent disposable processes.

### Prototype and implement transactional autofix

- Before editing production transaction code,
  build a disposable Git prototype for copied indexes,
  explicit-path commit indexes,
  post-commit index reconciliation,
  exact worktree preservation,
  and crash journals.
- Prove ordinary index commits,
  injected-only commits,
  amend,
  allow-empty,
  merge/cherry-pick/revert conclusions,
  deletions,
  untracked selected paths,
  partial staging,
  unrelated staging,
  hook failure,
  patch conflict,
  and process interruption.
- Apply engine-owned patch files with `git apply --cached --3way` against private indexes.
- Implement eight whole-sequence passes with exact byte comparison,
  cycle detection,
  provisional changed-pass findings,
  and engine-stop semantics.
- Install a real index only after successful commit and journal recovery checks.
- Leave unsupported interactive modes read-only and block only when a fix is required.

### Add repo policies in migration order

- Add `forbidden-root-context` first to prove a plugin validator/finding shape.
- Add `forbidden-strings` next to prove candidate content,
  committed ground truth,
  manual push ranges,
  external binary failures,
  and post-commit auto-push gating.
- Add `final-newline` last to prove patch fixes,
  global convergence,
  exact exclusions,
  direct check/fix,
  and partial-staging safety.
- Preserve every source-decision exclusion and old hk trigger path in named parity fixtures.

### Complete lifecycle, CI, performance, and package-readiness verification

- Implement direct `check`,
  `fix`,
  trust,
  untrust,
  and status user-boundary tests through the built shim.
- Add independent final-newline CI before hk removal;
  keep forbidden-strings CI independent of the wrapper.
- Measure no-config,
  read-only,
  strict MJS,
  strict cached TypeScript,
  relaxed TypeScript rebuild,
  validator,
  scanner,
  normalizer,
  and post-commit paths.
- Set budgets from measured baselines in the implementation spec and fail repeatable benchmark fixtures when they regress.
- Run package lint,
  type checks,
  tests,
  npm tarball install,
  and cross-platform trust verification.
- Obtain independent standards and specification review before retirement.
- Stop at verified npm tarball readiness;
  actual registry publication remains outside the active sequence in #358.

### Retire hk and Pkl as the capstone

- Confirm all parity,
  performance,
  CI,
  trust,
  documentation,
  and public-package gates are green.
- Remove hk and Pkl config/tool references,
  stale IDE config,
  and obsolete documentation named by the source decision.
- Provide and verify idempotent per-machine hk Git-config cleanup.
- Verify the end-user `git` shim,
  direct policy commands,
  CI checks,
  and clean npm install after removal.

## Implementation risks and evidence gaps

`packages/cli/git/SPEC.md` freezes the public declarations,
JSONL schema,
management grammar,
trust record,
relaxed-mode parser,
lifecycle,
and benchmark method.
Implementation must now close these evidence gaps without making new product decisions:

- Complete source-backed read-only and mixed Git command classifier.
- Complete temporary-index transaction prototype and crash journal.
- `@monochromatic-dev/module-fs-id` implementation and real macOS/Windows verification.
- Tsdown integration,
  source-graph extraction,
  cache layout,
  immutable artifact loading,
  and self-contained import validation.
- Measured performance budgets and benchmark fixtures.
- Exact forbidden-strings push-range computation and failed-range JSONL diagnostic.
- Migration parity matrix for every hk trigger and final-newline exclusion.
- Independent final-newline CI command after migration.

## Required verification before implementation completion

- Unit tests for every policy metadata,
  severity,
  ordering,
  default,
  escape-hatch,
  JSONL,
  and error branch.
- Disposable Git integration fixtures for allowed and rejected commands.
- Exact-byte partial-staging and worktree-preservation tests.
- Trust tests for first use,
  changed content,
  recursive inheritance,
  revocation provenance,
  mount swaps,
  malformed environment entries,
  registry races,
  and journal recovery.
- Real macOS,
  Linux,
  and Windows filesystem-ID verification.
- End-user invocation through the built `git` shim,
  not direct module calls only.
- Direct `git cli-git trust`,
  `check`,
  `fix`,
  `untrust`,
  and status invocations.
- Performance gates measured on no-config,
  trusted MJS,
  trusted cached TypeScript,
  validator-only,
  scanner,
  and normalizer paths.
- Package README,
  zero-warning lint,
  type checks,
  and tests covering every exported path.
- Independent review against both repository standards and the final implementation spec.

## Keep updated

Update this file immediately after each settled decision,
important source finding,
prototype result,
implementation checkpoint,
verification result,
and commit.

Issue #341 completed its contract gates.
Continue recording each runtime implementation checkpoint,
verification result,
commit,
and issue closure here.

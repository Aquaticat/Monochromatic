# cli-git policies platform implementation grilling handover

## Status

Implementation planning is in an active one-question-at-a-time grilling session.
No platform code has been implemented.
Do not start implementation until the user confirms shared understanding.

The source decision is
`docs/decisions/cli-git-policies-platform.md`.
Several choices in that decision have been revised during grilling;
this handover is the current source for those revisions until the decision and implementation spec are updated.

The user requested that this handover be kept current as grilling continues.

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
- It keeps its per-invocation escape hatch unless a later question revises escape-hatch details.

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

`@monochromatic-dev/cli-git` becomes a public npm package instead of remaining private.
The first distributable is the Node package only;
standalone native executables are out of the first platform release.
The package installs the shadowing `git` bin and includes the runtime needed for trusted TypeScript config bundling.
External non-mise users install the npm package and put its bin directory before real Git on `PATH`.

Node support range,
`publishConfig`,
provenance workflow,
package contents,
installation documentation,
and end-user PATH verification remain implementation work.

### Management commands

Cli-git intercepts a namespaced Git subcommand rather than installing a second executable:

```text
git cli-git trust
git cli-git check
git cli-git fix
git cli-git untrust
git cli-git status
```

The exact complete subcommand list and Optique grammar remain open.
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
The artifact contract is reproducibility guidance,
not a sandbox:
trusted code can use Node APIs to access files,
the network,
processes,
or dynamically loaded code.

### Cli-git-built TypeScript

`git cli-git trust` owns the TypeScript build.
Ordinary Git commands never build an untrusted TypeScript config.

- Use tsdown with Node platform targeting.
- Attempt to bundle every import into a self-contained cached artifact.
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
- Trust prints a warning when TypeScript config is not self-contained.
- Exact treatment of absolute imports,
  dynamic imports,
  package assets,
  native modules,
  and tsdown metadata remains open.

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
- Cli-git-built TypeScript stores and compares every tracked entry or relative-local-module file plus the cached bundle
  bytes.
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

Malformed or suspicious entries remain subject to the warning behavior in the source decision.
Exact canonical encoding and decoder-error behavior still need tests.

### Recursive root trust

Recursive trust is config-declared,
matching mise's monorepo-root model rather than making every trust command recursive.

- A root declaration triggers the second trust-consent stage after root config execution and validation.
- The second disclosure warns before consent that descendant authority will be recorded and names the exact root.
- The root declaration waives separate first approval for descendant configs only after that second consent.
- First descendant encounter auto-enrolls exact snapshots of that descendant's covered files.
- Later descendant byte changes block for re-trust.
- Trust records track provenance.
- Untrusting a recursive root revokes only descendant records inherited from that root.
- Descendants explicitly trusted separately remain trusted.

The config property name and behavior for nested recursive roots remain open.

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
  - `0`: success or warning findings only;
  - `1`: one or more error-severity findings;
  - `2`: trust,
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

- A fixable finding returns unified Git patch bytes.
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
  the next pass restarts from the first core policy.
- Use an eight-pass cap for the complete policy sequence,
  matching the repository Oxlint wrapper.
- Compare complete candidate file bytes after each pass instead of hashing them.
- Detect stability by exact ordered path-and-byte equality with the preceding state.
- Detect cross-policy cycles by exact equality with any non-adjacent candidate state retained within the eight-pass
  run.
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

## Open design questions

Continue grilling one question at a time,
but do not burn a question on a recommendation already determined by settled user choices.
Adopt and record those implications directly.
Ask only when at least two viable paths remain and the choice depends on user preference or authority.
Do not ask the user for facts that source or disposable fixtures can establish.

Major unresolved branches:

- Exact policy,
  plugin,
  finding,
  patch,
  lazy context-method,
  trigger,
  and config TypeScript APIs.
- Exact default severities and warn-safety metadata for every built-in and migrated policy.
- Exact escape-hatch interaction with unified policies and automatic fixes.
- Whether `--cli-git-keep-going` continues after engine failures or only after finding failures.
- Exact JSONL schema,
  schema versioning,
  ordering,
  and patch-result events.
- Exact direct `check` and `fix` grammar,
  policy filters,
  pathspec semantics,
  and no-stage verification.
- Complete read-only and mixed Git command classifier.
- Complete temporary-index transaction prototype and crash journal.
- Exact global-pass behavior when an early policy has an unfixable finding and later policies would auto-fix the tree.
- Trust record schema,
  account-derived platform paths,
  permissions,
  canonical paths,
  symlinks,
  and nested recursive roots.
- `CLI_GIT_NO_PARANOID` encoder and parser edge cases.
- `@monochromatic-dev/module-fs-id` implementation choices and real macOS/Windows verification.
- Tsdown API integration,
  source-graph extraction,
  cache layout,
  immutable artifact loading,
  and self-contained import validation.
- Config-declared recursive trust property name and nested-root precedence.
- Performance budgets and benchmark fixtures.
- Exact forbidden-strings push-range computation and failed-range JSONL diagnostic.
- Migration parity matrix for every hk trigger and final-newline exclusion.
- Independent final-newline CI command after migration.
- Implementation issue slicing and commit sequence.

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

When grilling ends:

1. Reconcile this handover into `docs/decisions/cli-git-policies-platform.md`.
2. Write the implementation spec named by that decision.
3. Keep this handover as the execution-state record.
4. Do not begin platform implementation until the user explicitly confirms shared understanding.

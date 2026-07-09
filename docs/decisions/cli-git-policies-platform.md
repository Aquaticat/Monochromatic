# cli-git pluggable git policies platform

## Status

Decided in design,
 not yet built.
This session refined the decision through grilling and a round of external review,
which surfaced gaps in config loading,
 trust,
 and the commit scan target;
 all are resolved below.
Execution is deferred.
Sequencing is platform-first:
 build the platform,
 migrate the existing checks onto it,
then retire hk (and with it pkl) as the capstone.

## Decision

Make `packages/cli/git` a pluggable git policies platform modeled on oxlint.
Git policy enforcement consolidates into `cli-git` as configurable,
 distributable policies,
rather than living in separate hook-runner tooling.
hk,
 the git hook runner,
 is deprecated as the final step,
 and pkl goes with it,
because pkl exists in this repo only as hk's config language.

The platform is meant for standalone use,
 including by people who do not use mise,
so its install path,
 config format,
 and trust model cannot assume mise is present.

## Why oxlint as the model

The platform framing overrides the repo's usual lean toward direct execution (AD3) and starting simple (XNC),
so it has to earn that override,
 and it does.
Git policy enforcement is linter-shaped:
 a growing set of independent rules,
 each with its own applicability,
severity,
 and options,
 which is the case where a configurable platform beats a hardcoded list.
External distribution supplies a real second consumer,
 which is what AD3 and XNC concede to;
a platform with one consumer would be speculative,
 a platform other repos and non-mise users adopt is not.

The repo already practices this model for linting,
 so the structure transfers rather than being invented:
`oxlint.config.ts` is a TS config auto-discovered by convention,
 and `packages/oxlint-plugins/tsdoc` is a
plugin published as `@monochromatic-dev/config-oxlint-tsdoc`.
cli-git borrows the authoring ergonomics,
 not the runtime internals (see config loading below).

## Why shadow git on PATH rather than git hooks

`cli-git` enforces by shadowing the `git` binary on PATH,
 the mechanism it already uses for its current rules.
This beats native git hooks (what hk drives today) on the two axes that matter.

- More capable.
  A PATH wrapper intercepts and can rewrite any subcommand,
   which is exactly what the transformer rules do
  (atomic-push injects `--atomic`,
   commit-only injects `-o`,
   status-hints-off injects `-c advice.statusHints=false`).
  Native hooks only observe and reject at fixed lifecycle points;
   they cannot transform the command.
- Lower friction.
  PATH placement activates the wrapper with no separate install step,
   where hk needs an `hk install` that
  people forget,
   so in practice the shim is the more reliably present gate.

The limitation is recorded honestly.
A PATH shim fires only when the resolved `git` is the shim,
 so calling real git by absolute path,
 or running
with the shim not first on PATH,
 or through an IDE or GUI that links libgit2,
 bypasses every policy.
Native hooks have their own bypasses (`--no-verify`,
 and they do nothing until installed),
 so the two are
different in shape,
 not strictly ordered:
 a PATH shim can be bypassed more often in IDE-heavy or scripted
environments,
 less often where install is forgotten.
Local enforcement is therefore treated as best-effort fast feedback,
 with CI as the authoritative gate.

Distribution follows from the standalone goal:
 mise bin linkage is the zero-config install for mise users,
and non-mise users install the shim and place it ahead of real git on PATH themselves.

## Policy surface and model

The surface is narrow on purpose.
Policies are the configurable,
 toggleable,
 distributable lint surface,
 and only three kinds qualify:
validators,
 which reject or pass a command;
content scanners,
 which scan files and reject on a hit;
and content normalizers,
 which check or canonically rewrite selected file content.

The command transformers (atomic-push,
 commit-only,
 status-hints-off) and post-commit auto-push are not policies.
They stay fixed core wrapper behavior,
 configured only by their existing per-invocation flags.
A transform that always fires is just a transform,
 not an opt-in autofix,
 so dressing it as a policy buys no
configurability anyone uses,
 and auto-push is a side-effecting backup that is hook-shaped,
 not rule-shaped.
The cost is explicit:
 a transform cannot be toggled from config,
 only via its flag (for example `--no-atomic`).

Every existing and migrated behavior classifies as one of:

- Fixed core transformers:
   atomic-push,
   commit-only,
   status-hints-off.
- Fixed core side effect:
   post-commit auto-push,
   which additionally runs content-scan policies as a pre-push gate.
- Built-in configurable policies (universal git safety,
   shipped in cli-git core):
   require-root,
   add-explicit,
  linked-worktree-only.
- Plugin and repo-local policies (this repo configures them):
   forbidden-strings,
   wrapping the separately built,
  SLSA-attested binary;
   forbidden-root-context,
   a small first-party validator for the repo's root-CONTEXT.
  md rule;
   and final-newline,
   a content normalizer with exact-byte exclusions.

A policy declares its kind (validator,
 content scanner,
 or content normalizer),
 the subcommands it applies to,
 its trigger points
(pre-forward,
 post-commit before auto-push,
 on push,
 or direct check/fix),
 its default severity,
 and its warn-safety.
A content normalizer additionally declares its fix mode,
file selection,
and exclusions.
The detailed API contract,
 including the exact context object passed to a policy,
 is deferred to an
implementation spec;
 this record fixes the decisions,
 not the interfaces.

## Config artifact and loading

The runtime contract is narrow:
 cli-git loads `cli-git.config.mjs` from the git repo root.
cli-git neither transpiles nor bundles.
Authoring in TypeScript (`cli-git.config.ts`,
 oxlint-style `defineConfig`) is supported as a source format,
but producing `cli-git.config.mjs`,
 whether hand-written ESM or compiled and bundled from the TS source with
plugins inlined,
 is the consumer's responsibility.
Anyone who prebundles places the result at `cli-git.config.mjs` at the repo root;
 cli-git does not manage that build.

Because config and plugins are the same runtime as cli-git,
 a consumer can fuse them into a single
`cli-git.config.mjs`,
 an advantage a linter whose plugins run in a different runtime than its core does not have.

Loading is eager,
 and the cost is recorded rather than waved away:
 loading `cli-git.config.mjs` runs its
top-level code on every config-loading command,
 which the chosen design accepts.
Two things keep that affordable.
A consumer-produced prebundle collapses loading to a single module with no per-plugin resolution,
 and the
platform contract requires plugins to do negligible work at module top level;
 a policy's actual check runs
only when its subcommand matches,
 so eager loading pays for registration,
 not for scanning.

With no `cli-git.config.mjs` present the wrapper runs built-in rules only,
 with no parsing,
 transpilation,
 or
plugin load.
Discovery is bounded to the repo root rather than an unbounded parent walk,
 and read-only or inspection
commands (those that cannot mutate state,
 such as `status`,
 `log`,
 `diff`,
 `show`) never load config at all,
which limits both the hot-path cost and,
 under the trust model below,
 the code-execution exposure.

## Trust

Because the wrapper shadows `git`,
 loading `cli-git.config.mjs` turns an innocuous-looking command into code
execution,
 the hazard native hooks avoid by never running a clone's checked-out hooks.
cli-git therefore gates config loading behind trust,
 with its own self-contained registry rather than mise's,
because standalone and non-mise use is expected.

The allowlist key is the pair (filesystem id,
 artifact path),
 and adds a sha256 of `cli-git.config.mjs` under
paranoid mode.
The filesystem id binds trust to the physical volume rather than the mount path,
 so a path trusted on one
volume is not trusted when a different volume is mounted at the same path;
 this closes a mount-swap
trust-confusion hole that a path-only key leaves open,
 and it is why the id must be part of the key,
 not just
the path.
The filesystem id comes from a new shared module,
 `@monochromatic-dev/module-fs-id`,
 planned in
`docs/planning/module-fs-id.md`.
That module extracts and corrects the mechanic editord seeded
(`packages-paused/desktop-daemon/editord/src/server/operations/resolve-fs-id.ts`),
 which was unshared and
latently wrong:
 it called the Linux `f_fsid` reboot-stable (filesystem-specific,
 false for XFS),
 read a device
number on macOS while labeling it `f_fsid`,
 and misdescribed the Windows command.
The module instead resolves a reboot-stable volume id where the platform can produce one (a filesystem UUID via
`findmnt` on Linux,
 the Volume UUID via `diskutil` on macOS,
 the volume serial on Windows),
 degrades to a
runtime id and warns when stability cannot be guaranteed,
 and never fails merely because a stable id is
unavailable,
 since a trust check that hard-fails on an exotic filesystem trains people to disable it.
The resolved id is guaranteed colon-free,
 so the `"<filesystem id>:<path>"` key recovers both halves by
splitting on the first colon even when the path is a Windows `C:\...` path.

It borrows mise's machinery but,
 deliberately,
 not mise's default posture:

- Default:
   content-hashed (mise's paranoid posture made the default).
  First encounter is untrusted:
   built-ins run,
   the repo config does not,
   until an explicit `cli-git trust`.
  The sha256 component of the key is active (mise's `file_hash_sha256`,
   which mise gates behind
  `Settings::paranoid`),
   so any later change to the artifact,
   an edit,
   a re-bundle,
   or a pulled change,
  re-prompts before it executes.
  This is stricter than mise's default on purpose:
   mise executes config on `cd` or an explicit command,
   while
  cli-git executes it on ordinary git commands,
   so the silent-pulled-change hole is worth closing by default.
- Relaxed mode (no content re-check):
   paranoid is on by default and can be turned off only per config,
   never globally.
  Because the only thing a relaxation can express is "paranoid off here",
   the value never needs to carry one,
   so
  `CLI_GIT_NO_PARANOID` is just a list of the (filesystem id,
   path) pairs whose content re-check is disabled.
  The operator sets it by hand (in a shell or `mise.toml`);
   cli-git never writes it,
   but it surfaces the exact
  `<filesystem id>:<path>` entry to paste,
   so the operator does not have to compute the id (the command that
  prints it is in the implementation spec).
  Each entry is the colon-joined `<filesystem id>:<path>` key the trust registry uses,
   recovered by splitting on
  the first colon (the id is colon-free,
   so this round-trips even for a Windows `C:\...` path);
   membership in the
  list is the whole signal,
   with no JSON and no key-to-value map (the exact list separator and escaping are in the
  implementation spec).
  Keying each entry on the filesystem id,
   not the path alone,
   is the security feature:
   a legitimate relaxation
  names the exact (filesystem id,
   path) it relaxes,
   which requires knowing the actual volume,
   whereas an
  opportunistic attacker planting guesses in a repo's env knows a likely path but not the cloner's filesystem id
  (see the security note).
  Relaxing drops only the content re-check;
   the (filesystem id,
   path) trust still applies,
   so a modified trusted
  config no longer re-prompts (its explicit cost),
   but first execution still requires `cli-git trust`.
  Per-path no-paranoid lives in the environment by necessity,
   not preference:
   it cannot live in the repo config it
  governs,
   or a repo could opt itself out of being re-checked.
  This is the inverse of mise,
   which makes `paranoid` global-only (`settings.toml`,
   `global_only = true`),
   and
  the inversion is the point:
   a global off-switch would be an entry that names no (filesystem id,
   path) at all,
  exactly the shape the security note treats as suspicious,
   so allowing one would hand an attacker a legitimate
  unkeyed bypass and defeat the detection.
  With per-config-only relaxation,
   a list entry for the config being loaded that carries no matching filesystem
  id is unambiguously the attack signature,
   because that config's own volume is necessarily mounted at load time,
  so a legitimate relaxation for it would carry the real id.
- It fails closed when it cannot prompt and the artifact is untrusted,
   or,
   under paranoid,
   changed (run
  built-ins,
   do not execute it),
   and exposes an env kill-switch to disable discovery entirely.

Security note on the env channel.
Setting `CLI_GIT_NO_PARANOID` intentionally,
 in your own shell or `mise.toml`,
 is fine;
 relaxing a config you own
is your call and is not flagged.
The attack to defeat is different:
 a repo plants `CLI_GIT_NO_PARANOID` entries for guessed common config paths in
its `mise.toml` env,
 betting a cloner trusts the `mise.toml` without much thought.
The tell is that such an entry cannot carry a real filesystem id,
 because the attacker can guess a path but does
not know the cloner's volume,
 so the planted entry is path-only.
So cli-git shouts on two kinds of entry.
Structurally,
 on any list entry that carries no filesystem id or a malformed one (an id that does not parse as a
real volume-id shape),
 wherever it sits in the list:
 a legitimate entry carries the real id that cli-git
surfaced for the operator to paste,
 so a missing or malformed id is the mark of a path guess,
 not of legitimate
use.
Semantically,
 and scoped to the config being loaded,
 on the entry that names this config's path but whose
well-formed id matches no mounted volume:
 this config's own volume is necessarily mounted at load time,
 so a
well-formed but wrong id there is a planted guess.
The scoping is what keeps the semantic check quiet for a legitimate dormant entry:
 a well-formed entry for some
other path (an unplugged external drive,
 or a repo not yet cloned) names a real id that simply is not mounted
right now,
 so it is never consulted.
A shout is a loud warning naming the variable and the offending path,
 because both shapes are signatures of
opportunistic path matching,
 not intentional relaxation;
 legitimate use carries the real id for a mounted volume
and stays quiet.
Even ignored,
 the relaxation removes only the re-check on later changes,
 not the first-execution gate (the
(filesystem id,
 path) trust still requires an explicit `cli-git trust`),
 and a path-only entry matches no
trusted key anyway.

Provisional,
 derived from mise rather than decided here:
 whether to support mise's `.monorepo`-style trust of a
config root for a subtree,
 and how an external consumer's CI that runs the wrapper obtains trust under a
content-hashed default (this repo's own CI runs the attested binary directly,
 not the wrapper,
 so it is
unaffected).
Both belong in the implementation spec.

The supply-chain boundary is stated plainly so a future reader does not over-read it.
Under the default a modified `cli-git.config.mjs` re-prompts,
 so a bundled-in plugin update is caught;
only plugins the artifact imports from node_modules rather than inlining escape the hash,
 and those are
governed by the consumer's lockfile pinning.
Trust answers only whether to execute this repo's config at all;
 it does not vet what that config imports.
Plugin internals and versions remain the consumer's lockfile-pinning problem (the earlier "provenance is not
cli-git's business" stance),
 not cli-git's.

## Severity

Severity follows oxlint's off,
 warn,
 and error.
error rejects the command (the current validator behavior),
 warn prints a diagnostic and forwards to git anyway,
and off skips the policy.

Each policy also carries warn-safety metadata,
 so config validation can shout when warn is dangerous rather
than silently honoring it.
forbidden-strings ships defaulting to error,
 because warn would let a secret-bearing commit through locally.
The destructive-command guard linked-worktree-only (it gates `git stash`,
 state-changing `git clean`,
 and
`--hard`/`--merge`/`--keep` reset in the main worktree) defaults to error for the same reason:
 warn there
would permit data loss with only a diagnostic.
CI is the backstop regardless.

## Scan trigger points

forbidden-strings scans at two points,
 for two reasons.

- Pre-forward,
   on the predicted to-be-committed paths,
   for instant feedback before the commit lands.
  commit-only narrows the modes (it rejects `-a`/`--all`,
   forces an explicit pathspec,
   and guards pathless
  amend),
   which keeps the prediction tractable.
- Post-commit,
   on the tree git actually wrote,
   gating the auto-push.
  This scans ground truth,
   so it cannot false-pass a secret to the remote even if the pre-forward prediction
  was wrong;
   a hit blocks the backup push and leaves the commit local for the developer to amend or reset,
  reusing cli-git's existing failed-push behavior.

For a manual `git push` of commits never scanned at commit time (made outside the wrapper,
 or older),
 cli-git
scans the actual range being pushed,
 determined by parsing the push form with Optique as the existing rules do,
or by a git-native range computation,
 not hand-rolled refspec guesses.
Derived choice,
 not user-decided:
 on a push form whose range cannot be determined (for example `--mirror` or a
ref deletion),
 cli-git fails open locally with a warning that the local scan was skipped,
 rather than blocking
a legitimate push,
 because local enforcement is best-effort and CI is authoritative.

forbidden-root-context is a pre-forward validator (path-based,
 rejecting staging or committing a root `CONTEXT.md`).

## Final-newline normalization semantics

final-newline migrates from hk as a content normalizer,
not as a command transformer.
For selected non-empty text files,
check mode requires exactly one final LF and fix mode removes a final LF run before appending one LF.
Binary-looking and empty files remain unchanged.

The repo-local exclusions migrate as part of policy parity:

- `packages/fuzz/forbidden-strings/corpus/**`,
  because fuzz input bytes are test data.
- `packages/test-fixture/toml-edit/src/**`,
  because missing final LF can be parser input under test.
- `**/dist/final/node/**`,
  because tsdown output intentionally keeps its producer-native missing final LF and saves one byte per file.
  The measured tracked baseline contains 18 such files and saves 18 bytes.

Pre-forward fix mode must transform the exact would-be-committed content without staging unrelated worktree bytes.
Partially staged files are the decisive parity case:
unstaged edits must survive the commit transaction,
and the committed blob alone must receive required canonicalization.
The implementation must not achieve this by adding the whole worktree file to the index.
It also must not copy hk 1.50.0's duplicate-separator edge:
when staged content lacks final LF and an unstaged tail starts at that boundary,
hk restores the text with an extra blank line.
`docs/troubleshooting/hk-partial-staging-final-newline.md` records the exact bytes and upstream-compatible prototype.

The interim hk pre-commit surface is therefore read-only:
it keeps `stash = "git"` so the check sees staged bytes,
but does not set `fix = true`.
Auto-fix remains on the explicit `fix` surface until a verified hk release fixes the merge or cli-git replaces it.

Push and direct check modes are read-only.
A direct fix surface must provide the current `hk fix --all --step final-newline --no-stage` capability,
so a caller can normalize the worktree and inspect explicit path groups without bulk staging.
The implementation spec decides the API and transaction mechanism,
but cannot weaken these semantics or the exact exclusions.

## Escape hatches and a behavior change

The escape-hatch parsing already exists and is parser-based,
 so it is not a design open question.
`packages/cli/git/src/escape-hatch.ts` uses Optique to recognize `--no-enforce-<id>` only in flag position,
strip it before forwarding,
 and preserve any token past the `--` pathspec separator,
 so `git commit -- --no-enforce-x`
is correctly treated as a pathspec.
The platform inherits this convention for per-policy bypass,
 and config severity `off` is the persistent disable.
This persistent disable is itself a change for the built-in safety policies:
 require-root,
 add-explicit,
 and
linked-worktree-only are bypassable today only per invocation (for example `--no-enforce-bulk-add`) and now gain
a persistent `off` through config;
 they default to their current always-on severity,
 so the change is opt-in.
`git commit --no-verify` no longer affects these checks,
 because there are no native hooks left for it to skip.
That is a behavior change from the hk era and the docs must state it,
 so nobody assumes `--no-verify` still opts out.

## CI relationship

CI already runs forbidden-strings directly via the SLSA-attested binary;
the old `mise exec -- hk check` step was removed because it forced mise to install unrelated tools.
CI stays independent of the wrapper.
The forbidden-strings `cli-git` policy wraps the same binary for local fast feedback;
it does not replace the CI gate.

final-newline is temporarily local-only while hk owns it.
Do not reintroduce generic hk execution in CI.
Before hk retirement,
add an independent final-newline check that invokes the migrated policy's direct checker without loading unrelated
root tooling and honors all three exclusion families.

## Alternatives considered

Sequencing was the first live fork.

- Decouple and retire hk now (rejected).
  Fold the three hk-managed behaviors into the existing pipeline as first-party modules immediately and grow the
  platform after.
  Lands the supply-chain win sooner and matches the repo's commit-early lean.
  Rejected for a single coherent landing,
   since nothing ships this session anyway.
- Parallel-run both (rejected).
  Keep hk running the managed behaviors alongside cli-git until proven.
  Rejected because forbidden-strings already has an authoritative CI gate,
  while final-newline needs parity fixtures and an independent checker rather than two local normalizers touching
  the same content.
  Parallel operation would keep hk and pkl without adding a distinct evidence layer.
- Platform-first (chosen).
  The accepted cost:
   hk,
   pkl,
   and hk's under-verified supply-chain surface persist for the whole platform build.

The three forks the external review surfaced resolved as:

- Config loading:
   eager load of a consumer-produced prebundle (chosen) over a cli-git-built manifest (rejected,
  it would put a build cli-git does not own on the hot path) and dynamic-import thunks (rejected,
   they drop the
  plain-import authoring ergonomic).
- Trust:
   cli-git's own registry,
   content-hashed by default (chosen,
   stricter than mise's path-keyed default
  because the wrapper executes config on ordinary git commands) over reusing mise's store (rejected,
   non-mise
  use is expected) and treating trust as out of scope (rejected,
   it turns `git status` into code execution on
  any clone).
- Scan timing:
   both pre-forward and post-commit (chosen) over pre-forward only (rejected,
   a misprediction
  false-passes to the remote) and post-commit only (rejected,
   no early feedback).

## Retirement, the capstone

Do not retire hk and pkl until all of these hold:

- The platform is implemented and all three hk-managed behaviors run on it.
- The migrated validators,
  scanner,
  and normalizer have parity tests proving each old hk trigger path is covered,
  including partial staging and all final-newline exclusions,
  and they pass.
- Agreed performance gates exist (exact budgets belong in the implementation spec) and pass.
- The docs explain the `--no-verify` behavior change.
- Independent CI checks for forbidden-strings and final-newline are green.
- An idempotent cleanup exists for the per-machine hk Git config.

Then perform the removal:

- Remove `hk` and `pkl` from `mise.toml` and `mise.no-env.toml`,
   and delete `hk.pkl`.
- Remove the per-machine Git 2.54 `hook.hk-*` config entries via `hk uninstall`,
   documented as a per-machine step.
- Remove `.idea/pklSettings.xml`;
   `docs/troubleshooting/intellij-pkl-plugin-discovery.md` is then moot.
- Update `packages/cli/forbidden-strings/README.md`,
   whose Local (hk) and GitHub Actions hk-check sections are
  already stale relative to the live CI workflow.
- Update the hk and pkl references in `docs/todo/forbidden-strings.md` and `docs/planning/forbidden-strings-em-dash.md`.

Migration order within the platform:
 forbidden-root-context first,
 because it is smaller and proves the
validator shape;
 forbidden-strings next,
 which proves the content-scanner shape and dual trigger semantics;
 then final-newline,
 which proves content normalization,
exact-byte exclusions,
direct check/fix surfaces,
and partial-staging safety.

## Supply-chain note

Per `mise-aqua-backend.md`,
 hk is digest-verified only,
 because mise does not implement
`github_release_attestations`,
 the key hk's registry entry relies on.
Retiring hk and pkl removes that under-verified surface from the toolchain.
forbidden-strings,
 by contrast,
 is built in-repo and distributed to CI with SLSA provenance.
The platform's own plugin supply chain is governed by the consumer's lockfile pinning,
 not by cli-git's trust
(see trust above),
 so consolidating onto it does not inherit hk's gap.

## References

- `packages/cli/git/README.md` and `packages/cli/git/src/index.ts`:
   the current wrapper and its RULES pipeline.
- `packages/cli/git/src/escape-hatch.ts` and `packages/cli/git/src/rules/commit-only.ts`:
   the existing
  Optique-based escape-hatch parsing and the commit-mode narrowing the scan relies on.
- `packages/cli/git/src/rules/add-explicit.ts` and `packages/cli/git/src/auto-push.ts`:
   the add-explicit
  validator (now a built-in configurable policy) and the post-commit auto-push the post-commit scan gates.
- `oxlint.config.ts`,
   `packages/config/oxlint`,
   `packages/oxlint-plugins/tsdoc`:
   the authoring model borrowed
  (TS `defineConfig` and plugin packages),
   not the runtime.
- jdx/mise `src/config/config_file/mod.rs` (`trust_path`,
   the `paranoid`-gated `file_hash_sha256`) and
  `src/cli/trust.rs`:
   the trust model cli-git mirrors,
   path-keyed by default,
   content-hashed only under paranoid.
- `docs/planning/module-fs-id.md` and the planned `@monochromatic-dev/module-fs-id`:
   the corrected shared
  filesystem-id mechanic the trust key uses (a reboot-stable volume id where available,
   degrade-and-warn
  otherwise),
   extracted from and fixing editord's seed `resolve-fs-id.ts`.
- `hk.pkl`:
   the current hk config,
   with final-newline on pre-commit,
  pre-push,
  check,
  and fix;
  forbidden-root-context on pre-commit,
  pre-push,
  and check;
  and forbidden-strings definitions retained but temporarily disabled during refactoring.
- `docs/planning/final-newline-normalization.md`,
   `docs/troubleshooting/hk-partial-staging-final-newline.md`,
  and `docs/troubleshooting/tsdown-final-newline.md`:
   current normalization semantics,
  exact-byte exclusions,
  partial-staging evidence and known boundary merge,
  and tsdown's compact-output exception.
- `.github/workflows/forbidden-strings.yml`:
   the CI gate,
   already off hk.
- `mise-aqua-backend.md`:
   hk's supply-chain posture.
- A future implementation spec,
   to hold the policy API contract,
   performance budgets,
   the parity-test list,
   and
  the exact `CLI_GIT_NO_PARANOID` list format (the entry separator and path escaping).

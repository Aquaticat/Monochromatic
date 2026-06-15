# cli-git pluggable git policies platform

## Status

Decided in design, not yet built.
This session refined the decision through grilling and a round of external review,
which surfaced gaps in config loading, trust, and the commit scan target; all are resolved below.
Execution is deferred.
Sequencing is platform-first: build the platform, migrate the existing checks onto it,
then retire hk (and with it pkl) as the capstone.

## Decision

Make `packages/cli/git` a pluggable git policies platform modeled on oxlint.
Git policy enforcement consolidates into `cli-git` as configurable, distributable policies,
rather than living in separate hook-runner tooling.
hk, the git hook runner, is deprecated as the final step, and pkl goes with it,
because pkl exists in this repo only as hk's config language.

The platform is meant for standalone use, including by people who do not use mise,
so its install path, config format, and trust model cannot assume mise is present.

## Why oxlint as the model

The platform framing overrides the repo's usual lean toward direct execution (AD3) and starting simple (XNC),
so it has to earn that override, and it does.
Git policy enforcement is linter-shaped: a growing set of independent rules, each with its own applicability,
severity, and options, which is the case where a configurable platform beats a hardcoded list.
External distribution supplies a real second consumer, which is what AD3 and XNC concede to;
a platform with one consumer would be speculative, a platform other repos and non-mise users adopt is not.

The repo already practices this model for linting, so the structure transfers rather than being invented:
`oxlint.config.ts` is a TS config auto-discovered by convention, and `packages/oxlint-plugins/tsdoc` is a
plugin published as `@monochromatic-dev/config-oxlint-tsdoc`.
cli-git borrows the authoring ergonomics, not the runtime internals (see config loading below).

## Why shadow git on PATH rather than git hooks

`cli-git` enforces by shadowing the `git` binary on PATH, the mechanism it already uses for its current rules.
This beats native git hooks (what hk drives today) on the two axes that matter.

- More capable.
  A PATH wrapper intercepts and can rewrite any subcommand, which is exactly what the transformer rules do
  (atomic-push injects `--atomic`, commit-only injects `-o`, status-hints-off injects `-c advice.statusHints=false`).
  Native hooks only observe and reject at fixed lifecycle points; they cannot transform the command.
- Lower friction.
  PATH placement activates the wrapper with no separate install step, where hk needs an `hk install` that
  people forget, so in practice the shim is the more reliably present gate.

The limitation is recorded honestly.
A PATH shim fires only when the resolved `git` is the shim, so calling real git by absolute path, or running
with the shim not first on PATH, or through an IDE or GUI that links libgit2, bypasses every policy.
Native hooks have their own bypasses (`--no-verify`, and they do nothing until installed), so the two are
different in shape, not strictly ordered: a PATH shim can be bypassed more often in IDE-heavy or scripted
environments, less often where install is forgotten.
Local enforcement is therefore treated as best-effort fast feedback, with CI as the authoritative gate.

Distribution follows from the standalone goal: mise bin linkage is the zero-config install for mise users,
and non-mise users install the shim and place it ahead of real git on PATH themselves.

## Policy surface and model

The surface is narrow on purpose.
Policies are the configurable, toggleable, distributable lint surface, and only two kinds qualify:
validators, which reject or pass a command, and content scanners, which scan files and reject on a hit.

The command transformers (atomic-push, commit-only, status-hints-off) and post-commit auto-push are not policies.
They stay fixed core wrapper behavior, configured only by their existing per-invocation flags.
A transform that always fires is just a transform, not an opt-in autofix, so dressing it as a policy buys no
configurability anyone uses, and auto-push is a side-effecting backup that is hook-shaped, not rule-shaped.
The cost is explicit: a transform cannot be toggled from config, only via its flag (for example `--no-atomic`).

Every existing and migrated behavior classifies as one of:

- Fixed core transformers: atomic-push, commit-only, status-hints-off.
- Fixed core side effect: post-commit auto-push, which additionally runs content-scan policies as a pre-push gate.
- Built-in configurable policies (universal git safety, shipped in cli-git core): require-root, add-explicit,
  linked-worktree-only.
- Plugin and repo-local policies (this repo configures them): forbidden-strings, wrapping the separately built,
  SLSA-attested binary, and forbidden-root-context, a small first-party validator for the repo's root-CONTEXT.md rule.

A policy declares its kind (validator or content scanner), the subcommands it applies to, its trigger points
(pre-forward, post-commit before auto-push, or on push), its default severity, and its warn-safety.
The detailed API contract, including the exact context object passed to a policy, is deferred to an
implementation spec; this record fixes the decisions, not the interfaces.

## Config artifact and loading

The runtime contract is narrow: cli-git loads `cli-git.config.mjs` from the git repo root.
cli-git neither transpiles nor bundles.
Authoring in TypeScript (`cli-git.config.ts`, oxlint-style `defineConfig`) is supported as a source format,
but producing `cli-git.config.mjs`, whether hand-written ESM or compiled and bundled from the TS source with
plugins inlined, is the consumer's responsibility.
Anyone who prebundles places the result at `cli-git.config.mjs` at the repo root; cli-git does not manage that build.

Because config and plugins are the same runtime as cli-git, a consumer can fuse them into a single
`cli-git.config.mjs`, an advantage a linter whose plugins run in a different runtime than its core does not have.

Loading is eager, and the cost is recorded rather than waved away: loading `cli-git.config.mjs` runs its
top-level code on every config-loading command, which the chosen design accepts.
Two things keep that affordable.
A consumer-produced prebundle collapses loading to a single module with no per-plugin resolution, and the
platform contract requires plugins to do negligible work at module top level; a policy's actual check runs
only when its subcommand matches, so eager loading pays for registration, not for scanning.

With no `cli-git.config.mjs` present the wrapper runs built-in rules only, with no parsing, transpilation, or
plugin load.
Discovery is bounded to the repo root rather than an unbounded parent walk, and read-only or inspection
commands (`status`, `log`, `diff`, `show`) never load config at all, which limits both the hot-path cost and,
under the trust model below, the code-execution exposure.

## Trust

Because the wrapper shadows `git`, loading `cli-git.config.mjs` turns an innocuous-looking command into code
execution, the hazard native hooks avoid by never running a clone's checked-out hooks.
cli-git therefore gates config loading behind trust, with its own self-contained registry rather than mise's,
because standalone and non-mise use is expected.
It follows mise's verified model:

- Default: trust is path-keyed.
  A per-user registry records a marker for the config artifact's path (mise stores empty path-named markers
  under `~/.local/state/mise/trusted-configs/`, with a `.monorepo` variant trusting a config root for a subtree).
  First encounter is untrusted: built-ins run, the repo config does not, until an explicit `cli-git trust`.
  Once trusted, that path stays trusted; later edits, re-bundles, or pulled changes are not re-checked.
- Paranoid mode (opt-in setting): additionally records and verifies a sha256 of the artifact (mise's
  `file_hash_sha256`, gated by `Settings::paranoid`), so any change to `cli-git.config.mjs` re-prompts.
- It fails closed when it cannot prompt and the config is untrusted (run built-ins, do not execute it),
  auto-trusts in detected CI unless paranoid mode is set, and exposes an env kill-switch to disable discovery.

The supply-chain boundary is stated plainly so a future reader does not over-read it.
In the default mode a once-trusted config that is later modified executes without re-prompting, exactly as
with mise; only paranoid mode closes that.
Trust answers only whether to execute this repo's config at all.
It does not vet what that config imports: plugin internals and versions are the consumer's lockfile-pinning
problem (the earlier "provenance is not cli-git's business" stance), and even a bundled-in plugin update is
re-checked only under paranoid mode, never in the default path-keyed mode.

## Severity

Severity follows oxlint's off, warn, and error.
error rejects the command (the current validator behavior), warn prints a diagnostic and forwards to git anyway,
and off skips the policy.

Each policy also carries warn-safety metadata, so config validation can shout when warn is dangerous rather
than silently honoring it.
forbidden-strings ships defaulting to error, because warn would let a secret-bearing commit through locally.
The destructive-command guard linked-worktree-only (it gates `git stash`, state-changing `git clean`, and
`--hard`/`--merge`/`--keep` reset in the main worktree) defaults to error for the same reason: warn there
would permit data loss with only a diagnostic.
CI is the backstop regardless.

## Scan trigger points

forbidden-strings scans at two points, for two reasons.

- Pre-forward, on the predicted to-be-committed paths, for instant feedback before the commit lands.
  commit-only narrows the modes (it rejects `-a`/`--all`, forces an explicit pathspec, and guards pathless
  amend), which keeps the prediction tractable.
- Post-commit, on the tree git actually wrote, gating the auto-push.
  This scans ground truth, so it cannot false-pass a secret to the remote even if the pre-forward prediction
  was wrong; a hit blocks the backup push and leaves the commit local for the developer to amend or reset,
  reusing cli-git's existing failed-push behavior.

For a manual `git push` of commits never scanned at commit time (made outside the wrapper, or older), cli-git
scans the actual range being pushed, determined by parsing the push form with Optique as the existing rules do,
or by a git-native range computation, not hand-rolled refspec guesses.
Derived choice, not user-decided: on a push form whose range cannot be determined (for example `--mirror` or a
ref deletion), cli-git fails open locally with a warning that the local scan was skipped, rather than blocking
a legitimate push, because local enforcement is best-effort and CI is authoritative.

forbidden-root-context is a pre-forward validator (path-based, rejecting staging or committing a root `CONTEXT.md`).

## Escape hatches and a behavior change

The escape-hatch parsing already exists and is parser-based, so it is not a design open question.
`packages/cli/git/src/escape-hatch.ts` uses Optique to recognize `--no-enforce-<id>` only in flag position,
strip it before forwarding, and preserve any token past the `--` pathspec separator, so `git commit -- --no-enforce-x`
is correctly treated as a pathspec.
The platform inherits this convention for per-policy bypass, and config severity `off` is the persistent disable.
`git commit --no-verify` no longer affects these checks, because there are no native hooks left for it to skip.
That is a behavior change from the hk era and the docs must state it, so nobody assumes `--no-verify` still opts out.

## CI relationship

CI already runs forbidden-strings directly via the SLSA-attested binary;
the old `mise exec -- hk check` step was removed because it forced mise to install unrelated tools.
CI stays independent of the wrapper and remains the authoritative gate everywhere.
The `cli-git` policy wraps the same binary for local fast feedback; it does not replace the CI gate.

## Alternatives considered

Sequencing was the first live fork.

- Decouple and retire hk now (rejected).
  Fold the two checks into the existing pipeline as first-party modules immediately and grow the platform after.
  Lands the supply-chain win sooner and matches the repo's commit-early lean.
  Rejected for a single coherent landing, since nothing ships this session anyway.
- Parallel-run both (rejected).
  Keep hk running the checks alongside cli-git until proven.
  Rejected because CI is already authoritative, so the margin is low-value while it double-scans and keeps
  hk and pkl around.
- Platform-first (chosen).
  The accepted cost: hk, pkl, and hk's under-verified supply-chain surface persist for the whole platform build.

The three forks the external review surfaced resolved as:

- Config loading: eager load of a consumer-produced prebundle (chosen) over a cli-git-built manifest (rejected,
  it would put a build cli-git does not own on the hot path) and dynamic-import thunks (rejected, they drop the
  plain-import authoring ergonomic).
- Trust: cli-git's own path-keyed registry on mise's model (chosen) over reusing mise's store (rejected,
  non-mise use is expected) and treating trust as out of scope (rejected, it turns `git status` into code
  execution on any clone).
- Scan timing: both pre-forward and post-commit (chosen) over pre-forward only (rejected, a misprediction
  false-passes to the remote) and post-commit only (rejected, no early feedback).

## Retirement, the capstone

Do not retire hk and pkl until all of these hold:

- The platform is implemented and the two checks run on it.
- The migrated checks have parity tests proving each old hk trigger path is covered, and they pass.
- Agreed performance gates exist (exact budgets belong in the implementation spec) and pass.
- The docs explain the `--no-verify` behavior change.
- CI remains independent and green.
- An idempotent cleanup exists for the per-machine hk Git config.

Then perform the removal:

- Remove `hk` and `pkl` from `mise.toml` and `mise.no-env.toml`, and delete `hk.pkl`.
- Remove the per-machine Git 2.54 `hook.hk-*` config entries via `hk uninstall`, documented as a per-machine step.
- Remove `.idea/pklSettings.xml`; `docs/troubleshooting/intellij-pkl-plugin-discovery.md` is then moot.
- Update `packages/cli/forbidden-strings/README.md`, whose Local (hk) and GitHub Actions hk-check sections are
  already stale relative to the live CI workflow.
- Update the hk and pkl references in `docs/todo/forbidden-strings.md` and `docs/planning/forbidden-strings-em-dash.md`.

Migration order within the platform: forbidden-root-context first, because it is smaller and proves the
validator shape, then forbidden-strings, which proves the content-scanner shape and the dual trigger semantics.

## Supply-chain note

Per `mise-aqua-backend.md`, hk is digest-verified only, because mise does not implement
`github_release_attestations`, the key hk's registry entry relies on.
Retiring hk and pkl removes that under-verified surface from the toolchain.
forbidden-strings, by contrast, is built in-repo and distributed to CI with SLSA provenance.
The platform's own plugin supply chain is governed by the consumer's lockfile pinning, not by cli-git's trust
(see trust above), so consolidating onto it does not inherit hk's gap.

## References

- `packages/cli/git/README.md` and `packages/cli/git/src/index.ts`: the current wrapper and its RULES pipeline.
- `packages/cli/git/src/escape-hatch.ts` and `packages/cli/git/src/rules/commit-only.ts`: the existing
  Optique-based escape-hatch parsing and the commit-mode narrowing the scan relies on.
- `oxlint.config.ts`, `packages/config/oxlint`, `packages/oxlint-plugins/tsdoc`: the authoring model borrowed
  (TS `defineConfig` and plugin packages), not the runtime.
- jdx/mise `src/config/config_file/mod.rs` (`trust_path`, the `paranoid`-gated `file_hash_sha256`) and
  `src/cli/trust.rs`: the trust model cli-git mirrors, path-keyed by default, content-hashed only under paranoid.
- `hk.pkl`: the current hk config (forbidden-root-context and forbidden-strings on pre-commit, pre-push, check).
- `.github/workflows/forbidden-strings.yml`: the CI gate, already off hk.
- `mise-aqua-backend.md`: hk's supply-chain posture.
- A future implementation spec, to hold the policy API contract, performance budgets, and parity-test list.

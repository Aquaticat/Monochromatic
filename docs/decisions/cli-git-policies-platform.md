# cli-git pluggable git policies platform

## Status

Decided in design, not yet built.
This session refined the decision; execution is deferred.
Sequencing is platform-first: build the platform, migrate the existing checks onto it,
then retire hk (and with it pkl) as the capstone.

## Decision

Make `packages/cli/git` a pluggable git policies platform modeled on oxlint.
Git policy enforcement consolidates into `cli-git` as configurable, distributable policies,
rather than living in separate hook-runner tooling.
hk, the git hook runner, is deprecated as the final step of the move, and pkl goes with it
because pkl exists in this repo only as hk's config language.

The oxlint model is adopted in full: a TypeScript config that selects policies and their severity,
policies authored and shipped as plugin packages, and three consumption modes that the model already serves,
external distribution, workspace policy packages, and config-driven toggling.

## Why oxlint as the model

The platform framing overrides the repo's usual lean toward direct execution (AD3) and starting simple (XNC),
so it has to earn that override.
It does, for two reasons.
Git policy enforcement is linter-shaped: a growing set of independent rules, each with its own applicability,
severity, and options, which is the case where a configurable platform is genuinely worth more than a hardcoded list.
And external distribution supplies a real second consumer, which is the thing AD3 and XNC concede to;
a platform with one consumer would be speculative, a platform other repos adopt is not.

The repo already practices this exact model for linting, so the structure transfers rather than being invented:
`oxlint.config.ts` is a TS config auto-discovered by convention,
`packages/oxlint-plugins/tsdoc` is a plugin published as `@monochromatic-dev/config-oxlint-tsdoc`,
and `ensureOxlintConfig` (in root `mise.toml`) builds the config and plugin packages ahead of time.

## Why shadow git on PATH rather than git hooks

`cli-git` enforces by shadowing the `git` binary on PATH via mise bin linkage,
the mechanism it already uses for its current rules.
This beats native git hooks (what hk drives today) on the two axes that matter.

- More capable.
  A PATH wrapper intercepts and can rewrite any subcommand, which is exactly what the transformer rules do
  (atomic-push injects `--atomic`, commit-only injects `-o`, status-hints-off injects `-c advice.statusHints=false`).
  Native hooks only observe and reject at fixed lifecycle points; they cannot transform the command.
- Lower friction.
  mise bin linkage activates the shim automatically once mise is active.
  hk needs a separate `hk install` or `hk install --global` that people forget,
  so in practice the shim is the more reliably present gate, not the weaker one.

The limitation is recorded honestly: a PATH shim fires only when the resolved `git` is the shim,
so calling real git by absolute path, or running with the shim not first on PATH, bypasses every policy
with no `--no-verify` needed.
Native hooks are not actually fires-always either: `--no-verify` skips them, and they do nothing until installed.
PATH-shadow is the least-bad option, its bypass hole is smaller than the alternative's,
and local enforcement is treated as best-effort fast feedback with CI as the authoritative gate.

## Policy surface

The surface is narrow on purpose.
Policies are the configurable, toggleable, distributable lint surface, and only two kinds qualify:

- Validators, which reject or pass a command (require-root, add-explicit, linked-worktree-only).
- Content scanners, which scan files and reject on a hit (forbidden-strings).

The command transformers (atomic-push, commit-only, status-hints-off) and post-commit auto-push are not policies.
They stay fixed core wrapper behavior, configured only by their existing per-invocation flags.
A transform that always fires is just a transform, not an opt-in autofix, so dressing it as a policy buys no
configurability anyone uses, and auto-push is a side-effecting backup that is hook-shaped, not rule-shaped.
Modeling either as a policy would stretch the lint abstraction with no payoff, which is what AD3 warns against.
The cost is explicit: a transform cannot be toggled from config, only via its flag (for example `--no-atomic`).

## Config and loading

The config is `cli-git.config.ts`, an oxlint-style `defineConfig` auto-discovered by convention.
It is TypeScript because that is oxlint's model as practiced here, not JSON.

Because `cli-git` runs once per git command rather than once per lint run, the per-invocation cost is a
first-class constraint, stricter than oxlint's.
So config and plugins must be compiled ahead of time by an ensure-build step (the `ensureOxlintConfig` pattern),
and the per-invocation path loads compiled `.mjs` and never transpiles.
A zero-config fast path is required: with no config file present the wrapper runs built-in rules only,
with no config I/O and no plugin loading, and a plugin loads only when an applicable policy's subcommand
matches the current invocation, so `git status` never pays for the forbidden-strings plugin.

## Plugins and trust

A plugin is loaded by a plain ES import in the config (`import '@cat/meow-on-git'`); importing it activates it.
This mirrors the repo's oxlint plugin packages and needs no bespoke resolver or by-name indirection.

Trust is out of scope for `cli-git`.
It adds no provenance check, no allowlist, and no sandbox.
A plugin is code the consumer chose to import, the same trust decision as any other dependency,
and supply-chain vetting stays the consumer's responsibility, not the platform's.

## Severity

Severity follows oxlint's off, warn, and error.
error rejects the command (the current validator behavior), warn prints a diagnostic and forwards to git anyway,
and off skips the policy.

The migrated forbidden-strings policy ships defaulting to error.
The footgun is named deliberately: warn would let a secret-bearing commit through locally,
so error is what keeps the local gate real, and CI is the backstop regardless.

## Scan trigger points

forbidden-strings scans at commit time, which is the real gate.
The post-commit auto-push backs up exactly the commit that was just scanned, so it needs no separate scan;
this dissolves the current dependency on the native pre-push hook firing the scanner.
Push-time scanning covers only the case the commit-time gate misses: a manual `git push` of commits that never
passed through the wrapper, made by real git directly or recorded before the policy existed.
forbidden-root-context, which rejects staging or committing a root `CONTEXT.md`, is a small validator policy.

## Escape hatches and a behavior change

Each policy keeps a per-invocation bypass consistent with the existing `--no-enforce-<id>` convention,
and config severity `off` is the persistent disable.
`git commit --no-verify` no longer affects these checks, because there are no native hooks left for it to skip.
That is a behavior change from the hk era and the docs must state it, so nobody assumes `--no-verify` still opts out.

## CI relationship

CI already runs forbidden-strings directly via the SLSA-attested binary;
the old `mise exec -- hk check` step was removed because it forced mise to install unrelated tools.
CI stays independent of the wrapper and remains the authoritative gate everywhere.
The `cli-git` policy wraps the same binary for local fast feedback; it does not replace the CI gate.

## Retirement, the capstone

When the platform ships and the two checks are migrated onto it:

- Remove `hk` and `pkl` from `mise.toml` and `mise.no-env.toml`, and delete `hk.pkl`.
- Remove the per-machine Git 2.54 `hook.hk-*` config entries via `hk uninstall`, documented as a per-machine step.
- Remove `.idea/pklSettings.xml`; `docs/troubleshooting/intellij-pkl-plugin-discovery.md` is then moot.
- Update `packages/cli/forbidden-strings/README.md`, whose Local (hk) and GitHub Actions hk-check sections are
  already stale relative to the live CI workflow.
- Update the hk and pkl references in `docs/todo/forbidden-strings.md` and `docs/planning/forbidden-strings-em-dash.md`.

## Supply-chain note

Per `mise-aqua-backend.md`, hk is digest-verified only, because mise does not implement
`github_release_attestations`, the key hk's registry entry relies on.
Retiring hk and pkl removes that under-verified surface from the toolchain.
forbidden-strings, by contrast, is built in-repo and distributed to CI with SLSA provenance,
so consolidating onto it does not inherit hk's gap.

## References

- `packages/cli/git/README.md` and `packages/cli/git/src/index.ts`: the current wrapper and its RULES pipeline.
- `oxlint.config.ts`, `packages/config/oxlint`, `packages/oxlint-plugins/tsdoc`, and `ensureOxlintConfig` in
  root `mise.toml`: the model and the ahead-of-time build machinery it reuses.
- `hk.pkl`: the current hk config (forbidden-root-context and forbidden-strings on pre-commit, pre-push, check).
- `.github/workflows/forbidden-strings.yml`: the CI gate, already off hk.
- `mise-aqua-backend.md`: hk's supply-chain posture.

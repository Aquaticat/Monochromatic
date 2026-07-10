# Wrong-repository Git identity defense plan

## Status

Planning in progress on 2026-07-09.

The failure has been diagnosed and future identity restored.
This plan records the defense-in-depth work that remains.
No prevention code or remote protection change has been implemented yet.

## Goal

Make the July 9 failure stop at several independent boundaries before it can alter or publish repository history.

The failure chain was:

1. Pi 0.80.6 accepted an unsupported `cwd` property in a Bash tool call.
2. The Bash implementation ignored that property and ran the command from the session directory.
3. Fixture `git init` and `git config user.*` commands ran in the main Monochromatic repository.
4. Repository-local fixture identity overrode the intended global identity.
5. Git continued to create cryptographically signed commits under `fixture@example.invalid`.
6. GitHub classified those signatures as `no_user` because the commit identity was not associated with a user.
7. Classic branch protection required verified signatures but exempted administrators, so the owner could publish them.

The design must enforce these invariants:

- Unsupported Bash tool properties fail before shell execution.
- Reinitializing an existing repository fails before Git changes state.
- Automated Git invocations cannot write protected identity or signing configuration.
- A contaminated commit environment fails before commit.
- Any contaminated or unverifiable commit fails before push.
- GitHub rejects unverifiable commits even when the pusher administers the repository.
- Force pushing cannot replace protected history.

The design fixes future operations only.
It does not rewrite earlier commits.

## Confirmed current state

### Pi execution boundary

Pi 0.80.6 validates known Bash properties but preserves unknown properties.
`dist/core/tools/bash.js` executes only the command and timeout values,
so the unsupported `cwd` property has no effect.

`packages/pi-plugins/guardrail/src/index.ts` already owns the deterministic `tool_call` refusal seam.
Its Bash rule in `packages/pi-plugins/guardrail/src/bash-guard.ts` currently detects only `bun test`.
The package is documented for global installation,
but `/home/user/.pi/agent/settings.json` does not currently install it.
Project `.pi/settings.json` intentionally has no packages.

`packages/pi-plugins/auto-mode` is installed globally,
but it is not an invariant layer:
it reasons about command text and permits explicit bypass.

### Git command boundary

`packages/cli/git/src/index.ts` evaluates a pre-spawn rule pipeline before invoking real Git.
That is the deterministic seam for command-level repository safeguards.

Current gaps include:

- `packages/cli/git/src/rules/require-root.ts` exempts `git init`.
- No rule rejects reinitialization of an existing worktree.
- No rule rejects writes to `user.name`, `user.email`, or signing configuration.
- No rule checks the effective author or committer identity before commit.
- The wrapper auto-pushes a successful `git commit` without first verifying the created commit artifact.

### Hook boundary

`hk.pkl` has `pre-commit` and `pre-push` hooks.
They currently enforce final-newline and forbidden-root-context policies,
not Git identity or signature policy.

The repository pins hk 1.50.0.
That version exposes Git pre-push standard input as `{{ hook_stdin }}` and can forward it through a step's `stdin` field.
Git provides one line per pushed ref containing local ref,
local object ID,
remote ref,
and remote object ID.
This is the correct seam for computing the exact outgoing commit set.

### Identity and server boundary

The effective identity is currently `Aquaticat <an@aquati.cat>`.
The effective signing configuration is global:

- `commit.gpgSign=true`
- `gpg.format=ssh`
- `user.signingKey=/home/user/.ssh/github_sign.pub`
- `gpg.ssh.allowedSignersFile=/home/user/.ssh/allowed_signers`

GitHub classic branch protection for `main` currently has:

- required signatures enabled;
- administrator enforcement disabled;
- force pushes enabled.

The separate `Copilot review` ruleset has no bypass actors,
but it enforces only Copilot review and does not repair the signature-protection gap.

## Chosen architecture

Use a deep repository-safety module with thin adapters at Pi,
Git invocation,
Git hook,
and GitHub boundaries.

### Module interface

The implementation home is `packages/cli/git/src/repository-safety/`.
It exposes three concepts:

```ts
assertSafeGitInvocation({ args, cwd })
assertSafeCommitEnvironment({ cwd })
verifyOutgoingCommits({ cwd, remote, pushInput })
```

The interface stays small while hiding:

- Git global-option and subcommand parsing;
- effective target-directory resolution;
- repository and worktree discovery;
- Git configuration scope and origin parsing;
- trusted committer lookup;
- allowed-signers parsing;
- push-input parsing;
- revision-range expansion and deduplication;
- cryptographic commit verification;
- diagnostic formatting.

A command-line adapter in the same package exposes the commit-environment and pre-push operations to hk.
The existing `git` wrapper calls the TypeScript interface directly.

### Trusted identity source

Do not hardcode `Aquaticat` in source.
Provision one or more exact trusted committer identities in global Git configuration under a dedicated key,
for example:

```sh
git config --global --add monochromatic.allowedCommitter 'Aquaticat <an@aquati.cat>'
```

The safety module reads the global scope explicitly,
not the effective scope,
so repository-local configuration cannot replace the allowlist.

The configured SSH allowed-signers file remains the trust source for principal-to-key verification.
The committer email must appear as a principal in that file.
This supports key rotation and multiple trusted identities without repository source edits.

The author may differ from the committer for imported or cherry-picked work.
The policy therefore requires the committer,
not every historical author,
to match the trusted local identity.
GitHub's vigilant-mode documentation likewise distinguishes author from committer when evaluating signed commits.

## Prevention layers

### Layer A: fail closed on unsupported Bash input

Extend `packages/pi-plugins/guardrail` so Bash tool-call input is shape-checked before any command policy.

Accepted top-level properties for the current Pi Bash tool are:

- `command`
- optional `timeout`

Any other property blocks the call.
A `cwd` rejection explains that Pi 0.80.6 does not support the property and requires either:

- `cd -- <absolute-target> && <command>`; or
- a command-native directory argument such as `git -C <absolute-target>`.

The strict local copy is intentionally fail-closed.
If a future Pi release adds a real Bash property,
the guardrail must be updated and verified before that property is accepted locally.

After building and testing the package,
install `packages/pi-plugins/guardrail` in `/home/user/.pi/agent/settings.json` as documented in its README.
Keep project `.pi/settings.json` package-free.

### Layer B: reject dangerous Git invocations before spawn

Add non-bypassable rules to the existing `packages/cli/git` rule pipeline.

#### Existing-repository initialization

Reject `git init` when its effective target is:

- an existing repository or worktree root; or
- nested inside an existing worktree.

Resolve global `-C` options,
the optional `git init <directory>` operand,
relative paths,
symlinks,
and nonexistent target paths through their nearest existing parent.

Allow initialization only outside an existing repository.
Fixture setup remains supported by creating a disposable directory first and invoking Git there.

#### Protected configuration writes

Reject writes through the wrapper to these keys at every scope:

- `user.name`
- `user.email`
- `user.signingKey`
- `commit.gpgSign`
- `gpg.format`
- `gpg.ssh.allowedSignersFile`
- `monochromatic.allowedCommitter`

Cover legacy `git config <key> <value>` syntax and current `get`,
`set`,
`unset`,
`rename-section`,
and `remove-section` forms.
Read operations remain allowed.
Removal of repository-local protected values is allowed only through a dedicated repair operation that reports exactly
which origin and scope it will remove.

These rules have no routine bypass flag.
Changing trusted identity is an explicit administrative operation performed with the real Git binary after inspection,
not an automated wrapper operation.

### Layer C: validate the environment before commit

Add an hk `pre-commit` step backed by `assertSafeCommitEnvironment`.
It runs before file-oriented steps and checks repository metadata only.

The check rejects when:

- any protected identity or signing key exists at local or worktree scope;
- `git var GIT_COMMITTER_IDENT` does not exactly match a global trusted committer;
- the committer email is not a principal in the configured allowed-signers file;
- `commit.gpgSign` is not true;
- `gpg.format` is not `ssh`;
- `user.signingKey` or `gpg.ssh.allowedSignersFile` is absent or unreadable.

It reports each offending key with the scope and origin returned by Git.
It does not edit configuration automatically.

Add the same preflight directly to the wrapper before every command that can create a commit,
including `commit`,
merge commands that can create merge commits,
cherry-pick,
revert,
and sequencer continuation commands.
The hook remains necessary for direct real-Git and GUI callers.

### Layer D: verify created and outgoing commit artifacts

After a wrapped `git commit` succeeds,
verify `HEAD` before the existing auto-push path runs.
A failed verification leaves the commit local and returns a nonzero result.

Add an hk `pre-push` step that forwards `{{ hook_stdin }}` to `verifyOutgoingCommits`.
For every ref update:

- skip deletions;
- derive commits reachable from the local object but not the remote object;
- for a new remote ref,
  exclude commits already reachable from that remote's refs;
- deduplicate commits across ref updates;
- require the committer identity to match the trusted global allowlist;
- run `git verify-commit` for every outgoing commit;
- require the verified SSH principal to match the commit's committer email.

This covers normal pushes,
new branches,
multiple refspecs,
merge commits,
and non-fast-forward attempts.
Annotated-tag behavior must be tested separately:
commit objects reachable from a tag are checked,
and tag-signature policy remains out of scope unless the implementation discovers that Git's input requires a combined
commit-and-tag verifier.

The wrapper's direct post-commit check improves error locality.
The pre-push hook is the broader boundary for direct Git,
GUI clients,
merge commits,
and batches of existing commits.

### Layer E: make the server authoritative

Change classic branch protection for `main` only after local layers pass their disposable fixtures:

- keep required signed commits enabled;
- enable administrator enforcement;
- disable force pushes;
- keep branch deletion disabled.

Do not add a bypass actor for identity or signature enforcement.
This is the final boundary for clients that skip hooks,
invoke a different Git binary,
or pass `--no-verify`.

A later migration from classic protection to one consolidated ruleset is reasonable,
but it is not required for this incident.
Changing the two existing classic-protection fields has less migration risk and is easier to roll back independently.

## Observability and repair

Every rejection states:

- violated invariant;
- repository root;
- offending command,
  configuration origin,
  or commit object ID;
- safe next action.

Do not log private-key contents or full environment values.
Public signing-key fingerprints and allowed-signers paths are safe to report.

Add a read-only diagnostic command to the cli-git package that prints:

- resolved repository root;
- effective and trusted committer identities;
- protected Git configuration scopes and origins;
- signing mode and public-key fingerprint;
- local verification result for `HEAD`;
- current GitHub protection state when `gh` is available.

The diagnostic command does not repair anything.
A separate narrowly scoped repair command may remove forbidden local or worktree values after showing the exact keys.
It must never rewrite commits.

## Disposable regression matrix

All Git mutations run in temporary repositories or worktrees.
No test writes the main repository's `.git/config`,
refs,
index,
or remote configuration.

### Pi extension fixtures

Use Pi's real extension event path with a deterministic fake model response that requests a Bash tool call.
Verify:

- `{"command":"touch marker","cwd":"/tmp/target"}` is blocked;
- the marker is absent in both session and target directories;
- valid `command` plus `timeout` input reaches the Bash tool;
- an arbitrary future-looking property is blocked;
- the refusal names the unsupported property and directory-safe alternatives.

Run the built-extension load verification in addition to unit tests.

### Git invocation fixtures

Create disposable repositories for:

- bare `git init` while current directory is an existing worktree;
- `git init .` in the root;
- `git init child` under a worktree;
- `git -C <worktree> init`;
- initialization in a new external temporary directory;
- protected identity writes using legacy and current config syntax;
- read-only protected config queries;
- explicit cleanup of contaminated local values.

For every rejection,
hash repository config and refs before and after and require byte equality.

### Commit-environment fixtures

Use isolated `HOME`,
`GIT_CONFIG_GLOBAL`,
and SSH keys.
Cover:

- trusted global identity with no local override;
- local name override;
- local email override;
- worktree-scope override;
- fixture email with a cryptographically valid signature;
- missing signing mode;
- wrong signing key;
- missing allowed-signers file;
- untrusted principal;
- distinct trusted author and committer;
- merge,
  cherry-pick,
  revert,
  and sequencer continuation paths.

A rejected pre-commit fixture must leave `HEAD`,
index,
worktree,
and configuration byte-identical.

### Pre-push fixtures

Push to disposable bare remotes with forwarded native pre-push input.
Cover:

- one valid signed commit;
- one valid signature under an untrusted committer;
- one unsigned commit;
- one bad signature;
- multiple outgoing commits with one bad middle commit;
- new branch;
- multiple refs;
- merge commit;
- deletion;
- non-fast-forward update.

Rejected pushes must leave every remote ref unchanged.
Accepted pushes must update only the requested refs.

### GitHub protection fixture

Verify server behavior against a temporary protected branch carrying the same policy before changing `main`:

- an owner push containing an unverified commit is rejected;
- an owner force push is rejected;
- an owner push containing a valid signed commit succeeds.

Remove the temporary branch after the API state and remote behavior are recorded.
Do not test rejection by pushing a bad commit to `main`.

## Rollout sequence

1. Land strict Bash input validation and Pi extension tests.
2. Build the guardrail and install it in global Pi settings.
3. Start a fresh Pi session and verify a synthetic unsupported-`cwd` tool call is blocked before execution.
4. Land cli-git invocation rules and disposable repository tests.
5. Provision the global trusted-committer entry.
6. Land the shared commit-environment checker and hk pre-commit adapter.
7. Land direct post-commit verification and the hk pre-push adapter.
8. Run the full disposable commit and push matrix.
9. Run package lint,
   type checking,
   unit tests,
   build,
   and end-user wrapper and hook verification through mise tasks.
10. Verify a normal signed checkpoint commit remains local until the post-commit verifier succeeds.
11. Test the proposed GitHub policy on a temporary protected branch.
12. Enable administrator enforcement and disable force pushes on `main`.
13. Query GitHub protection through the API and verify the exact final fields.
14. Confirm subsequent pushed commits report GitHub verification reason `valid`.
15. Update this plan's status and measured results.

Commit each repository change at the earliest scoped checkpoint.
Stage only explicit task paths so concurrent changes are never swept into a commit.

## Rollback

Rollback is per layer,
not all-or-nothing:

- Pi guardrail false positive:
  remove the global package entry or revert only the strict-input rule,
  then restart Pi.
- cli-git false positive:
  revert the specific invocation rule while retaining identity and push verification.
- hk false positive:
  remove only the named identity step from that hook while retaining wrapper and server enforcement.
- GitHub policy blocks an intended workflow:
  restore the previous administrator-enforcement or force-push field through the API,
  without changing commit history.

Never roll back by disabling every layer at once.
Record any bypass or rollback with actor,
time,
reason,
and restored safeguard.

## Rejected shortcuts and ranking

1. Full defense in depth,
   as designed in this plan.
   Pros:
   the failure stops before execution,
   before Git mutation,
   before commit,
   before push,
   and at the server;
   each layer covers bypass of the preceding layer.
   Cons:
   more implementation and fixture work,
   plus explicit identity onboarding.
2. Git and server enforcement without Pi validation.
   Pros:
   protects history and requires less Pi-specific code.
   Cons:
   unsupported tool input can still mutate unrelated working state before Git notices.
3. Pi guardrail or prompt rules alone.
   Pros:
   fastest initial change and clearest immediate diagnostic.
   Cons:
   extensions can be absent or bypassed,
   and no independent boundary prevents publication.

Ranking:
full defense in depth is preferred over Git-only because it prevents the wrong-directory mutation itself;
Git-only is preferred over Pi-only because hooks and server protection still cover alternate clients and publication.

## Acceptance criteria

The work is complete only when:

- unsupported Bash properties cannot reach shell execution;
- the guardrail is active in a fresh real Pi session;
- reinitialization and protected config writes leave disposable repository state byte-identical;
- contaminated identity fails before a commit is created;
- a created bad commit cannot reach the wrapper's auto-push path;
- pre-push rejects every fixture containing an untrusted identity or unverifiable commit;
- valid signed commits still commit and push through user-facing commands;
- `main` protection enforces signatures for administrators and forbids force pushes;
- an owner cannot publish an unverified fixture commit to a temporary protected branch;
- package linting and type checks report zero errors or warnings;
- every exported policy branch has a passing test;
- documentation matches installed configuration and observed behavior;
- earlier commits remain unchanged.

## References

- Incident diagnosis:
  `docs/troubleshooting/pi-bash-ignored-cwd-git-signature-verification.md`
- Pi guardrail:
  `packages/pi-plugins/guardrail/README.md`
- cli-git entry point:
  `packages/cli/git/src/index.ts`
- cli-git root rule:
  `packages/cli/git/src/rules/require-root.ts`
- Hook configuration:
  `hk.pkl`
- hk hook behavior:
  <https://hk.jdx.dev/hooks.html>
- hk pre-push standard-input support:
  <https://github.com/jdx/hk/pull/825>
- GitHub commit signature verification:
  <https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification>

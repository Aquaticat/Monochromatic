# git-policy-cli-fuzz

Coverage-guided checks for the native cli-git wrapper's pure boundaries.
The subject is `package/git-policy/cli/src/native`;
nothing here starts Git or touches a repository.

## Targets

### `global_arguments`

Runs `global_layout` over two views of every input:
the bytes split at NUL into arguments,
and the bytes mapped to real Git option,
command,
and boundary tokens.
It checks that the arguments are unchanged,
that the result is repeatable,
that the boundary token has the kind the outcome claims,
that the global prefix alone names no command,
and that nothing after a decided boundary changes the result.

### `config_loading`

Runs `classify_config_loading` over the same two views.
Skipping configuration skips policy,
so it checks that only native queries,
option errors,
and an independently restated list of inspection commands skip,
that an absent or unknown command never skips,
and that any `branch` or `tag` invocation gaining a mutating flag in first position requires configuration.

### `config_schema`

Builds a valid `cli-git.config.jsonc` document from every input together with the settings it must parse to,
and compares the schema's result with that expectation.
Inputs that are UTF-8 are also parsed as written.
An accepted document must satisfy the registry-order and bound invariants
and survive being restated canonically.
A rejection must render as one `config-invalid` JSON line that decodes back to the same message.

### `wrapper_controls`

Runs wrapper-control removal and the wrapped-command lifecycle over four views of every input:
the bytes split at NUL into arguments,
the bytes mapped to commands,
Git options,
separators,
value options,
every wrapper control and hatch,
and near-misses of their spellings,
a `<command> <valueless options> -- <tokens>` list whose `--` is certainly Git's separator,
and the same tokens behind a first byte that selects a linked worktree or no repository
and the answers to the repository questions.
Removal must leave its input unchanged and be repeatable,
delete only whole tokens that spell a control or the commit hatch,
record exactly the effects the deleted tokens asked for,
find nothing more on a second pass,
and keep everything from the separator on.
The lifecycle runs with fixed repository answers and locations that do not exist on disk,
so it reads no configuration and starts no Git.
Whatever the arguments,
a forwarded command must not be a `git commit` without a dry-run or status-format option,
a `git push` without a dry-run option while the built-in content policy is on,
a `git add` in a worktree while that policy is on,
or a worktree creation or possible alias run from a linked worktree without `--no-worktree-copy`.
The dry-run options are restated from Git's documentation instead of read from the subject's tables.

## Controls

`mise run //package/git-policy/cli.fuzz:test` runs the generator controls.
They count that the generators reach every layout outcome,
both loading decisions,
non-default accepted configurations,
every way a command region is read,
every control effect,
a control spelling that survives as a value or path,
and every ending of the lifecycle,
so an invariant that is never reached cannot pass unnoticed.

`mise run //package/git-policy/cli.fuzz:test:planted` proves the invariants can fail.
It copies the subject and this package to a temporary directory,
plants one defect at a time
(a mutating `branch` letter accepted as presentation,
a bare `git` skipping configuration,
an unconsumed global option value,
`warn` read as `error`,
a rejected `landing` section,
a control spelling removed anywhere in a region read without a table,
keep-going removed without being recorded,
a forwarded real commit,
a publishing push that skips the manual-push gate),
and requires a generator control to fail for each.
Results are retained under `target/verification/planted-*`.
Removing a flag from a mutation list alone is not a usable plant:
unlisted `branch` and `tag` flags already require configuration.

The `fuzz_target!` input looks like a closure signature but is macro input grammar.

## Campaigns

`mise run //package/git-policy/cli.fuzz:smoke` builds AddressSanitizer targets with the read-only nightly compiler,
runs the controls and Clippy in the same bounded container,
then fuzzes each target for 30 seconds without host mounts
under 2 GiB,
2 CPUs,
128 PIDs,
and a 4,096-byte input limit.
A target must exit 0 and report at least one executed unit.
Corpora,
artifacts,
and logs are retained under `target/verification/campaign-*`.

Retain and replay minimized failures,
and convert them into deterministic tests beside the subject.
These targets do not cover real-Git resolution,
forwarding,
configuration file reading,
repository facts read from Git,
leftover transaction state on disk,
or the management grammar.

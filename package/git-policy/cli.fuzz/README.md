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

### `batch_reply`

Runs `read_batch_reply`,
the reader of one `git cat-file --batch` reply,
over two views of every input:
the bytes split at the first line feed into a request and a raw stream,
and the bytes mapped to a built reply together with the outcome it must have
(a canonical reply,
a missing notice,
a reply for another object,
content shorter or longer than declared,
a stream that ends early,
an overlong header,
or a header Git never prints).
Reply content is file content,
so it may imitate a reply.
It checks that reading is repeatable,
that an accepted reply is byte for byte Git's canonical rendering of the returned value,
that a reply to a request by name names that object,
that bytes after the reply change nothing,
that no sampled proper prefix of an accepted reply is accepted,
and that a refusal is one of the four reply failures.
The target reads in-memory bytes only;
the process that produces real replies is controlled beside the subject.

## Controls

`mise run //package/git-policy/cli.fuzz:test` runs the generator controls.
They count that the generators reach every layout outcome,
both loading decisions,
non-default accepted configurations,
and every reply kind and reply failure,
so an invariant that is never reached cannot pass unnoticed.

`mise run //package/git-policy/cli.fuzz:test:planted` proves the invariants can fail.
It copies the subject and this package to a temporary directory,
plants one defect at a time
(a mutating `branch` letter accepted as presentation,
a bare `git` skipping configuration,
an unconsumed global option value,
`warn` read as `error`,
a rejected `landing` section,
object content accepted past its declared size,
a reply accepted for another object),
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
or the management grammar.

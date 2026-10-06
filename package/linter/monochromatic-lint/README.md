# monochromatic-lint

Rust replacement for the repository's Rust and Markdown/MDX linters.
The `monochromatic-lint` executable is verified in containers
and published to crates.io with prebuilt release binaries,
so `cargo binstall monochromatic-lint` installs it without compiling.
In the Monochromatic repository it replaces `package/linter/rust` and `package/cli/markdown-lint`;
the switch of every repository task and the Git wrapper's Markdown policy is recorded in
`doc/handover/unified-linter-cutover.md`.

The crate's Rust visibility supports its executable and verification drivers.
There is no supported public linter library interface.

Design:
`doc/planning/unified-linter.md`.
Execution:
`doc/handover/cli-git-rust-implementation.md`.
Executable evidence,
open decisions,
and the comparison with both earlier linters:
`doc/handover/unified-linter-executable.md`.

## Command line

```sh
monochromatic-lint [OPTIONS] [PATH]...
```

With no path the working directory is walked,
honoring `.gitignore`.
Files ending in `.rs`,
`.md`,
and `.mdx` are linted;
other files are skipped.
`mise run //package/linter/monochromatic-lint:run -- <arguments>` builds and runs the executable from source.

Findings are JSON Lines on standard output,
one record per finding,
with the rule identifier in `code`.
A clean run prints nothing.
Messages that are not findings go to standard error with a `monochromatic-lint:` prefix.

Exit statuses:

- `0`:
  no error finding,
  and the warning count is within `--max-warnings`.
- `1`:
  at least one error finding,
  or more warnings than `--max-warnings` allows.
- `2`:
  the run could not be trusted to be complete:
  a usage error,
  an unreadable or invalid configuration,
  no configuration for any input file,
  or a `core/processing-failure` or `core/fix-refused` finding.

Options:

- `--config <FILE>` uses exactly that configuration for every file,
  with patterns relative to the working directory.
- `--fix` applies fixes in at most ten passes per file and rechecks the result.
  A file is replaced atomically and keeps its mode.
- `--stdin` with `--stdin-filename <FILE>` lints standard input as that file.
  With `--fix` the fixed source goes to standard output and findings go to standard error.
- `--max-warnings <COUNT>`,
  `--quiet`,
  and `--silent` change reporting and the warning threshold,
  never what is linted.
- `--print-config <FILE>` prints the effective rules for one file as strict JSON.
- `--init` writes a starter configuration and refuses to overwrite one.
- `--rules` lists every shipped rule as JSON Lines.
- `--concurrency <COUNT>` bounds worker threads.
  Every file is linted on a thread with an 8 MiB stack,
  including a single file,
  `--concurrency 1` and standard input,
  so how deeply nested a file may be does not depend on the platform's main-thread stack.
- `--ignore-pattern <GLOB>`,
  `--ignore-path <FILE>`,
  and `--no-ignore` change which files the walk finds.
- `--no-error-on-unmatched-pattern` accepts a path argument that matches nothing.
- `--debug` adds execution notes on standard error,
  including every file selected or ignored.

## Configuration

Each file is governed by the nearest `monochromatic-lint.config.jsonc` in its directory or an ancestor,
unless `--config` names one.
A configuration is an ordered JSONC array of blocks with `files`,
`ignores`,
and `rules`.
Every block whose patterns select a file contributes its rule settings,
merged in order.

The merge is handwritten for ordered JSONC rule settings.
Records merge by decoded key,
arrays concatenate,
and a kind mismatch anywhere in an input group selects the final value.
Inputs are not modified.
This is not a generic JavaScript deepmerge port.

## Embedded sources

Processors are always on.
Fenced Rust in Markdown and MDX,
rustdoc comments in Rust,
and doc tests inside rustdoc are linted as virtual files named under their host,
such as `guide.md/3.rs` and `lib.rs/12.md/1.rs`.
Configuration patterns select virtual files by those names.
Findings and fixes are reported at host positions.
A fix that cannot be mapped back to the host is dropped and its finding is kept.

## Anonymous Rust functions

The new `rust/no-anonymous-functions` rule rejects parsed closure expressions,
including closures assigned to named variables,
nested closures,
and `move`,
`async`,
and `const` closures.
Named functions,
methods,
function pointers,
and async blocks are not closures and remain allowed.

The rule emits no automatic fix:
extracting a closure with captured state can require changing its caller.
The syntax frontend does not expand macros;
closures hidden inside macro token trees are outside this check's current coverage.

Select the rule explicitly in the ordered JSONC configuration:

```jsonc
// monochromatic-lint.config.jsonc
[
  {
    "files": ["**/*.rs"],
    "rules": {
      "rust/no-anonymous-functions": { "severity": "error" }
    }
  }
]
```

`mise run //package/linter/monochromatic-lint:test:rust-style` verifies this rule.

## Explicit Rust types

`rust/require-explicit-types` uses resolved Rust declarations and inferred types,
not method-name guesses.
It checks missing binding annotations,
generic arguments,
and nameable inferred `_` placeholders.
A function item's unnameable type can retain `_`;
that does not exempt a nameable enclosing reference or aggregate type.
Unresolved coverage produces an explicit processing failure rather than a clean result.

Use named callbacks with the anonymous-function rule:

```rust
//! Named callbacks satisfy the anonymous-function rule.
// src/main.rs

/// Return one user's name for the `map` call.
fn user_name(user: &User) -> String {
    return user.name.clone();
}

let names: Vec<String> = users
    .iter()
    .map::<String, _>(user_name)
    .collect::<Vec<String>>();
```

The semantic engine requires an existing Cargo workspace file and installed matching `rust-src`.
It does not install toolchains or fetch dependencies.
The host chooses source-only or generated-source preparation;
repository JSONC cannot provide executable commands.
Syntax-only rules do not load a Cargo workspace.
The executable prepares workspaces source-only:
it reads source and Cargo metadata and generates nothing,
so a definition that only a build step would produce is reported as a processing failure.
Files that select this rule are checked on one thread after the other files.

## Native Markdown rules

Implemented checks cover heading increments,
single top-level titles,
duplicate headings within textual ancestor scopes,
emphasis-only headings,
trailing heading punctuation,
prompt-only shell examples,
fence languages,
bare URLs,
shortcut-reference style,
and unused/duplicate reference definitions.
The rules share one native Markdown/MDX parse and retain authored UTF-8 byte ranges.
MDX expression,
JSX,
and ESM subtrees are not prose-rule inputs.

Fixes preserve surrounding authored syntax.
Punctuation edits consume complete escapes and character references.
Prompt removal preserves LF,
CRLF,
and bare CR.
Reference-definition deletion keeps adjacent container lines separate.
The grouped editor refuses a nonempty-to-empty file rewrite.

Pipe-table conversion and semantic line breaks are implemented.
Production Rust and Markdown commands have not been replaced.

## LFS image URLs

`markdown/lfs-image-url` rewrites a relative image link to an LFS-tracked file
into the object URL built from the repository's `.lfsconfig` endpoint,
and reports an object URL whose target is missing or stale.
The repository root is the nearest ancestor holding `.lfsconfig`;
tracked paths come from the root `.gitattributes`.
The `exclude` option takes gitignore-syntax patterns relative to that root.

Endpoint normalization is one standard-library function,
`lfs_object_base`,
with a restricted contract:
`http` or `https`,
an ASCII host name,
an optional decimal port,
and a path without dot segments.
Any other endpoint is rejected with a named reason that never echoes the endpoint,
because it may hold credentials.
One rejected declaration fails the whole read.

## Verification

Package tasks cover type checking,
unit tests,
and mount-free container tests.
`lint:container` runs the library tests,
the black-box tests of the built executable in `src/binary_tests.rs`,
and Clippy inside a bounded container.
Consumer migration and mutation-survivor disposition gates are tracked in the execution document;
their absence is not a completion claim.
`mutation:markdown` runs full container tests and Clippy before scoped native Markdown mutation.
`mutation:executable` does the same for the orchestration modules,
the executable's entry point,
Rust rule selection,
input expansion and the fix loop;
`mutation:core` for configuration,
findings,
grouped edits and the syntax-only Rust rules;
`mutation:semantic` for the semantic engine and the explicit-type rule;
and `mutation:processors:files` for the processor modules.
The executable and core scopes skip the four tests that load a Cargo workspace,
which the semantic scope and the full container tests run.
The semantic scope has its own per-mutant limit,
and any campaign accepts `-- --shard k/n` (zero-based,
as in cargo-mutants) so that its shards can run in separate bounded containers at once.
`mutation:coverage` compares the scopes' listings with the unscoped listing,
name by name,
and fails when any mutant is outside every scope.
A campaign with a missed or timed-out mutant exits nonzero and is not a passing gate.

Two kinds of mutation are never tried,
by the repository owner's decision of 2026-10-05.
Every cargo-mutants invocation of this package passes these patterns,
each as its own `--exclude-re` argument:

- `replace \+= with \*=`
- `replace -= with /=`

Both replacements leave a counter unchanged,
so a loop that steps its own index never ends,
and cargo-mutants 27.1.0 exits with its timeout status whenever any mutant times out.
`+=` replaced by `-=`,
and `-=` replaced by `+=`,
still test every counter.

The fuzz sidecar includes counted Markdown/MDX fixtures,
raw source,
reparsing of accepted fixed output,
and an `orchestration` target that drives the executable's per-source path
through nested doc tests and adversarial edit groups.
Evidence belongs to its recorded source snapshot;
new source does not inherit a previous campaign's completion status.

## License

LGPL-3.0-or-later.
License texts are in `LICENSES/`.

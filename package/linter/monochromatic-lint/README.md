# monochromatic-lint

Rust replacement for the repository's Rust and Markdown/MDX linters.
Implementation is in progress;
the existing tools remain active until consumer verification and cutover.

The first implementation slice is the handwritten merge for ordered JSONC rule settings.
Records merge by decoded key,
arrays concatenate,
and a kind mismatch anywhere in an input group selects the final value.
Inputs are not modified.
This is not a generic JavaScript deepmerge port.

The crate's Rust visibility supports its executable and verification drivers.
There is no supported public linter library interface.

Design:
`doc/planning/unified-linter.md`.
Execution:
`doc/handover/cli-git-rust-implementation.md`.

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

The rule implementation and schema entry exist;
the new executable and production cutover remain unfinished.
`mise run //package/linter/monochromatic-lint:test:rust-style` verifies this slice
without claiming that unfinished Markdown adapters have passed.

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
// src/main.rs
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
These internal APIs and their consumer tests exist,
but command-line orchestration is still unfinished.

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

Pipe-table conversion,
semantic line breaks,
LFS image URLs,
embedded Rust/rustdoc processors,
and the complete executable remain in progress.
Production Rust and Markdown commands have not been replaced.

## Verification

Package tasks cover type checking,
unit tests,
and mount-free container tests.
The remaining CLI,
rule,
processor,
mutation,
and fuzz gates are tracked in the execution document;
their absence is not a completion claim.
`mutation:markdown` runs full container tests and Clippy before scoped native Markdown mutation.
The fuzz sidecar includes counted Markdown/MDX fixtures,
raw source,
and reparsing of accepted fixed output.
Evidence belongs to its recorded source snapshot;
new source does not inherit a previous campaign's completion status.

## License

LGPL-3.0-or-later.
License texts are in `LICENSES/`.

# Explicit Rust annotations

## Accepted scope

On 2026-10-04,
the user requested explicit Rust annotations,
including declaration types and generic arguments at call sites.
They then banned anonymous Rust functions,
superseding the initial inline-closure example with a named callback.

The user selected option A:
full semantic enforcement for `rust/require-explicit-types`,
not a syntax-only approximation.
This supersedes the prior no-semantic-analysis restriction for this rule.
The anonymous-function rule remains separately configurable as `rust/no-anonymous-functions`.

Requirements:

- Require declaration annotations.
- Require explicit generic arguments on resolved generic calls,
  not a guessed list of method names.
- Preserve `_` for unnameable function-item types,
  as in `.map::<String, _>(user_name)`.
- Do not demand generic arguments on nongeneric calls such as the resolved `iter()` or `clone()`.
- Expose missing semantic context for standalone snippets instead of counting unresolved calls as verified.
- No automatic type or capture rewrites without evidence that the rewrite preserves behavior.
- Keep the existing production tools active until the native executable is ready.

## Current implementation boundary

The anonymous-function checker is implemented in
`package/linter/monochromatic-lint/src/rust_no_anonymous_functions.rs`.
Its focused container,
mutation,
and initial ASAN fuzz gates passed.
Executable integration remains unfinished.

The explicit-types checker is not implemented yet.
The first investigation extends the already selected rust-analyzer frontend.
No additional semantic dependency has been added to the production manifest.

## Existing frontend source inspection

The installed `ra_ap_syntax` 0.0.335 package records upstream revision
`c5d30e2331acb2cec913a086ab242591f4f367a5`,
with a dirty publication marker.
A read-only source checkout is at
`~/temp/agent/rust-analyzer-semantics-20261004`.
Published semantic-package sources must be compared before API use;
the checkout alone does not establish identical published artifacts.

Source observations from that revision:

- `crates/load-cargo/src/lib.rs:41-78` exposes workspace loading configuration.
  Enabling build-script loading runs Cargo build scripts;
  build-script error details are logged and the loader continues.
  The linter must not mistake that continuation for complete semantic information.
- `crates/load-cargo/src/lib.rs:112-143` can start a proc-macro server.
  This is an execution boundary,
  not just reading Cargo metadata.
- `crates/load-cargo/src/lib.rs:529-542` loads UTF-8 text without newline normalization.
  Non-UTF-8 files are omitted there;
  the linter needs its own explicit input/setup errors.
- `crates/hir/src/semantics.rs:472-502` parses files through the semantic database
  and records their roots.
  Separately parsed syntax nodes cannot simply be passed as if they belonged to that semantic context.
- `crates/hir/src/lib.rs:3841-3890` enumerates declaration generic parameters.
- `crates/hir/src/lib.rs:4431-4441` distinguishes implicit parameters,
  including argument-position `impl Trait`,
  from explicitly declared parameters.
- `crates/hir/src/semantics.rs:1812-1825` exposes callable and method resolution.
  The fallback method API also supplies substitutions.
- `crates/hir/src/lib.rs:3984-4037` exposes named substituted types.
  Test parameters mixed with lifetimes and constants before relying on their association.
- `crates/hir/src/semantics.rs:1904-1911` warns that its callable method helper
  does not resolve to the correct trait implementation.
  Do not ignore that warning when selecting the API.
- `crates/hir/src/lib.rs:6641-6675` distinguishes function items from function pointers,
  tuple constructors,
  closures,
  and callable implementations.

## Next implementation probes

A private dependency-fetch-only Cargo fixture is at
`~/temp/agent/monochromatic-semantic-probe-20261004`.
Its first fetch requested 0.0.335 to match production syntax,
but Cargo could not select that HIR release.
The fresh sparse index contains 292 HIR versions and no 0.0.335 entry;
0.0.334 and 0.0.336 are present and not yanked.
The direct crates.io HTTP probe returned 403,
and the corresponding docs.rs page returned 404.

The fixture now fetches synchronized 0.0.336 semantic packages,
with the already required Unicode 17 pins.
That fetch passed.
The installed HIR package records upstream revision
`7ea2b259ca3fa0e97d0e8e2ec4c3f902f049cd76`,
also with a dirty publication marker.
`mise run inspect` counted 198 packages in the full dependency metadata
and listed their build-script entry points before any compilation.
No semantic code has run yet;
production remains on syntax 0.0.335.

Verify with disposable fixtures:

- Generic and nongeneric methods sharing the name `parse`.
- Aliased imports and fully qualified calls.
- Trait and inherent methods.
- Named callback function items versus function pointers.
- Lifetimes,
  const generics,
  defaults,
  and implicit `impl Trait` parameters.
- Missing Cargo context,
  missing dependencies,
  build-script failures,
  disabled conditional code,
  and unsupported macro resolution.
- UTF-8 byte ranges,
  CRLF,
  stdin overlays,
  and virtual snippet boundaries.

Container bounds remain 2 GiB and 2 CPUs.
Do not run unbounded semantic-analysis stress tests on the host.

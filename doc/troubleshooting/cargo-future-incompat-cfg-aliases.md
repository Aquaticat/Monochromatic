# Cargo 1.99 nightly: cfg_aliases 0.2.1 causes dependency future-incompatibility warnings

Tool:
 Cargo 1.99.0-nightly (`3efb1f477 2026-07-17`) and rustc 1.99.0-nightly
(`0e29c21d9 2026-07-21`).
Surface trigger:
 building `package/music-player/desktop-app` with its lockfile resolving
`cfg_aliases` 0.2.1,
 then running `cargo report future-incompatibilities`.
Failure mode:
 Cargo reports 488 instances of
`trailing semicolon in macro used in expression position`
across seven dependencies.

## Symptom

The report names these packages:

- `glutin-winit` 0.5.0:
  123 warning instances.
- `glutin` 0.32.3:
  135 warning instances.
- `i-slint-backend-selector` 1.17.0:
  8 warning instances.
- `i-slint-backend-testing` 1.17.0:
  15 warning instances.
- `i-slint-backend-winit` 1.17.0:
  95 warning instances.
- `turso_core` 0.6.1:
  21 warning instances.
- `winit` 0.30.13:
  91 warning instances.

Every instance has the same diagnostic:

```text
warning: trailing semicolon in macro used in expression position
= warning: this was previously accepted by the compiler but is being phased out; it will become a hard error in a future release!
= note: for more information, see issue #79813 <https://github.com/rust-lang/rust/issues/79813>
= note: this warning originates in the macro `$crate::cfg_aliases`
```

The report suggests updating `turso_core` to a 0.7.0 pre-release,
updating `winit` to a 0.31.0 beta,
or notifying each named package's maintainer.
Those suggestions identify the invocation sites,
not the shared defective macro implementation.

This surfaced after rustc PR [#159222][rust-159222] made
`semicolon_in_expressions_from_macros` apply to macros defined in dependency crates.
Rust PR [#159218][rust-159218] proposes completing the transition from a lint to a hard error.

## Root cause

The application lockfile selects the affected macro crate
(`package/music-player/desktop-app/Cargo.lock:1023-1026`):

```toml
[[package]]
name = "cfg_aliases"
version = "0.2.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "613afe47fcd5fac7ccf1db93babcb082c5994d996f20b8b159f2ad1658eb5724"
```

Each package named by Cargo invokes that macro from its build script.
The source locations from the installed crates are:

```rust
// glutin-winit-0.5.0/build.rs:7
cfg_aliases! {

// glutin-0.32.3/build.rs:5
cfg_aliases! {

// i-slint-backend-selector-1.17.0/build.rs:10
cfg_aliases::cfg_aliases! {

// i-slint-backend-testing-1.17.0/build.rs:6
cfg_aliases::cfg_aliases! {

// i-slint-backend-winit-1.17.0/build.rs:8
cfg_aliases! {

// turso_core-0.6.1/build.rs:7
cfg_aliases! {

// winit-0.30.13/build.rs:8
cfg_aliases! {
```

`cfg_aliases` 0.2.1 parses nested `all(...)` and `any(...)` clauses by recursively invoking itself.
Three recursive expression arms add a semicolon to the nested invocation
(`cfg_aliases-0.2.1/src/lib.rs:255-305`):

```rust
(
    @parser_clause
    $op:ident
    [$({$($grouped:tt)+})*]
    [, $($rest:tt)*]
    $($current:tt)+
) => {
    $crate::cfg_aliases!(@parser_clause $op [
        $(
            {$($grouped)+}
        )*
        {$($current)+}
    ] [
        $($rest)*
    ]);
};

(
    @parser_clause
    $op:ident
    [$({$($grouped:tt)+})*]
    [$tok:tt $($rest:tt)*]
    $($current:tt)*
) => {
    $crate::cfg_aliases!(@parser_clause $op [
        $(
            {$($grouped)+}
        )*
    ] [
        $($rest)*
    ] $($current)* $tok);
};

(
    @parser_clause
    $op:ident
    [$({$($grouped:tt)+})*]
    []
    $($current:tt)+
) => {
    $crate::cfg_aliases!(@parser_emit $op
        $(
            {$($grouped)+}
        )*
        {$($current)+}
    );
};
```

The `all(...)` and `any(...)` parser arms consume those recursive expansions as expressions
(`cfg_aliases-0.2.1/src/lib.rs:309-324`):

```rust
(
    @parser
    all($($tokens:tt)+)
) => {
    $crate::cfg_aliases!(@parser_clause all [] [$($tokens)+])
};

(
    @parser
    any($($tokens:tt)+)
) => {
    $crate::cfg_aliases!(@parser_clause any [] [$($tokens)+])
};
```

Rust previously ignored the trailing semicolon in that position.
The future-incompatible lint preserves the build for dependencies today,
but warns that the token sequence will become invalid.

Upstream PR [cfg_aliases#15][cfg-aliases-15] removed exactly those three semicolons.
The 0.2.1 to 0.2.2 source diff is:

```diff
-        ]);
+        ])
@@
-        ] $($current)* $tok);
+        ] $($current)* $tok)
@@
-        );
+        )
```

The fix is published as `cfg_aliases` 0.2.2,
with crates.io checksum
`f079e83a288787bcd14a6aea84cee5c87a67c5a3e660c30f557a3d24761b3527`.
The seven affected packages request either `cfg_aliases = "0.2.0"` or `"0.2.1"`.
Cargo's default caret requirements admit 0.2.2,
so no top-level package upgrade or manifest override is needed.

## Verification

The failing catalog is the supplied report,
generated with `cfg_aliases` 0.2.1:

- build scripts with nested `all(...)` clauses warn;
- build scripts with nested `any(...)` clauses warn;
- build scripts combining `not(...)` with a nested clause warn;
- 488 warning instances resolve to the seven invocation sites listed in
  [Symptom](#symptom).

A detached worktree at repository commit
`9db2715d84eaf3290d00f1f28e5b17b361c45ec9`
was used so verification did not change the main worktree.
Cargo performed the targeted update:

```console
$ cargo update \
    --manifest-path package/music-player/desktop-app/Cargo.toml \
    --package cfg_aliases@0.2.1 \
    --precise 0.2.2
    Updating cfg_aliases v0.2.1 -> v0.2.2
```

The generated diff changed only the package version and checksum:

```diff
 name = "cfg_aliases"
-version = "0.2.1"
+version = "0.2.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "613afe47fcd5fac7ccf1db93babcb082c5994d996f20b8b159f2ad1658eb5724"
+checksum = "f079e83a288787bcd14a6aea84cee5c87a67c5a3e660c30f557a3d24761b3527"
```

The working catalog uses 0.2.2:

```console
$ mise run //package/music-player/desktop-app:lint
Compiling cfg_aliases v0.2.2
Compiling turso_core v0.6.1
Compiling winit v0.30.13
Compiling glutin v0.32.3
Compiling glutin-winit v0.5.0
Compiling i-slint-backend-winit v1.17.0
Compiling i-slint-backend-selector v1.17.0
Finished `dev` profile [unoptimized + debuginfo] target(s)
```

The clean build emitted no `trailing semicolon in macro used in expression position`
or future-incompatibility warning.
The dev-dependency path also compiled cleanly and passed the package tests:

```console
$ mise run //package/music-player/desktop-app:test
Compiling i-slint-backend-testing v1.17.0
Finished `test` profile [unoptimized + debuginfo] target(s)
Summary [3.024s] 94 tests run: 94 passed, 0 skipped
```

## Verified workarounds

Use the released transitive fix and commit only the generated lockfile change:

```console
cargo update \
  --manifest-path package/music-player/desktop-app/Cargo.toml \
  --package cfg_aliases@0.2.1 \
  --precise 0.2.2
mise run //package/music-player/desktop-app:lint
mise run //package/music-player/desktop-app:test
```

Tradeoffs:
 this intentionally advances one transitive build dependency by one patch release.
It does not change the application API,
Slint,
Turso,
winit,
or glutin versions.
A clean verification build fetches and recompiles the affected build-script dependency graph.

The repository also has standalone lockfiles that still select `cfg_aliases` 0.2.1:

- `package/linter/rust/Cargo.lock` through `borsh` 1.6.1;
- `package/music-player/truepeak-core/Cargo.lock` through `turso_core` 0.6.1;
- `package/music-player/android-app/rust/Cargo.lock` through `turso_core` 0.6.1;
- `package/cli/nested-wayland-session/Cargo.lock` through `winit` 0.30.13;
- `package/desktop-app/terminal/Cargo.lock` through its 0.2 dependency family.

Apply and verify the same targeted 0.2.1 to 0.2.2 lockfile update in each owning package when handling
this compatibility issue repository-wide.
`package/desktop-app/terminal/Cargo.lock` also contains `cfg_aliases` 0.1.1 through `nix` 0.28.0.
That separate semver family needs its own dependency assessment;
the 0.2.2 lock update cannot replace it.

## What does not work

- Updating `turso_core` to 0.7.0 pre-release or `winit` to a 0.31.0 beta.
  Those are unrelated top-level migrations for a defect fixed in a shared transitive macro crate.
- Filing reports against all seven named packages.
  The shared fix already shipped in `cfg_aliases` 0.2.2,
  and Slint and winit have already updated their development branches.
- Adding `cfg_aliases` as an application build dependency only to constrain resolution.
  A direct dependency would misstate ownership when the lockfile can select the compatible patch release directly.
- Adding a crates.io `[patch]` to the upstream Git commit.
  That was useful before 0.2.2 was published;
  it now adds a Git source and maintenance work without changing the result.
- Suppressing `semicolon_in_expressions_from_macros` in application source.
  The invocation sites are dependency build scripts,
  and suppression would not make them valid after rustc turns the construct into a hard error.
- Ignoring the report indefinitely.
  The current compiler transition explicitly targets a future hard error.

## Upstream filing decision

`.out-of-scope/` was checked.
Its Cargo entry covers repository workspace structure,
not dependency future incompatibilities,
so no exemption matches.

Duplicate searches found
[cfg_aliases issue #16][cfg-aliases-16],
which reports the same nightly diagnostic,
and [cfg_aliases PR #15][cfg-aliases-15],
which fixed it and was released as 0.2.2.
There is nothing additive to post.

1. Is it really upstream's fault?
    Yes.
    `cfg_aliases` 0.2.1 emitted trailing semicolons from expression macro arms.
2. Can upstream fix it?
    Yes.
    Removing the three semicolons fixes the token stream.
3. Are they supporting this use case?
    Yes.
    Invoking `cfg_aliases!` from `build.rs` is the crate's documented purpose.
4. Would the repository welcome the contribution?
    Yes.
    No contribution or issue template in the cloned repository prohibits external or assisted contributions,
    and the maintainer merged PR #15.
5. Will they likely fix it?
    Yes,
    and they already did:
    PR #15 was merged and release 0.2.2 was published on 2026-07-16.
6. Has a minimal fix compatible with the architecture been prototyped?
    Yes.
    The released patch changes only the three expression-producing macro arms,
    and the detached-worktree application build verifies the released crate against the observed dependency graph.

Decision:
 do not open an issue and do not comment on the closed duplicate.
Issue #16 already records the symptom,
PR #15 records the minimal fix,
and the 0.2.2 release is available from crates.io.

[cfg-aliases-15]: https://github.com/katharostech/cfg_aliases/pull/15
[cfg-aliases-16]: https://github.com/katharostech/cfg_aliases/issues/16
[rust-159218]: https://github.com/rust-lang/rust/pull/159218
[rust-159222]: https://github.com/rust-lang/rust/pull/159222

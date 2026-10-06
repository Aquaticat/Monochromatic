# Unified-linter cutover handoff

## Purpose

Carry out step 7 of the numbered plan in
[`doc/planning/unified-linter.md`](../planning/unified-linter.md):
publish `monochromatic-lint`,
install it through mise,
switch every consumer,
and delete the five incumbent packages.
The main session delegated this on 2026-10-06,
after the owner approved crates.io publication for that session.
Step 8,
fixing the snippet findings,
is not part of this work.

This document is the evidence record,
updated after each step.
Work happens on branch `feat/linter-cutover`
in the linked worktree `.claude/worktrees/linter-cutover`.

## How to read and respond

Read `Blocker` first:
it names the one action only the owner can take.
Then read `Landing choreography`,
which lists what the main session must do at landing time and in which order,
because several steps change the production Git wrapper's behavior and cannot be done from the branch.
`Publications`,
`Publish workflow`,
and `Release targets` hold the crates.io and CI evidence.
Respond by completing the owner action in `Blocker`,
or with a correction to a named entry.

## Blocker

`monochromatic-lint` 0.1.0 cannot be published from this session.

crates.io Trusted Publishing can only be configured for a crate that already exists.
The current crates.io source states it in `svelte/src/routes/docs/trusted-publishing/+page.svelte`,
read through the GitHub API on 2026-10-06:
"Your crate must already be published to crates.io (initial publish requires an API token)".
The token stored in `~/.cargo/credentials.toml` (modified 2026-09-26) is no longer valid:
a request with it to `https://crates.io/api/v1/me` returned `403` with `authentication failed`.
In the crates.io source,
`src/auth.rs` returns exactly that message from `authenticate_via_token` when the token is not found,
while a valid token on that cookie-only endpoint returns
"this action can only be performed on the crates.io website" instead.
`gh secret list` held no crates.io token when
[`doc/runbook/publish-crate-first-time.md`](../runbook/publish-crate-first-time.md) was written,
and creating a token needs the owner's crates.io sign-in.

The owner action is the runbook's `monochromatic-lint` entry in
[`doc/runbook/publish-crate-first-time.md`](../runbook/publish-crate-first-time.md).
Everything after the owner's `cargo login` and the Trusted Publishing form is agent work,
listed under `Landing choreography`.

## Publications

### monochromatic-jsonc-edit 0.1.1

- Why:
   the repository source differed from the published 0.1.0 in `src/comment_merge.rs`
   (a comment body carrying a bare CR is emitted in block form)
   and `src/edit_apply.rs`
   (replacing a scalar document root is refused),
   measured by diffing the downloaded 0.1.0 `.crate` against the repository.
- Also in 0.1.1:
   five shadowed bindings renamed in `src/scan.rs`,
   `src/parse.rs`,
   and `src/parse_tests.rs`,
   because `mise run //package/rust-module/jsonc-edit:lint:types` failed at the branch base on the
   `shadow_reuse` and `shadow_unrelated` denials added on 2026-10-04.
   Behavior is unchanged;
   all 81 tests pass.
- Commits:
   `f313a8933` (version and lockfiles),
   `7af92c819` (renames),
   landed on `main` as merge `533574e1f`.
- Dry run on the exact landed commit:
   run 37530495220 on `533574e1f`,
   `je-publish-crate` concluded `success` with `Packaged 31 files, 308.8KiB (75.5KiB compressed)`,
   `Verifying monochromatic-jsonc-edit v0.1.1`,
   and `warning: aborting upload due to dry run`.
   An earlier dry run,
   37529342345 on `184ee5baf`,
   also passed;
   `main` moved before it could land.
- Publication:
   push run 37531066191 on `533574e1f`,
   job `je-publish-crate`,
   `Published monochromatic-jsonc-edit v0.1.1 at registry crates-io` at 2026-10-06T21:05:05Z.
- crates.io API (`/api/v1/crates/monochromatic-jsonc-edit/0.1.1`):
   license `LGPL-3.0-or-later`,
   `crate_size` 77285,
   checksum `77ab79da384484360cc6d2392921fe3bfb3e67df30416b17765f11b562d23d1c`,
   which equals the build-provenance attestation digest the run logged,
   and `trustpub_data` naming run 37531066191 and commit `533574e1f`.
- Consumer build:
   a disposable crate depending on `monochromatic-jsonc-edit = "=0.1.1"`,
   built in `docker.io/library/rust:latest` with network,
   downloaded the crate from crates.io,
   and its probe exited 0 with
   `cr-comment-reparses=true` and `scalar-root-refused=true`.
   The same probe against `=0.1.0` printed `false` for both,
   so the probe can tell the versions apart.
- Gates before landing:
   `mise run //package/rust-module/jsonc-edit:test` (81 passed),
   `mise run //package/rust-module/jsonc-edit:lint:types` (clean),
   `mise run //package/rust-module/jsonc-edit:package`,
   `mise run //package/rust-module/jsonc-edit.fuzz:test` (13 passed),
   `mise run //package/git-policy/cli:native:check`,
   and `mise run //package/linter/monochromatic-lint:lint:container` with
   `MONOCHROMATIC_LINT_IMAGE_TAG=cutover` on `184ee5baf`:
   389 library tests passed with 1 ignored,
   13 executable tests passed,
   and Clippy passed.
   The gated directories are byte-identical between `184ee5baf` and `533574e1f`.

Every dependent's lockfile was regenerated through its owning task,
and each diff is the single `monochromatic-jsonc-edit` version line:
`native:lock:scanner` for `package/git-policy/cli`,
`lock:subject` for `package/git-policy/cli.fuzz`,
`lock` for the linter and its fuzz sidecar,
and `lint` and `lint:clippy`,
which run unlocked Cargo,
for `package/rust-module/jsonc-edit` and its fuzz sidecar.
`native:lock`,
the plain `cargo generate-lockfile --offline` of `package/git-policy/cli`,
was tried first and rewrote 608 lines,
so it was discarded.

### monochromatic-lint 0.1.0

Not published;
see `Blocker`.

## Publish workflow

`.github/workflows/cargo-publish.yml` gained `ml-detect`,
`ml-publish-crate`,
`ml-build-binary`,
and `ml-create-release`,
a `monochromatic-lint` dispatch choice,
and `package/linter/monochromatic-lint/Cargo.toml` as a push path.
They mirror the `forbidden-strings` jobs:
the same eight targets,
tag `monochromatic-lint-v<version>`,
and assets `monochromatic-lint-<version>-<target>.tar.gz` (`.zip` on Windows)
holding `monochromatic-lint-<version>-<target>/monochromatic-lint` and the README,
which is cargo-binstall's default layout.
Two differences:
the publish step skips a version already on crates.io,
because 0.1.0 is bootstrapped by hand,
and the binary matrix also runs in a dry run,
so a dry dispatch shows which targets build.
Attestation and the release stay behind `!inputs.dry-run`.
The matrix compiles with each runner's preinstalled rustup toolchain,
like the `forbidden-strings` matrix,
not with the repository's mise nightly.

The crate manifest now carries the release profile the incumbent Rust linter shipped with
(`lto = true`,
`codegen-units = 1`,
`opt-level = 3`,
`strip = true`),
and `file-enforcer.config.ts` maps `package/linter/monochromatic-lint` to that profile.
A control run set `opt-level = 2`,
ran `mise run file-enforcer`,
and saw it restored to 3.

### Incident in the jsonc-edit publish run

The push of `main` from `173e5fe2a` to `533574e1f` spanned two generations,
because local `main` held 16 commits another session had not pushed.
With `fetch-depth: 2`,
the pre-push head was not in the checkout,
and every detect job read its absence as a version bump.
The jobs for unchanged crates then ran:
`forbidden-strings` 0.4.1 was refused by crates.io as a duplicate,
`forbidden-regex` and `monochromatic-nested-wayland-session` skipped their existing versions,
both release jobs were refused because the tags exist,
and 13 build-provenance attestations were created for rebuilt bytes that were never published.
No crates.io version or GitHub release changed.
A `gh run cancel` was refused by this session's permission classifier.

Every detect step now fetches the missing commit and fails closed when it cannot.
Reproduction,
root cause,
and the before-and-after evidence:
[`doc/troubleshooting/cargo-publish-shallow-before-sha.md`](../troubleshooting/cargo-publish-shallow-before-sha.md).

## Release targets

Pending:
dry run 37535699410 on `a9eb803b1`.

## Landing choreography

Pending.

## Cutover change

Pending.

## AGENTS.md rules

The plan names `MXR` and `RDC`.
Neither code exists in `AGENTS.md` at the branch base or in `forbidden-strings.append.txt`
or the main checkout's `forbidden-strings.append.local.txt`.
Commit `d03ec673e` (`docs(AGENTS.md): apply rule-by-rule optimization`, 2026-09-29) removed both:
`MXR`,
which named `monochromatic-rust-linter`'s `max-lines` rule,
its 300-line budget,
and its exemptions,
was folded into the tool-agnostic `MXL` rule,
which now reads "Over max-lines (TS, Rust): split into sibling files/modules";
`RDC`,
which required rustdoc on every documentable item,
was dropped without a replacement.
No current `AGENTS.md` rule names an incumbent linter,
so the cutover changes no rule.
Recording the two retired codes in `forbidden-strings.append.local.txt`,
as the `CRN` rule asks,
is left to the main session,
because that file is local to the main checkout.

## Consumer differential

Pending.

## Deleted paths

Pending.

## Left for step 8

Pending.

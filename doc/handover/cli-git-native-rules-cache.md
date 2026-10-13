# Native rules-file copy for worktrees created from the main checkout

## Purpose

The forbidden-strings scanner reads its rules from `.cache/forbidden-strings.rules.txt` (the configured `rulesFile`,
relative to the worktree).
`mise run file-enforcer` generates that file, and `.gitignore` ignores it (`.gitignore:68`),
so a fresh linked worktree has none, and the native wrapper fails closed there (`policy-incomplete`, naming the path).
The user decision of 2026-10-12 is to bring the file along when the wrapper creates a worktree.
The linked-worktree ignored-state copy (`src/native/worktree_copy*.rs`) is the mechanism.
This lane lets that copy take the rules file when the source is the main checkout.

## What was found

The premise that the copy already brings `.cache` from a linked worktree is true of the incumbent TypeScript wrapper
and of the Rust library, but not of the native executable.
Nothing in the executable calls `worktree_copy::run_with_worktree_copy`
(`rg run_with_worktree_copy package/git-policy/cli/src` finds the definition only).

Reproduced with the built `target/debug/cli-git-native` on host Git 2.55.0 in a throwaway repository under
`${HOME}/temp/agent` (script `${HOME}/temp/agent/rules-cache-repro.ts`), before this lane's change:

- `git worktree add` from the main checkout exits 0, is forwarded plainly (`synchronizes_worktree_copies` is false for
  `MainWorktree` in `src/native/refusal_frontier.rs`), and the new worktree has no `.cache`.
- `git worktree add` from a linked worktree exits 2 with `Unported::WorktreeCopy`: "copying ignored files into a
  worktree created or moved from a linked worktree or a bare repository (--no-worktree-copy skips the copy) is not
  implemented in this native development executable, so git worktree was not run".
- `git cli-git check --policy security/forbidden-strings --all` in the new worktree exits 2 with an `engine-failure`
  event, code `policy-incomplete`, "read rules <worktree>/.cache/forbidden-strings.rules.txt: No such file or
  directory (os error 2)".

The incumbent TypeScript copy bypasses the main checkout too
(`observeWorktreeRepository` in `src/worktree-copy/git-observer.ts` returns not-applicable for `main-worktree`),
so the incumbent never copied anything from a main-checkout source.
This lane therefore adds behavior the incumbent lacks; linked and bare sources are unchanged.

## What changed

Library level, in `package/git-policy/cli/src/native/`:

- `worktree_copy_selection.rs`: `CopySelection` (`Ignored` or `Paths`), `read_named_ignored_roots`, `select_roots`.
  A named path is selected only when it passes `assert_safe_repository_path` and Git itself lists it exactly under
  `ls-files --others --ignored --exclude-standard -z -- :(top,literal)<path>`.
  A name that is absent, tracked, not ignored, or a directory selects nothing.
  Nothing is synthesized: with no source file the copy installs nothing and the existing missing-file error stands.
  The main checkout is never enumerated and the special-entry walk never runs for it.
- `worktree_copy_registry.rs`: `WorktreeCopyObservation::selection`, and `observe_copy_source`, which observes a main
  checkout only when the caller names paths.
  Linked and bare sources keep `CopySelection::Ignored`; `observe_worktree_repository` is unchanged.
- `worktree_copy_stage.rs` and `worktree_copy_transaction.rs`: `stage_ignored_snapshot` and
  `synchronize_created_worktree` take the selection.
- `worktree_copy.rs`: `Invocation::main_checkout_paths`.
  Empty keeps the main checkout a bypass (the previous behavior); linked and bare sources ignore the field.
  The opt-out flag, the short-circuit flag, `creates_or_moves`, the inherited-lease check, the settlement lock, the
  journal, rollback and the summary line apply to a main-checkout source exactly as to a linked one.

## Choices open to veto

- The change has no effect in the native executable until the integrator wires the lifecycle.
  That wiring is the whole `run_with_worktree_copy` integration, not something this lane added:
  `refusal_frontier.rs` (`synchronizes_worktree_copies` is false for `MainWorktree`, so a main-checkout
  `worktree add` is forwarded without the copy) and `pending_state.rs` skip the main checkout, and `entry.rs` execs
  real Git instead of running it as a child with the lease token.
  The integrator needs: `Invocation::main_checkout_paths` set to the configured `rulesFile`
  (`config.policies.forbidden_strings.rules_file`, empty when unset) for a main-checkout `worktree add` or `move`;
  the frontier to stop treating the main checkout as plain forwarding for those commands.
  Reason for not doing it here: it also involves alias resolution, the inherited lease, recovery for non-creating
  commands and the coordinated index-writer forward, which belong to the integration.
- Only the configured `rulesFile` is a source name.
  The `FORBIDDEN_STRINGS_RULES` variable fallback and the default `forbidden-strings.local.txt` are not copied.
- A main-checkout copy takes the settlement lock and writes its journal under the common directory.
  Because `pending_state` and the frontier skip the main checkout, an interrupted main-checkout copy is recovered by
  the next worktree-creating command (the lifecycle recovers first under the lock) or by a linked or bare command.
- A copy that selects nothing still prints the one-line summary ("copied 0 ignored filesystem entries ...") and
  takes the lock, as the linked copy does when its source has nothing ignored.
- `:(top,literal)` is defensive: the exact-name comparison already filters Git's listing, so removing `literal` changes
  no result (Git also tries the literal text before globbing).
  It is an equivalent mutant, kept so the listing stays cheap and magic-free.

## Evidence

Commits on `feat/cli-git-native-rules-cache` (based on `main` at `e1890fb471`):

- `254eeb701e` feat: copy named ignored files from a main-checkout source (tests and implementation).
- `1c3248743c` test: pin literal rules-file lookup and document the main-checkout source.
- `a1e2c74fd8` test: fix the bracketed-name fixture to ignore only the named file.
- `5e04e3815e` test: pin that selection queries ignore the user's global Git options.

Tests added: 10 selection tests, 2 registry tests, 5 lifecycle tests.
Each was shown to fail with its guard removed (selection mode dispatch, exact-name comparison, unsafe-path check,
selection passed to staging, restricted observation, empty-paths bypass, linked selection kept, opt-out and
creating-command guards, and `without_prefix` in the named and special-entry queries), then restored.
The `:(top,literal)` guard is the one exception: removing `literal` fails no test, because it is equivalent
(see Choices open to veto).
Host run, Git 2.55.0: `mise run //package/git-policy/cli:native:test:host -- worktree_copy` passes.

Container gate at head `5e04e3815e` (the last code and test commit; later commits change only this document),
`GIT_POLICY_NATIVE_IMAGE_TAG=rules-cache`, image `localhost/git-policy-native-test:rules-cache`, id
`d218affa2542e948a69e9df5ac8c2842089d7cd9154a58ea21a0b7ae48e6c315` (Git 2.56.0):
library 1649 passed, 6 ignored; binary 104 passed, 1 ignored; interop 1 passed.
`mise run //package/git-policy/cli:native:clippy` at the same head: zero findings.
The host Git 2.55.0 run of the `worktree_copy` tests passes, and the same tests pass in the Git 2.56.0 container.

## Mutation

Container scoped runs, `--timeout 600`, through the slot limiter.
Mutation of `worktree_copy_selection.rs` ran at head `a1e2c74fd8`: 56 mutants, 51 caught, 4 missed, 1 unviable,
0 timeouts. All 66 planted controls were noticed.
- Missed `worktree_copy_selection.rs:163`, `:286` and `:367` (delete `without_prefix` in the special-entry,
  full-listing and named queries): killed afterwards by `special_entry_check_ignores_the_users_global_git_options` and
  `selection_ignores_the_users_global_git_options` (head `5e04e3815e`), each shown to fail with the field deleted.
  Not rerun as a campaign.
- Missed `worktree_copy_selection.rs:68` (`||` to `&&` between `is_empty()` and `starts_with('/')`): equivalent.
  An empty path is still refused because `split('/')` yields one empty component, and a path starting with `/` is still
  refused by `Path::is_absolute` on Unix or by its leading empty component elsewhere, so no input changes outcome.

Mutation of `worktree_copy_registry.rs` and `worktree_copy.rs` ran at head `5e04e3815e`: 58 mutants, 42 caught,
4 missed, 12 unviable, 0 timeouts. The four survivors are in code this lane did not change and are not triaged:
`worktree_copy_registry.rs:350` (the `NotFound` guard in `canonical_registered_root`), `:407` (the main-worktree test
in `read_registered_worktrees`, two mutants), and `worktree_copy.rs:257` (the common-directory comparison in
`settle_under_lock`).
The new code (`observe_copy_source`, the selection field, the main-checkout paths) has no surviving mutant.

## Trailing gates

- The four inherited survivors above are untriaged, as in `doc/handover/cli-git-native-worktree-copy.md`.
- Mutation of `worktree_copy_selection.rs` is not rerun after the two `without_prefix` tests.
  Rerun it with the command in the next section.
- Windows checks are not run; the changed code has no platform branches.
- Reproduce the finding:
  `node ${HOME}/temp/agent/rules-cache-repro.ts` after `mise run //package/git-policy/cli:native:build`.

## Rerun commands

```sh
# doc/handover/cli-git-native-rules-cache.md: container gate
GIT_POLICY_NATIVE_IMAGE_TAG=rules-cache node ~/temp/agent/gate-slot.ts mise run //package/git-policy/cli:native:test:container
# doc/handover/cli-git-native-rules-cache.md: scoped mutation of the selection module
GIT_POLICY_NATIVE_IMAGE_TAG=rules-cache node ~/temp/agent/gate-slot.ts mise run //package/git-policy/cli:native:mutation:scoped -- --file src/native/worktree_copy_selection.rs --timeout 600
```

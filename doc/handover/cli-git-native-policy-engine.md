# cli-git native policy engine

## Authority and scope

This records a scoped delegation of the Rust cli-git rewrite:
the native policy engine for every command that needs no commit transaction,
no worktree copy and no manual-push scanning.
The accepted approach is
[`cli-git-rust-implementation.md`](../planning/cli-git-rust-implementation.md);
the behavior inventory is
[`cli-git-rust-behavior-ledger.md`](../planning/cli-git-rust-behavior-ledger.md);
the layers this builds on are recorded in
[`cli-git-native-foundation.md`](cli-git-native-foundation.md)
and [`cli-git-native-command-parser.md`](cli-git-native-command-parser.md).

Settled before this delegation and not reopened:
Rust,
a repository-root `cli-git.config.jsonc`,
shipped policies only,
Git 2.56.0 only,
and the TypeScript executable staying the installed `git` until a later coordinated cutover.

The native executable is still a development artifact.
It is not installed and does not shadow `git`.
It now forwards guarded commands after running the ported policies,
and it refuses every command that needs work it does not do.
A commit,
a real push,
a `git add` with a content policy on,
and a worktree creation from a linked worktree are all refused.
Nothing here brings the wrapper close to cutover:
the commit path,
which is the reason for the rewrite,
is not started.

Candidate content and the forbidden-strings scanner belong to another delegation
(`candidate_*.rs` and `scanner_*.rs`)
and are not used by anything recorded here.

## Decisions by the human on 2026-10-05

The coordinating agent relayed five decisions as made by the human on 2026-10-05.
They are recorded as decided,
not as open to veto.

### Optional policies run only when listed

The five built-in policies run everywhere at their default severity.
Each of the four policies that used to come from plugins
(`markdown/autofix`,
`mono/forbidden-root-context`,
`mono/dependent-version-bump`,
`security/forbidden-strings`)
is off unless `cli-git.config.jsonc` names it,
whether or not a file exists.
An empty object and no file behave identically.
A policy listed with options but no severity gets its incumbent default severity.
A repository's translated configuration must therefore name every optional policy it relies on;
an unlisted one silently stops.
Commit `329de1b97` implements this and corrects the corresponding passages of
`cli-git-native-foundation.md`.

### The repository root is what Git reports

The root is the top level Git prints,
not the nearest directory holding a marker file.
The incumbent's nearest-marker walk is an intentional difference.
The consequence for the read-only fast path is recorded under "Hazard 5, the read-only fast path".

### A legacy configuration file is reported by check only

A legacy file left beside the JSONC file is reported by `git cli-git check`,
as one `configuration-warning` event per file on standard output,
and by no other command.
A legacy file without a JSONC file stays a migration error on every configuration-loading command.

### Two mutant kinds are never tried

`bin/mutate-native-container.mjs` passes `--exclude-re 'replace \+= with \*='`
and `--exclude-re 'replace -= with /='` to cargo-mutants on every campaign.
The human accepted that these two kinds are never tried.
The cause,
the cargo-mutants source that decides it,
the measured cost in this package
(34 of 1,230 mutants at commit `d1c02273a`)
and the tradeoffs are in
[`cargo-mutants-timeout-exit-status.md`](../troubleshooting/cargo-mutants-timeout-exit-status.md).
`replace += with -=` stays active as the check on every counter.

The three loops whose step mutant `replace += with -=` had timed out were rewritten to visit the argument slice
instead of stepping an index:
`mixed_command` in `config_loading.rs`,
`global_layout` in `global_arguments.rs`,
and `parse_direct` in `management_arguments.rs`.
None of the modules added by this delegation steps a loop index by hand.

### The failure code of a policy that could not finish follows its cause

A shipped policy that could not finish reports `content-unavailable`
when a candidate's bytes or a repository fact could not be read,
and `policy-incomplete` when the policy's own machinery failed:
its rules file could not be loaded,
its linter could not start,
or it hit an internal error.
`plugin-threw` is not carried over,
and no other code is added.

Commit `090c147e7` adds `PolicyIncomplete` to `diagnostics::EngineFailureCode`
with the wire spelling `policy-incomplete`,
a doc comment stating the rule,
and the spelling test.
No path in the engine reports it yet:
the only failure of a ported policy is a repository fact that could not be read,
which is `content-unavailable`.
The optional-policy phase is its first user.
The engine seam for it is `policy_engine::PolicyOutcome`,
whose `Failed` outcome the stage reports as `content-unavailable`;
a policy whose machinery can fail needs a second failing outcome there
and one more arm in `run_policy_stage`.

## Gate results

The gate is `mise run //package/git-policy/cli:native:test:container`:
a mount-free,
network-disabled container bounded to 2 GiB,
2 CPUs
and 128 PIDs,
on the audited Git 2.56.0 image.
It runs the unit target,
the binary-level target,
and Clippy with warnings denied.
Evidence directories are under `package/git-policy/cli/target/verification/`.
The baseline before this delegation was 322 unit and 21 binary-level tests.

### Slice A, wrapper controls

Commit `6b14f1249`:
333 unit and 21 binary-level tests,
evidence `native-lMmgW3`.

### Slice B, engine core

Commit `99646d0c6`:
363 unit and 21 binary-level tests,
evidence `native-gUdrZ4`.

### Human decisions on configuration

Commit `329de1b97`:
366 unit and 21 binary-level tests,
evidence `native-AXWZNN`.

### Slice C, facts, rule cores and transforms

Commit `a9010f435`:
407 unit and 21 binary-level tests,
evidence `native-GiOP83`.

### Loop rewrites and sequencer follow-up

Commits `9cc45dc2c`,
`d86b7463c`
and `d1c02273a`:
408 unit and 21 binary-level tests,
evidence `native-3hLjlH`.

### Slice D, lifecycle, refusal frontier and direct commands

Commit `3836299a7`:
440 unit and 36 binary-level tests,
evidence `native-FbeoYh`.
This was the first gate run of the slice;
no test needed a correction after it.

### Fuzz target and the status-format commit control

Commit `d8adb6015`:
440 unit and 36 binary-level tests,
run twice under separate image tags,
evidence `native-q6HftZ` and `native-LETrzq`.
The count is unchanged because the commit extends an existing binary-level test.

### Helper removal

Commit `4bef275e6` removes a function only tests called.
It was first checked on the host only;
the gate of commit `24cfeaaee` includes it.

### Classifier test

Commit `24cfeaaee`:
441 unit and 36 binary-level tests,
evidence `native-sgFHN6`.

### Tests run on the host

The delegation asked that repository-changing checks run only inside the container.
While iterating,
the unit target was also run on the host through `mise run //package/git-policy/cli:native:test:host`.
Those tests create repositories only in fresh directories under the system temporary directory,
with a cleared environment and no global or system Git configuration,
and never touch this repository or the real home directory.
The host has Git 2.55.0,
so 10 tests that compare against Git 2.56.0 fail there;
only the container gate counts as evidence.
The binary-level target,
which starts the wrapper itself,
was never run on the host.

## What the executable does today

### Lifecycle of a wrapped command

`entry::plan_invocation` decides one invocation in this order:

1.  A forward-target marker naming this executable stops the invocation,
    as in the foundation.
2.  Wrapper controls written before the subcommand are removed.
3.  `git cli-git ...` goes to the management commands.
4.  Real Git is resolved.
5.  `wrapped_command::run_wrapped_command` runs the lifecycle.

The lifecycle,
in `wrapped_command.rs`:

1.  An invocation that names no subcommand
    (a query,
    a global option Git refuses,
    a missing value,
    a bare `git`)
    is forwarded with its controls removed.
2.  A command that `classify_config_loading` skips uses the default settings.
    It reads no configuration,
    checks no lease and no leftover state,
    and asks Git only what a policy needs.
3.  Every other command is prepared:
    an inherited lease is refused;
    Git is asked once where the command runs;
    leftover transaction or worktree-copy state is refused;
    the worktree's configuration is loaded;
    a commit,
    a worktree creation or a possible alias that needs unported work is refused;
    and `git add` inside a worktree is marked as having content no policy can read yet.
4.  One pre-forward pass runs:
    built-in policies,
    then the fixed transforms,
    then optional policies.
5.  A `git push` that is not provably a dry run must clear the manual-push gate.
6.  The command is forwarded with the transformed arguments,
    after any warning events are written to standard error.

A stop writes its events to standard error and exits 1 for an error finding or a transform rejection,
and 2 for a failure or a refusal.

### Direct check and fix

`git cli-git check` and `git cli-git fix` validate the selected policy names,
resolve Git,
ask where they run,
refuse beside registered commit transactions,
load the configuration,
and run one pass with the `direct-check` or `direct-fix` trigger.
Events go to standard output.
`check` first reports legacy files,
and policy events continue that numbering.

Only `require-root` is both ported and declared for `direct-check`.
No ported policy declares `direct-fix`.
Every other policy that runs for a direct command reads the selected worktree files,
which is not ported,
so:

- `git cli-git check --all --policy require-root` gives a real answer:
  exit 0 at the top level,
  one finding and exit 1 below it.
- A direct command whose selection includes an enabled content policy stops with exit 2
  and a notice naming the policy,
  after the events gathered so far.
  With default settings that is every unfiltered `check` and `fix`,
  because `final-newline` is on.
- A direct command whose selection holds only policies that do not run for it exits 0 with no output.

The scope (`--all` or pathspecs) is parsed and validated by the management grammar but not read.
The incumbent projects the selected files before any policy runs,
so a pathspec error it would report is not reported here.

## Refusal frontier

Every refusal exits 2,
prints one line on standard error,
and leaves the repository untouched.
The line names what is missing and the command that did not run:

```text
cli-git: <what> is not implemented in this native development executable,
so git <command> was not run. Run it with the installed cli-git.
```

The two lines shown are one line of output,
joined by a space.
The reasons are the variants of `unported::Unported`.
Each has a binary-level test in `binary_frontier_tests.rs`,
`binary_controls_tests.rs`
or `binary_management_tests.rs`,
with a positive control showing that the neighbouring forwarded command really changes the repository.

### Refused commands

#### Every commit except a dry run

Ledger sources:
"Scope and applicability",
"Post-commit lifecycle",
"Trigger, skips, and push arguments",
"Candidate facts".
The decision is made on the command word `commit` alone,
then narrowed by Git's own option table:
only a region the table reads as a dry run is forwarded.
A region the table refuses is not known to be a dry run and is refused.
Git makes `--short`,
`--porcelain`,
`--long`
and `-z` dry runs by themselves,
and the table follows it;
those forms are forwarded.
Test: `frontier::a_real_commit_is_refused`,
ten refused forms from the top level and one from a subdirectory,
`HEAD` and the index unchanged,
and five forwarded dry-run forms compared with real Git.

#### `git add` while a content policy is on

Ledger sources:
"Candidate facts",
"Pre-forward lifecycle",
"final-newline".
The engine returns a typed "unavailable" for the first enabled content policy,
and the notice names that policy.
With default settings that policy is `final-newline`,
so a plain `git add` is refused.
`add-explicit` runs first,
so a bulk add is rejected with exit 1 before any content policy is asked.
Test: `frontier::add_is_refused_while_a_content_policy_cannot_read_what_it_would_stage`.
Positive controls:
`--no-enforce-final-newline`,
and a configuration that turns the policy off,
stage the file.

#### A push that may publish

Ledger source: "Manual-push lifecycle".
After the pre-forward pass,
a push that Git's table does not read as a dry run asks whether any policy declares the `manual-push` trigger
and is enabled.
If one is,
the engine's typed "unavailable" for that lifecycle becomes the refusal.
Test: `frontier::a_real_push_is_refused_at_the_manual_push_gate`:
three refused forms against a bare remote that stays empty,
a forwarded dry run compared with real Git,
and a positive control that publishes once the only such policy is escaped.

#### Worktree creation from a linked worktree or a bare repository

Ledger source: "Applicability and main-worktree bypass".
`git worktree add` and `git worktree move` are refused there unless `--no-worktree-copy` is given.
From the main worktree,
and outside a repository,
they are forwarded,
as the incumbent does.

#### A possible alias from a linked worktree or a bare repository

Ledger source: "Alias resolution and built-in command table".
A command word that Git 2.56.0 does not build in may be an alias for a worktree creation.
`git_builtins.rs` holds the 149 names of `git --list-cmds=builtins`,
compared with real Git in the gate.
`--no-worktree-copy` forwards such a command,
because the incumbent skips the copy before it resolves any alias.
Test for both: `frontier::worktree_creation_and_aliases_are_refused_from_a_linked_worktree`.

#### Leftover durable state

Ledger sources:
"Startup order",
"Recovery",
"Crash recovery",
"Index-writer coordination and landing lease".
A guarded command is refused when the invocation's Git directory holds any entry in `cli-git-transactions`,
or the legacy `cli-git-transaction`,
and,
from a linked worktree or a bare repository without `--no-worktree-copy`,
when the common directory holds any entry in `cli-git-worktree-copy/v1` other than `settlement.lock`.
A directory that cannot be listed counts as holding state.
This executable cannot tell a dead owner from a live one,
so it does not classify entries.
Direct `check` and `fix` are refused beside transaction state only.
Test: `frontier::leftover_state_and_leases_refuse_guarded_commands`
and `management::direct_commands_validate_run_ported_policies_and_refuse_the_rest`.

In a repository where the installed wrapper is in use,
the transaction registry is rarely empty:
this repository's own registry held two live transactions,
two staging directories several days old,
and a reservation lock when it was inspected.
In such a repository the native executable refuses every guarded command.
That is the intended state until recovery and the landing lock are ported.

#### An inherited lease

Ledger sources:
"Recovery",
"Index-writer coordination and landing lease",
"Applicability and main-worktree bypass".
A guarded command is refused when `CLI_GIT_PREPARATION_LEASE`,
`CLI_GIT_LANDING_LEASE`
or `CLI_GIT_WORKTREE_COPY_LEASE` is present in the environment,
whatever its value,
because checking a lease against the lock it names is not ported.
Same test as leftover state.

#### Direct check and fix with a content policy selected

Ledger sources:
"Direct check",
"Direct fix",
"Candidate facts".
Recorded under "Direct check and fix".

### Forwarded with a known omission

These parts of the incumbent's behavior are not ported and do not stop a command.
Each is a deliberate choice,
open to veto.

#### Index-writer coordination

Ledger source: "Index-writer coordination and landing lease".
The incumbent makes a command that writes the index wait for the landing lock.
The native executable does not take that lock.
The leftover-state refusal stands in for it:
a landing transaction has a registry entry,
and any entry refuses the command.
The check and the forward are not atomic,
so a transaction that registers in between is not seen.

#### Recovery on the read-only path

Ledger sources:
"Startup order",
"Crash recovery".
The incumbent recovers dead transactions and interrupted worktree copies before read-only commands too.
The native executable forwards a read-only command without looking,
because the fast path reads neither configuration nor leftover state.
A read-only command changes nothing a recovery would protect.
The research brief `cli-git-rust-open-decisions.md`,
section "Recovery before read-only commands",
reads the spec as requiring recovery there too once recovery is ported.
That conflicts with this fast path.
The coordinating agent will put it to the human with the questions of the transactions phase;
nothing here was changed for it.

#### Post-command output

Ledger source: "Post-command output".
The line after `git --version` and the note after `git status` are not printed:
forwarding replaces the process,
so nothing runs after Git.
The status-hints transform is applied,
so plain `git status` shows neither Git's hints nor the incumbent's note.

#### An aliased commit

`src/policy-engine/commit-transaction.ts:109-110` applies the commit transaction
only when the command word is literally `commit`.
An alias that expands to `commit` therefore runs as a plain Git commit under the incumbent,
without a transaction and without commit policies.
The native executable reproduces this:
from the main worktree a command word Git does not build in is forwarded.
The ledger does not list it as a defect.
Refusing every such word everywhere is a one-condition change in `refusal_frontier::command_frontier`
and would close the path at the cost of refusing every alias and external command.

## Hazards

### Hazard 1, controls before the subcommand

`wrapper_controls::strip_global_controls` removes every control from the global position
before any rule reads the command:
it removes the token at which Git's own global-option reader reports an invalid option,
if that token spells a control,
and repeats.
A control that is the value of `-C` or `-c` is left alone.
`entry::plan_invocation` runs it before the management namespace is detected,
so a control before `cli-git` does not hide the namespace;
the controls reach the direct command,
as they do under the incumbent.

Tests:
`controls::keep_going_before_the_subcommand_is_removed_before_any_rule_runs` runs exactly
`git --cli-git-keep-going status`.
From a subdirectory it exits 1 with one `require-root` finding and Git does not run;
at the top level its output equals `git -c advice.statusHints=false status`,
with a positive control showing that comparison can fail.
`controls::every_control_before_the_subcommand_is_removed` repeats this for all 14 general controls,
alone and between two of Git's global options,
and shows that three tokens that are not controls reach Git and are refused by it.
Both pass in the gate.

### Hazard 2, one escape-hatch mechanism

`wrapper_invocation::strip_wrapper_controls` is the only place that removes a wrapper token.
For a command with a ported option table the positions come from Git's own grammar:
`parse_options` reports each wrapper token in option position,
and the tokens are deleted by position.
The former `strip_escape_hatch` and its tests are deleted;
`escape_hatch.rs` now holds only the three spellings.

Test: `controls::a_path_named_like_a_hatch_is_forwarded_and_a_hatch_is_removed`.
With a file named `--no-enforce-worktree` and a second file staged,
`git reset --quiet -- --no-enforce-worktree` unstages only that file,
so Git received the token.
`git reset --hard` is rejected in the main worktree;
`git reset --hard -- --no-enforce-worktree` is rejected too;
`git reset --no-enforce-worktree --hard --quiet` runs and Git never sees the token.
Passes in the gate.

### Hazard 3, the refusal frontier

Recorded under "Refusal frontier".
The mutation runner's planted control "commit refusal frontier" replaces the commit refusal with a pass
and requires `frontier::a_real_commit_is_refused` to fail.

### Hazard 4, triggers that are not ported

`policy_engine::run_policy_stage` returns `StageEnd::Unavailable(Unavailable::Lifecycle(trigger))`
for the `post-commit` and `manual-push` triggers before any policy runs.
The exit code of that ending is 2.
Unit tests:
`policy_engine::tests::unported_triggers_are_unavailable_not_clean`
and `policy_pass::tests::an_unported_lifecycle_is_unavailable`.
At the binary level the `manual-push` trigger is reached by a real push
(`frontier::a_real_push_is_refused_at_the_manual_push_gate`).
The `post-commit` trigger cannot be reached from the executable,
because every commit that would land is refused first.

### Hazard 5, the read-only fast path

The requirement as written is not met,
and cannot be met together with the decision that the root is what Git reports.
`require-root` must reject `git status` from a subdirectory,
and the root it compares against comes from Git.
What holds instead:

- A command on the skip branch never reads configuration,
  leftover state or leases.
- It starts no Git process when no policy needs a repository fact:
  native queries,
  `version`
  and `help`.
- Otherwise it starts exactly one,
  the location query,
  before the forwarded command.
  The incumbent also starts one Git process on this path,
  to resolve the worktree identity.

Test: `policy::read_only_commands_start_at_most_the_location_query`.
Real Git is a shim that appends its arguments to a log and then runs Git.
Beside an invalid configuration file and a legacy file,
four exempt commands log exactly the forwarded command,
and seven other read-only commands log exactly the location query and then the forwarded command.
Positive controls in the same fixture:
a guarded command stops on the invalid configuration after one logged query,
and with a valid file logs the query and the command.
Passes in the gate.

On the skip branch the settings are the defaults,
as under the incumbent:
a repository whose file turns `require-root` off still gets it for `git status`.

### Hazard 6, a region Git refuses

The working answer was to forward unchanged.
What is implemented:
a region Git's table refuses does not short-circuit anything.
Each rule decides what it can without the region,
the transforms leave the region as written,
and the command is forwarded for Git to refuse.
Three exceptions follow from hazard 3,
which has no latitude:
a `commit` whose region is refused is refused by the wrapper,
a `push` whose region is refused counts as publishing,
and `git stash` is guarded in every form.
A mistaken refusal by an option table therefore cannot forward a commit or a publishing push;
it can still forward a command of another kind unguarded.

Test: `controls::a_region_git_refuses_is_forwarded_unless_the_command_is_never_forwarded`:
six commands whose output and exit code 129 equal real Git's,
then the three exceptions.
Passes in the gate.

## Engine interface for the optional-policy phase

### Stage and pass

- `policy_engine::PolicyChecks` is the seam:
  `check(policy, trigger) -> PolicyOutcome`.
  `PolicyOutcome` is `Findings(Vec<PolicyFinding>)`,
  `Unavailable(&'static str)`
  or `Failed(String)`.
- `policy_engine::run_policy_stage(request, policies, checks)` runs the given policies in order
  and returns `StageResult { events, end }`.
  `StageEnd` is `Completed`,
  `Stopped`,
  `Failed`
  or `Unavailable(..)`.
- `policy_engine::StageRequest` owns `trigger`,
  `config`,
  `controls`
  and `selected`.
- `policy_pass::run_policy_pass(request, checks)` runs the three stages
  and returns `PassResult { arguments, events, end }`.
- `policy_engine::pass_exit_code(events, end)` gives 0,
  1
  or 2.
- `policy_events::render_policy_events(first_sequence, events)` renders JSON Lines.
  Events are numbered when rendered,
  once per invocation.

### Where an optional policy plugs in

`policy_checks::ShippedChecks<F>` implements `PolicyChecks` with one `match` over `PolicyId`.
The five content policies share one arm,
`check_content`,
which answers from `CandidateSource`:
`None` means the lifecycle has no candidates and the policy is clean;
`NotPorted(needs)` means there are candidates nobody can read,
and the policy is unavailable.
Porting a content policy means giving `CandidateSource` a variant that carries readable candidates
and giving that policy its own arm.
The lifecycle sets the source in two places:
`wrapped_command::prepare_guarded_command` for `git add`,
and `management::plan_management` for direct commands.

### Fix passes

`policy_convergence::converge` is the bounded loop:
at most 8 changed passes,
a repeated state ends it as a cycle,
and an adjacent equal state is stable.
It is driven through the `FixPasses` trait and tested with scripted passes.
It has no production caller,
because no ported policy proposes a correction.
`PolicyFinding::fix_available` and `PolicyEvent::FixSummary` are carried and rendered for the same reason.

### Repository facts

`repository_facts::RepositoryFacts` is the only way a policy or transform asks Git:
`location`,
`index_vs_head`,
`sequencer_state`
and `remote_guess_creates_branch`.
`GitFacts` starts one process per question,
remembers the location,
and counts its processes in `queries`.
The location is one query,
shown here on two lines:

```sh
git <global options> rev-parse --path-format=absolute --is-bare-repository \
  --git-dir --git-common-dir --show-toplevel --show-prefix
```

It gives the worktree identity,
the top level,
and the directory below it after every `-C`.
`invocation_config::load_identity_config` loads configuration from that answer and starts no process.

## Choices open to veto

### The fast path asks Git one question

Recorded under "Hazard 5, the read-only fast path".

### A refused region forwards except for commit, push and stash

Recorded under "Hazard 6, a region Git refuses".

### The manual-push gate applies without a configuration file

The incumbent runs the manual-push gate only when a configuration was loaded
(`src/bin.ts:314`).
With an empty object and no file behaving identically,
the native gate applies whenever a policy with the `manual-push` trigger is enabled.
`final-newline` is such a policy and is on by default,
so in this phase a real push is refused in every repository unless that policy is off or escaped.
The research brief [`cli-git-rust-open-decisions.md`](../planning/cli-git-rust-open-decisions.md),
section "The manual-push gate without a configuration file",
reads the evidence the same way and lists the choice as settled by it.

### Controls on commands without a ported option table

For a command with no table,
and for a region Git refuses,
controls are recognized only directly after the command word,
where no option can claim them as a value.
For `git worktree add` and `git worktree move` they are also recognized directly after that second word.
The incumbent scans every token before `--`.

### `--no-worktree-copy` is a general control

It is recognized wherever the other general controls are,
including before the subcommand.

### Hatches of optional policies are always recognized

`--no-enforce-<name>` is removed for every shipped policy,
whether or not the configuration lists it.

### Leftover state refuses on any entry

Recorded under "Leftover durable state".

### A lease refuses on presence

Recorded under "An inherited lease".

### Engine failure of a fixed transform

A fixed transform whose repository fact could not be read ends the pass with `core-incomplete`.
The code of a policy that could not finish is decided;
see "The failure code of a policy that could not finish follows its cause".
Finding validation is by construction:
a `PolicyFinding` cannot hold an unknown code or a path outside its type,
so no code is needed for an invalid finding.

### require-root inside the Git directory

Inside `.git` Git reports no top level,
so `require-root` passes.

### The remote guess is one query

`git for-each-ref --format=%(refname) refs/heads/<name> refs/remotes/*/<name>`,
compared line by line,
decides whether `git switch <name>` or `git checkout <name>` would create a branch.

### Controls before the management namespace

`git --cli-git-keep-going cli-git check --all` applies keep-going to the direct command,
and `--no-enforce-<name>` there skips that policy,
as under the incumbent,
whose direct commands read controls from the global options
(`src/management.ts:291-307`).
A control after `cli-git` is a usage error.

### An options object alone lists a policy

`{ "policies": { "security/forbidden-strings": { ... } } }` names the policy at its default severity.
This is how "a policy listed with options but no severity" is written.

## Observations

### A linked sequencer head file

`git rev-parse --path-format=absolute --git-path CHERRY_PICK_HEAD` prints the target of a symbolic link,
not the name asked for
(measured on Git 2.55.0 on the host and pinned by a unit test that passes on Git 2.56.0 in the gate).
The byte-exact reader of that answer then refuses it,
and a pathless commit ends with `core-incomplete` and exit 2.
That is fail-closed.
Git itself would call the state a cherry-pick in progress.
The incumbent tests whatever path Git printed,
so it reads the link's target.
In this phase only a dry-run commit reaches the question.

### Reftable repositories

In a repository created with `--ref-format=reftable`,
a stopped cherry-pick has no `CHERRY_PICK_HEAD` file;
`git rev-parse --verify CHERRY_PICK_HEAD` still resolves
(measured on Git 2.55.0 on the host in a scratch repository).
The sequencer fact tests files,
as the incumbent's commit-only check does (`src/rule/commit-sequencer-check.ts:108-176`),
and reads "nothing in progress" there,
so a pathless concluding commit would be rejected by commit-only.
That blocks,
it does not let anything through.
It matters when the commit path is ported.

### Status-format options make a commit a dry run

The fuzz controls found that `git commit --short` is forwarded.
It is correct:
Git turns `--dry-run` on for `--short`,
`--porcelain`,
`--long`
and `-z`.
The binary-level commit test now pins those four forms against real Git.

### Superseded query

`worktree_identity::resolve_worktree_identity` has no production caller any more;
`GitFacts::location` asks the same question with one more output line.
It is kept for its real-Git tests.

## Mutation testing

### Runner changes

`bin/mutate-native-container.mjs` passes the two exclusions recorded under "Two mutant kinds are never tried".
`bin/native-planted-controls.mjs` had a planted control named "fail-closed policy stage",
which removed the stop of every repository-changing command in `entry.rs`.
That stop no longer exists.
The control is now "commit refusal frontier":
it replaces `return Some(Unported::CommitTransaction);` in `refusal_frontier.rs` with `return None;`
and requires `frontier::a_real_commit_is_refused` to fail.
Both scripts pass Oxlint with no finding.
`mise run //package/git-policy/cli:native:mutation:list` lists mutants without building anything.

### Campaigns

The tree of commit `d8adb6015` has 357 mutants in the modules this delegation added or changed,
after the two exclusions.
They are split over scoped campaigns,
each against a gate image of its own tag so that campaigns can run side by side.

The first attempt at the campaign over the three rewritten loops
(evidence `native-mutation-u9lW01`)
ended during the planted controls with
`podman rm failed ... database is locked`.
Four planted controls had been noticed by then.
That is a Podman failure under concurrent use,
not a test result,
and the campaign was started again.

Two campaigns started side by side at that load ended at the unmutated baseline,
one with a baseline test time of 91 seconds against the limit of 90
(evidence `native-mutation-Pnugm6`),
the other with four binary-level tests failing on
"the command hit the 5-second bound"
(evidence `native-mutation-xzWpxt`).
Neither is a result.
Both were started again when the load had fallen.

### Reading a result under load

The binary-level tests bound every wrapped command to 5 seconds,
and a loaded host trips that bound without any defect.
A mutant whose only failing test failed on that bound was not caught by a test:
it was caught by the load.
Each campaign's report is therefore read twice:
cargo-mutants' own summary,
and a pass over every caught mutant's log that sets aside the mutants whose failing tests all failed on the bound.
The pass was checked against the full campaign recorded in `cli-git-native-foundation.md`,
whose counts it reproduces.

### The three rewritten loops

Evidence `native-mutation-Gqhv1V`,
against the gate image of commit `3836299a7`:
94 mutants,
88 reported caught,
6 unviable,
0 missed
and 0 timeouts.
The earlier full campaign had 9 timeouts in these three files.
None remains:
the excluded kinds are not tried,
and the three `replace += with -=` mutants no longer exist,
because the loops no longer step an index.

The second reading found one mutant caught only by the bound:
`replace || with &&` on the `MissingValue` test in `classify_config_loading`.
It was a real survivor.
Before this delegation a binary-level test killed it,
because a global option error reached the classifier.
Now the lifecycle forwards every invocation without a subcommand before it classifies,
so only the classifier's own unit tests could kill it,
and none of them covered an option error.
Commit `24cfeaaee` adds `config_loading::tests::global_option_errors_keep_the_fast_path`.
Planting the mutant fails that test and no other unit test;
with the source restored it passes.

### Scoped campaigns before the final tree

- `wrapper_controls.rs`,
  `wrapper_invocation.rs`,
  `command_worktree.rs`,
  `policy_trigger.rs`,
  `policy_events.rs`,
  `git_builtins.rs`,
  `unported.rs`,
  `action.rs`,
  against the gate image of commit `d8adb6015`
  (evidence `native-mutation-nMRlpS`):
  84 mutants,
  76 caught,
  8 unviable,
  0 missed,
  0 timeouts.
  The second reading sets nothing aside.
- `repository_location.rs`,
  `repository_facts.rs`,
  `rule_branch_worktree.rs`,
  `rule_linked_worktree.rs`,
  `rule_add_explicit.rs`,
  `git_metadata.rs`
  (evidence `native-mutation-YIs2yn`):
  85 mutants,
  3 missed,
  and 1 more caught only by the 5-second bound.
  They are dispositioned under "Survivors removed with their code".
- `policy_engine.rs`,
  `policy_convergence.rs`,
  `policy_checks.rs`,
  `policy_transforms.rs`,
  `policy_pass.rs`,
  `wrapped_command.rs`
  (evidence `native-mutation-YCTtwI`):
  stopped before any mutant,
  because the planted control "commit refusal frontier" was not noticed.
  The cause is recorded under "Planted controls read the live tree".

### Planted controls read the live tree

`bin/native-planted-controls.mjs` plants each guard removal in the source file as it is in the working tree,
then builds it inside the gate image.
The gate image is a snapshot taken earlier.
When a file a control names is edited between the gate and the campaign,
the planted file no longer fits the snapshot.
In evidence `native-mutation-YCTtwI` the planted `refusal_frontier.rs` imported two functions
that the snapshot's `wrapper_invocation.rs` did not have yet,
the build failed,
the named test never ran,
and the runner refused to trust the campaign.
That refusal is the runner working as intended.
The files the controls name must not be edited between a gate and the campaign that uses its image.

### Survivors removed with their code

Each of these could not be killed by any test on Linux.
None is excluded;
the code that produced the mutant no longer exists.
Commit `37d362484`.

#### Function variants not compiled on Linux

`cli-git-native-foundation.md` records 8 missed mutants in `#[cfg(not(unix))]` variants of
`forwarding::outcome_of`,
`forwarding::replace_process_with_real_git`,
`git_metadata::path_from_git_bytes`,
`real_git_candidate::is_executable`
and `real_git_candidate::same_inode`.
cargo-mutants 27.1.0 skips an item only for `#[cfg(test)]`,
a test attribute
or `mutants::skip`
(`src/visit.rs:861-865`, read in the v27.1.0 sources),
so it mutates a function the Linux build never compiles,
and such a mutant always passes.
Two of them appeared again in evidence `native-mutation-YIs2yn`.

Each pair of variants is now one function.
The part every system shares is ordinary code,
and only the statement that differs sits in a `#[cfg(unix)]` or `#[cfg(not(unix))]` block.
The function-level mutants are therefore exercised by the Linux tests,
and the non-Unix blocks hold no operator a mutant could change.
`outcome_of` needs no non-Unix block at all:
an exit code,
else on Unix a signal,
else a general failure,
is on other systems exactly what its former variant computed.

Nothing compiled the non-Unix code before.
`mise run //package/git-policy/cli:native:clippy:windows` now type-checks and lints the library
for `x86_64-pc-windows-gnu` with warnings denied.
It passes on commit `37d362484`.
Its positive control:
a type error planted in the non-Unix block of `is_executable` fails that task
while the Linux Clippy task still passes,
and the task passes again with the source restored.
The task checks types only;
no Windows behavior is run.

#### Two equivalent mutants in the script read

`cli-git-native-foundation.md` records two equivalent mutants in `real_git_candidate.rs`:
`filled < limit` to `filled <= limit` in the loop of `read_up_to`,
and the read limit `MAX_SCRIPT_INSPECTION_BYTES + 1 - header.len()` in `classify_candidate`.
`read_up_to` now reads through the standard library's bounded reader and has no loop.
`classify_candidate` reads the whole bound after the 4-byte header and compares the joined length with the bound:
the header is at least one byte of any file that has one,
so the read reaches past the bound exactly when the script is too large,
and no arithmetic on the limit is left.
`script_inspection_bound_is_exact` still pins the bound from both sides.

#### An offset each rule core computed for itself

`decide_linked_worktree` and `decide_add_explicit` sliced the tokens after the command word
with `prefix_len + 1`.
The mutant `prefix_len * 1` hands the option table the command word as a leading positional token,
which changes no decision either rule makes,
so no test can tell the two apart.
`global_arguments::command_tokens` now returns the command word and the tokens after it,
split by the standard library,
and the three rule cores that read a command's own options take both from it.
`command_tokens_split_after_the_global_options` tests the split.

### Final tree

Pending:
a campaign over every file of `src/native/` on the tree of commit `37d362484`,
in four parts that run side by side under their own gate images.

## Fuzzing

### Target

`package/git-policy/cli.fuzz` has a fourth target,
`wrapper_controls`,
over control removal and the wrapped-command lifecycle.
Its views,
invariants and limits are in that package's `README.md` under "`wrapper_controls`".
The invariants are stated without Git's option tables.
The lifecycle view runs with fixed repository answers at locations that do not exist on disk,
so it starts no Git and reads no configuration.

### Controls

`mise run //package/git-policy/cli.fuzz:test` runs 13 generator controls,
all passing.
The new ones run the removal invariants over every three-token input from an 87-token table,
the separator invariant around every table command,
and the frontier invariants over every two-token input at both locations with every combination of answers.
They count that every way of reading a command region,
every control effect
and every lifecycle ending is reached.

`mise run //package/git-policy/cli.fuzz:test:planted` plants nine defects one at a time in a disposable copy
and requires a control to fail for each
(evidence `package/git-policy/cli.fuzz/target/verification/planted-snVlL5`).
All nine are noticed.
Four are new:
a control spelling removed anywhere in a region read without a table,
keep-going removed without being recorded,
a forwarded real commit,
and a publishing push that skips the manual-push gate.
One existing plant was re-anchored,
because the line it replaced was in a rewritten loop.

A control failed while it was being written,
and the failure was a wrong expectation in the control:
recorded under "Status-format options make a commit a dry run".

### Smoke campaign

`mise run //package/git-policy/cli.fuzz:smoke` on the tree of commit `d8adb6015`:
AddressSanitizer targets,
30 seconds each,
in the bounded container.
Every target exited 0
(evidence `package/git-policy/cli.fuzz/target/verification/campaign-PeWOk0`):

- `global_arguments`: 834,636 executions.
- `config_loading`: 268,902 executions.
- `config_schema`: 29,924 executions.
- `wrapper_controls`: 41,774 executions.

The new target is slower per execution than the argument targets
because each execution runs the whole lifecycle twice and removal three times.
Thirty seconds is a smoke run,
not a campaign.

## Commits

In order:

- `6b14f1249`: wrapper controls removed by position, one hatch mechanism.
- `99646d0c6`: the stage, triggers, events and the bounded fix loop.
- `329de1b97`: the three configuration decisions.
- `a9010f435`: repository facts, rule cores, the shipped-policy adapter and the fixed transforms.
- `9cc45dc2c`: tests pinning the linked sequencer head file.
- `d86b7463c`: the two mutant exclusions and the listing task.
- `d1c02273a`: the three loop rewrites.
- `3836299a7`: the lifecycle, the refusal frontier and direct commands.
- `d8adb6015`: the fuzz target and the status-format commit control.
- `4bef275e6`: removal of a helper only tests called.
- `24cfeaaee`: the classifier test that kills the surviving mutant.
- `e0042aeda`: the command word and region read in one place, and the tool-cache test.
- `37d362484`: single-body platform functions, the loop-free bounded read,
  the shared command split and the Windows type-check task.
- `4133d2900`: a task that runs the repository's Rust linter over the native source.
- `090c147e7`: the `policy-incomplete` failure code.

## Superseded passages elsewhere

[`cli-git-native-foundation.md`](cli-git-native-foundation.md) still says that the executable
stops every repository-changing command,
in its sections "Authority and scope",
"What the executable does today"
and "Not ported".
Its sections "Survivors left" and "Timeouts" list 10 missed mutants and 17 timeouts;
"Survivors removed with their code" and "The three rewritten loops" record why none of them exists any more.
This document supersedes those passages.
They were left as written,
because the permission to edit that file covered only the three configuration decisions.

## Module map

All files are in `package/git-policy/cli/src/native/`;
each has a sibling `*_tests.rs`.

### Controls

- `wrapper_controls.rs`:
  the 14 general control spellings,
  their meanings,
  the `Controls` record,
  and removal before the subcommand.
- `wrapper_invocation.rs`:
  removal of every control from one invocation by position,
  how the command region was read,
  and the command word and region of the result.
- `command_worktree.rs`:
  whether a `git worktree` invocation creates or moves a worktree.
- `escape_hatch.rs`:
  three hatch spellings.

### Engine

- `policy_trigger.rs`:
  triggers,
  the trigger set of every shipped policy,
  and which lifecycles are ported.
- `policy_events.rs`:
  events and their JSON Lines rendering.
- `policy_engine.rs`:
  one stage.
- `policy_pass.rs`:
  one pass of three stages.
- `policy_convergence.rs`:
  the bounded fix loop.
- `policy_checks.rs`:
  the shipped policies over rule cores and facts.
- `policy_transforms.rs`:
  atomic-push,
  commit-only
  and status-hints,
  in order.

### Facts and rules

- `repository_location.rs`,
  `repository_facts.rs`:
  the location query and the facts interface.
- `rule_linked_worktree.rs`,
  `rule_branch_worktree.rs`,
  `rule_add_explicit.rs`:
  pure decisions of three built-in policies.
  `rule_require_root.rs` and the commit-only cores come from the command-parser delegation.

### Lifecycle and frontier

- `wrapped_command.rs`:
  the lifecycle of a wrapped command.
- `unported.rs`:
  the list of unported work and the refusal notice.
- `refusal_frontier.rs`:
  commits,
  worktree copies,
  aliases
  and leases.
- `pending_state.rs`:
  leftover transaction and worktree-copy state.
- `git_builtins.rs`:
  the built-in command names of Git 2.56.0.

### Changed foundation modules

- `entry.rs`:
  control removal,
  then management,
  then the lifecycle.
- `action.rs`:
  `Action::Forward` carries the arguments to forward and warning events.
- `management.rs`:
  direct commands run a pass.
- `invocation_config.rs`:
  configuration is loaded from the measured identity.
- `config_loading.rs`,
  `global_arguments.rs`,
  `management_arguments.rs`:
  the three loop rewrites.
  `global_arguments.rs` also gained `command_tokens`.
- `forwarding.rs`,
  `git_metadata.rs`,
  `real_git_candidate.rs`:
  one body per platform-specific function,
  and the bounded read without a loop.

### Binary-level tests

- `binary_controls_tests.rs`:
  hazards 1,
  2
  and 6.
- `binary_frontier_tests.rs`:
  hazards 3
  and 4.
- `binary_builtin_tests.rs`:
  the four pre-forward built-in policies,
  keep-going,
  a `warn` severity,
  and commit-only.
- `binary_policy_tests.rs`:
  configuration errors and hazard 5.
- `binary_management_tests.rs`:
  direct commands.

## What remains

- The commit path:
  transactions,
  hooks,
  locks,
  replay,
  recovery,
  the post-commit lifecycle
  and auto-push.
  Nothing of it is started,
  and it is the reason for the rewrite.
- Candidate content for `git add`,
  direct commands
  and manual push,
  and with it every content policy,
  including the built-in `final-newline`.
- The manual-push lifecycle.
- Worktree copy,
  alias resolution,
  lease validation,
  index-writer coordination,
  and recovery of leftover state.
- Post-command output,
  which needs forwarding that waits for Git instead of replacing the process.
- Fix application for direct fix.
- Scope validation for direct commands.
- A decision on each item under "Choices open to veto" and "Forwarded with a known omission".

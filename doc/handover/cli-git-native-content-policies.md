# cli-git native content policies

## Purpose and how to respond

This branch makes three content policies work in the native wrapper
for `git add` and for the direct `git cli-git check` and `git cli-git fix` commands:
the built-in `final-newline`,
`security/forbidden-strings`
and `mono/forbidden-root-context`.
`markdown/autofix` and `mono/dependent-version-bump` stay unported
and keep refusing with exit 2 whenever they are enabled.

Paths starting with `src/` or `bin/` are relative to `package/git-policy/cli/`;
every other path is repository-relative.

Work is recorded slice by slice as it lands.
Respond by merging the branch into `main` and by vetoing any item under "Choices open to veto".

## Status

In progress.
Done:
the differential harness probe,
the two candidate sources (slice 1),
the coded failure outcome (slice 2a),
and `final-newline` and `mono/forbidden-root-context` for `git add` and `git cli-git check` (slice 2b).

## Differential harness

### How the incumbent runs with its optional plugins

The incumbent is the built TypeScript wrapper of the main checkout,
`package/git-policy/cli/dist/final/node/index.mjs`
(built 2026-09-26 15:43, after the last source commit under `package/git-policy/cli/src`,
`cf2bf70d2` at 15:39 the same day).
It is run as `node <that file> <arguments>` with `PATH=/usr/bin:/bin`,
so its real Git is `/usr/bin/git`.

Each disposable repository lives under a `mktemp`-style directory below `${HOME}/temp/agent/`.
The directory above the repository holds a `node_modules/@monochromatic-dev/git-policy-cli` link
to the main checkout's package,
so the incumbent's `cli-git.config.ts` can import `@monochromatic-dev/git-policy-cli/ts`
when `git cli-git trust --yes` bundles it.
Every run gets a disposable `HOME`,
`GIT_CONFIG_NOSYSTEM=1`,
`GIT_CONFIG_GLOBAL=/dev/null`,
fixed author and committer identities,
and a disposable `FORBIDDEN_STRINGS_CACHE_DIR`;
`FORBIDDEN_STRINGS_RULES` is unset unless a case sets it.

### Probe result

A first probe on 2026-10-06 confirmed the harness before any Rust was written:
`git cli-git trust --yes` trusted the configuration,
`git cli-git check -- a.txt b.txt` reported one `final-newline` warning and one forbidden-strings error and exited 1,
`git add -- b.txt` staged with a `final-newline` warning,
and `git add -- a.txt` exited 1 with a redacted forbidden-strings finding and left `a.txt` unstaged.

## Slices

### Slice 1, candidate sources

Commit `3741ea3e8`.
Two sources the candidate layer did not provide,
both staged on a private copy of the real index:

- What `git add` would stage
  (`src/native/candidate_prediction.rs`, `CandidateRequest::Add`).
  The real index path comes from `git rev-parse --path-format=absolute --git-path index`,
  so `GIT_INDEX_FILE`,
  a linked worktree's own index and `--git-dir` are honored.
  The index is copied with its access and modification times
  (`src/native/candidate_private_index.rs`),
  as `index-file-timestamps.ts` does for issue #544,
  into a fresh `0700` directory named `cli-git-add-policy-<pid>-<nanoseconds>-<count>` beside it,
  which is removed when the prepared candidates are dropped.
  `git ls-files --stage -z --full-name -- :/` lists the copy before and after
  `git <prefix> add <region>` runs on it,
  and the candidates are the paths whose complete record lists differ
  (`src/native/candidate_stage.rs`, `staged_delta`),
  in the incumbent's order:
  paths the index held first,
  in index order,
  then new paths.
  `git diff-index --cached` against `HEAD`,
  limited to the changed paths with `:(top,literal)` pathspecs 2,048 at a time,
  decides additions and deletions;
  a removed path `HEAD` lacks is dropped,
  as `add-staged-delta.ts` drops it.
- The worktree files a direct command selects (`CandidateRequest::Direct`).
  `git add --all -- <pathspecs>` runs on the copy (`--all` is `:/`),
  then every stage-0 entry `ls-files --stage` lists for the same pathspecs is a candidate,
  as `direct-check-facts.ts` and `listPrivateIndexPaths` define it.

Both read bytes through the existing store and its one object reader.

The probe that chose the delta shape:
during a merge conflict `git write-tree` exits 128,
so a design that writes the index before the replay as a tree would refuse every `git add`
while any conflict remains;
the stage-record comparison does not
(`a_conflict_elsewhere_does_not_stop_the_prediction`).

The add listings put `--no-literal-pathspecs` after the caller's prefix.
Measured on the host:
with `GIT_LITERAL_PATHSPECS=1`,
`git ls-files --stage -- :/` lists nothing and exits 0,
which would have made every add look unchanged;
with `--no-literal-pathspecs` it lists the index.
The replay itself keeps the caller's mode
(`literal_pathspec_mode_cannot_empty_the_prediction`).

A new cause,
`CandidateFailure::PrivateIndexUnavailable`,
reports a copy that could not be made;
`candidate_failure_code` maps it to `content-unavailable`.

Process count,
by the counting stand-in the candidate layer's controls use:
6 Git processes for 1,
20 and 200 new files predicted and read twice,
5 for the same direct scopes,
and one more `diff-index` at 2,049 changed paths;
the positive control,
one `git cat-file blob` per candidate through the same stand-in,
counted 1,
20 and 200
(`candidate_prediction_count_tests.rs`).

Gate on that tree,
`GIT_POLICY_NATIVE_IMAGE_TAG=content-policies`:
544 unit tests,
37 binary-level tests,
1 public-interface consumer test,
Clippy passed,
exit status 0;
test image `72ada9f0761ed4a786466f3311af30fdc993ac326af249b9646dba0b89e1e315`,
base `6ec87f6d290a2f59bda5b3ffd4197058fe0749d02b4978c877e8edf6dc38802a`,
evidence `package/git-policy/cli/target/verification/native-plPDWH`.
The snapshot was copied before the next edit started.

### Slice 2a, the failure outcome carries its code

Commit `34b533adb`.
`PolicyOutcome::Failed` is now `Failed { code, message }`,
and `run_policy_stage` puts that code into the `engine-failure` event.
The three repository facts the command policies read keep `content-unavailable`.
`failed_check_ends_the_pass_with_an_engine_failure` runs both codes through the stage.

### Slice 2b, lifecycle content and the first two policies

Commit `30ce6cab5`.

- `policy_checks::CandidateSource` is renamed by role to `policy_content::LifecycleContent`
  (`None` or `Requested(CandidateRequest)`);
  `candidate_version::CandidateSource` keeps its name.
- `RepositoryFacts::candidates(request)` prepares candidates,
  so the facts seam stays the only way a check asks Git.
  `ContentState` prepares them when the first content policy reads,
  shares one version with every later content policy,
  and remembers a failure so it is reported once and not retried.
- `wrapped_command::prepare_guarded_command` requests the add's candidates for `git add` in a worktree;
  `management::plan_management` requests the scope's.
  A direct command prepares before any policy runs,
  as the incumbent does,
  and reports a scope Git refuses as one `transaction-failed` event with its trigger,
  the incumbent's code for the same failure.
- `final-newline` (`src/native/policy_final_newline.rs`) and `mono/forbidden-root-context`
  (`src/native/policy_root_context.rs`) check the candidates with the incumbent's codes and messages.
- `markdown/autofix` and `mono/dependent-version-bump` answer `Unavailable` wherever the lifecycle has candidates,
  naming "the native Markdown linter" and "planning dependent version bumps".
  `security/forbidden-strings` and a `direct-fix` correction did the same at this commit,
  until their own slices.

Gate on that tree,
`GIT_POLICY_NATIVE_IMAGE_TAG=content-policies`:
553 unit tests,
37 binary-level tests,
1 public-interface consumer test,
Clippy passed,
exit status 0;
test image `7bbeab59bab540a512ceb7b631901de62cfcbe9183f511001bdfb6848141846c`,
same base,
evidence `package/git-policy/cli/target/verification/native-BGz5rN`.
The unit count equals the host count of that commit (543 passed and 10 that need Git 2.56),
so the snapshot held the committed tree.

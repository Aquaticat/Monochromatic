# cli-git native candidates and scanner adapter

## Purpose and how to respond

This branch adds two layers to the native wrapper under `package/git-policy/cli/src/native/`:
a candidate layer that lists and reads what Git would record
(staged index state or a committed tree),
and an adapter that scans those exact bytes through the repository's forbidden-strings scanner,
linked as a library instead of started as a process.
The accepted approach is the "Git operations and candidate content"
and "Built-in policies and scanner integration" sections of
[`cli-git-rust-implementation.md`](../planning/cli-git-rust-implementation.md);
the behavior inventory is the "Candidate facts" and "forbidden-strings" sections of
[`cli-git-rust-behavior-ledger.md`](../planning/cli-git-rust-behavior-ledger.md).

Paths starting with `src/` or `bin/` are relative to `package/git-policy/cli/`;
every other path is repository-relative.

Nothing here is reachable from the executable yet.
`entry.rs`,
`management.rs`,
the engine and the built-in policies belong to another delegation;
this branch only adds library modules,
their controls,
a fuzz target,
and the build inputs the new dependency needs.

Inspect first:
the lockfile decision under "Lockfile",
the edits to files outside this delegation under "Edits outside the owned files",
and the choices under "Choices open to veto".
Respond by merging the branch into the native wrapper work and by vetoing any listed choice.

## Branch and commits

Branch `feat/cli-git-native-candidates`,
started from `main` at `a046bc1d2`
and fast-forwarded to `main` at `2cfaf22b0` before the first change
(that brought in the file-enforcer manifest commit `ff3559d89`).
Oldest first:

- `2d2f4c7e4` link the scanner crate with a lockfile seeded from the scanner's own
- `975260fc9` copy the scanner and vendor locked dependencies into the native gate image
- `265c57562` add candidate versions and the batched object reader
- `d2d8860be` give the tester ownership of vendored sources in the gate image
- `128139f32` split candidate controls under the line limit and resolve Clippy findings
- `9e55cdd84` scan candidate bytes through the linked scanner
- `1bc4bf402` name the moved scan-pass controls by their new module
- `98d20d1ab` fuzz cat-file batch reply framing and follow the subject's scanner dependency
- `e86d6eeee` parse batch object sizes with the standard integer parser
- `a678bdfe6` accept either step noticing an exited reader process
- `835930d24` pin intent-to-add listing and document the batch_reply fuzz target
- `abaa364d7` build the rules file pathname from path names on every system
- `ab9339a50` draft of this document
- `c2690ad39` run one policy pass through the public candidate and scanner interface
- `a815718f4` pin the declared-size check against a source that grows after reporting its end
- `7483bef30` update of this document
- `d34761d35` compile the test targets while the gate image is built

The commit message of `2d2f4c7e4` states wrong counts;
a corrective commit comment is on GitHub.
It says 72 packages differed from the scanner lockfile and 11 were new to the repository.
Measured:
70 registry package versions differed,
7 of those versions appear in no tracked lockfile,
and one crate name (`jiff-core`) appears in none.

## Candidate layer

### Shape

Seven flat modules,
each with sibling controls:

- `candidate_error`:
  `CandidateError { failure, message }` and the closed `CandidateFailure` list.
  Messages never contain file content or pathnames,
  because a pathname can itself be a forbidden string;
  a listing record is named by its position.
- `candidate_object`:
  `ObjectId`,
  constructible only by `parse_object_id` from 40 or 64 lowercase hexadecimal digits,
  and `CandidateMode` with `mode_from_git`.
- `candidate_batch`:
  `read_batch_reply`,
  the pure reader of one `git cat-file --batch` reply from any buffered byte stream.
- `candidate_record`:
  `parse_raw_records`,
  the pure parser of raw NUL-delimited changed-path records.
- `candidate_reader`:
  `ObjectReader`,
  the long-lived `git cat-file --batch` process.
- `candidate_version`:
  `CandidateSource`,
  `CandidateIdentity`,
  `Candidate`,
  and the immutable `CandidateVersion`.
- `candidate_store`:
  `CandidateStore`,
  the per-invocation owner of versions,
  bytes and invalidation.

A candidate carries its identity
(the store's generation and its position in the version),
its pathname as the raw bytes Git printed,
its mode,
its change against the baseline (`Added`,
`Modified` or `Deleted`),
and its object name,
absent for a deleted path.
Pathnames are never decoded.

### Listing

One listing process names every changed path of a version.
The commands,
verified against Git 2.56.0 in the gate image before any code was written:

```sh
# doc/handover/cli-git-native-candidates.md
git diff-index --cached --raw -z --no-renames --no-abbrev <commit or empty tree> --
git diff-tree --root --no-commit-id -r -z -m --no-renames --no-abbrev <commit>
git hash-object -t tree --stdin
```

`CandidateSource::StagedAgainstHead` asks the running reader for `HEAD`.
A repository without commits answers `HEAD missing`;
the store then computes the empty tree's name with `hash-object` on empty input,
which works for SHA-1 and SHA-256 repositories,
and every index entry is an addition.
`StagedAgainstCommit` compares the index with one named commit,
such as a transaction's recorded base.
`Committed` lists one commit against each of its parents;
a merge lists one comparison per parent,
and the first record of a pathname wins,
as in `src/policy-engine/raw-diff-records.ts`.

Rename detection is off:
a renamed file is one deleted path and one added path naming the same object.
A conflicted index entry (status `U`) fails the whole listing with `UnmergedPath`.
Statuses other than `A`,
`M`,
`T` and `D`,
and modes other than `100644`,
`100755`,
`120000` and `160000`,
are refused.
Output that does not end with a NUL,
or that holds a record without its pathname,
is refused whole:
a partial list would leave paths unchecked.

The environment overlay reaches both the listing and the reader,
so `GIT_INDEX_FILE` selects a private index and `GIT_OBJECT_DIRECTORY` a private object directory.
Both are controlled.
One store,
and so one reader,
is bound to one overlay for its whole life.

### Object reader

`ObjectReader` starts `git cat-file --batch` once and alternates strictly:
one request line,
then its whole reply.
Only complete object names and the fixed word `HEAD` are ever written as requests.
A reply is framed by its declared size alone,
never by searching content,
so content that imitates a reply header cannot move the frame.
A found reply to a request by name must name that object.
Any reply failure closes both pipes,
so no later request can be answered from a stream that is out of step.
Blob bytes are remembered by object name and shared as `Rc<[u8]>`;
a name always denotes the same bytes,
so a remembered blob cannot become stale.
Dropping the reader closes the pipes and waits for the process;
a control observes that no live or zombie process entry remains.

The header length is bounded at 128 bytes.
Content is read with `take(size).read_to_end`,
which grows the buffer only as bytes arrive,
so a header that claims an enormous size ends as a truncated-reply failure and not as one allocation.

### Invalidation

`CandidateStore::version` lists a source once per generation and returns the same shared value afterwards.
`CandidateStore::invalidate` retires every version and advances the generation.
`CandidateStore::bytes` refuses a candidate of an earlier generation with `StaleCandidate`
instead of answering with bytes that may be outdated.
Blob bytes stay remembered across an invalidation.
The reader finds objects written after it started,
which a fix that stages new content requires;
this is controlled.

### Entry kinds

Controls against real Git 2.56.0 cover each kind the delegation named:

- Non-UTF-8 pathnames and non-UTF-8 content,
  including NUL bytes.
- Symbolic links:
  the bytes are the link target.
- Submodules (gitlinks):
  no blob exists in this repository,
  so the bytes are the submodule commit's name,
  as in `src/policy-engine/commit-transaction-candidates.ts`,
  and the reader is never asked.
- Deleted paths:
  no object and no bytes.
- Renamed paths:
  a deletion and an addition of the same object.
- Empty files.
- Type changes,
  mode changes,
  an unborn `HEAD`,
  a SHA-256 repository,
  a root commit and a merge commit.
- Intent-to-add entries (`git add --intent-to-add`):
  Git 2.56.0 lists one as an addition of the empty blob,
  which it stored when the intent was recorded,
  so the candidate has empty content.

Not exercised:
sparse and split indexes.

## Process-count bound

### Mechanism

`candidate_process_count_tests.rs` gives the store a counting `git` as its Git executable:
a script that appends one line to a count file and then executes `/usr/bin/git`.
The count is taken by the operating system's append,
outside the store's own bookkeeping.

### Measurement

For 1,
20 and 200 staged files of distinct content,
listing the staged version and reading every candidate's bytes twice started 2 Git processes each time:
the reader and one `diff-index`.
A new listing after `invalidate` started 1 more and no second reader.
A repository without commits started 3:
the reader,
`hash-object` and `diff-index`.

### Positive control

A per-file reader through the same counting script,
one `git cat-file blob <oid>` per candidate,
was counted 1,
20 and 200 times for the same repositories.
The mechanism therefore shows growth when there is growth.

### Limit of the mechanism

The script counts starts of the executable the store was given.
It would not see a start that bypassed that path.
Two controls close that gap from the other side:
with a nonexistent executable path,
both the listing and the reader fail with `GitNotStarted`,
so neither has another way to reach Git.
Processes Git itself might start are not counted;
`cat-file`,
`diff-index`,
`diff-tree` and `hash-object` are built-in commands.
The ledger's `strace` observation at the executable is still open,
because the executable does not call this layer yet.

## Scanner adapter

### Shape

- `scanner_adapter`:
  `CandidateScanner::load` calls the scanner's `Scanner::load` once;
  `scan` passes a candidate's pathname and bytes to `Scanner::scan`
  and returns the scanner's own `CandidateScan`;
  `cache_warnings` returns the scanner's own `CacheWarning` values.
- `scanner_selection`:
  the rules-file precedence and which candidates are scanned.
- `scanner_run`:
  `scan_version` reads each eligible candidate from the store and scans it,
  returning a result for every candidate scanned,
  clean ones included.

The adapter adds no catch of its own and filters no finding.
The scanner's fail-closed findings (`EngineError`,
`PathnameLineBreak`) come back like any other finding.
A load failure leaves no scanner at all;
its message is the scanner's redacted text.
The first candidate that cannot be read or named ends a pass with no partial result.

The scan identity is the candidate's position in its version,
so a finding is attributed without reading the display path,
which the scanner may have masked.

### Rules file and eligibility

`rules_source` restates the standalone scanner's precedence:
`FORBIDDEN_STRINGS_RULES` if set,
else `forbidden-strings.local.txt` in the repository root,
and a set variable makes a missing file an error.
The spawned scanner ran with the repository root as its working directory;
in-process the root is joined explicitly.

`is_scannable` restates `src/optional/forbidden-strings/scan-candidates.ts`
and `materialize-candidates.ts`:
deleted candidates are not scanned,
the three rule-source paths are not scanned,
and the rules file's own candidate is not scanned.
`rules_candidate_path` resolves the rules file to its repository-relative pathname by names alone,
as the TypeScript policy did.

### Candidate-byte isolation

`scanner_run_tests.rs`,
in one staged version:

- a file staged clean whose worktree copy then gained the planted token:
  no finding;
- a file staged with the token whose worktree copy was then cleaned:
  `Content { line: 2, rule: "0" }`;
- a file staged with the token and then removed from the worktree:
  the same finding;
- a symbolic link whose target is the token:
  `Content { line: 1, rule: "0" }`;
- an untracked file holding the token:
  not a candidate.

The reverse direction is also the positive control:
the same bytes are reported when they are what is staged.
For a committed version,
the commit's bytes are scanned after the worktree and index swapped which file holds the token,
and a pathname component equal to the token is reported as `Name { component: 1, rule: "0" }`
with the display path masked.
No result's debug text contains the token.

The planted token is assembled at run time,
so this repository's own commit policy cannot report it in the control sources.

### Consumer contracts

The scanner's README section "In-process candidate scans" puts two duties on the linking executable.

The effective profile must unwind.
`scanner_adapter.rs` holds a build-time assertion on `cfg!(panic = "unwind")`.
Planted proof:
`CARGO_PROFILE_DEV_PANIC=abort mise run //package/git-policy/cli:native:check`
fails with the assertion's message,
and the same task without the variable passes.

A panic hook that prints no payload must be installed before the first scan.
That is `main.rs`,
which this delegation does not own.
The hook the scanner's own executable installs is:

```rust
// package/cli/forbidden-strings/src/process_boundary.rs
pub(super) fn omit_panic_payload(_information: &std::panic::PanicHookInfo<'_>) {}
```

Until the wrapper's `main.rs` installs an equivalent hook,
a caught matcher panic would still print Rust's default panic message,
which can include bytes from the file being scanned.

### Controls and their isolation

Loading runtime rules reads the home directory and writes the per-user rule cache.
Each control that loads rules re-runs itself in a child process
whose `HOME` and `FORBIDDEN_STRINGS_CACHE_DIR` are a disposable fixture
(`scanner_test_support.rs`),
as the scanner's own `tests/embedding.rs` does.
The parent requires that exactly one test ran and passed.
That requirement caught a real mistake during this work:
two controls still named their old module after a file split,
and the driver reported that zero tests had run.

"Loaded once" is observed,
not assumed:
after one load the rules file and the cache directory are deleted,
and later scans still report with the loaded rules.

### Public-interface consumer

`candidate_consumer_tests.rs` is a separate test target (`native_candidates`),
so it can reach only public items,
as the policy engine will from other modules.
It runs one whole pass:
select the rules file with `rules_source`,
load once,
list the staged version,
`scan_version`,
attribute the finding to its candidate by identity,
then stage a fix,
call `invalidate`,
observe that the earlier version is refused,
and pass again on the new version with no finding.
It is the closest control to the ledger's consumer-level test that exists before the executable calls these layers.

### Differences from the TypeScript policy

- A candidate pathname containing a line break was an engine failure
  (`repositoryCandidateName` threw).
  Here the scanner reports its fail-closed `PathnameLineBreak` finding.
  Which exit status that maps to is the policy phase's decision.
- A `FORBIDDEN_STRINGS_RULES` value that is not UTF-8 is used as a path.
  The standalone scanner reads the variable as UTF-8 and treats such a value as unset.
- The `executable` option is gone,
  as the ledger's "forbidden-strings" section records.

## Manifest and lockfile

### file-enforcer

`file-enforcer.config.ts` manages Cargo manifests by guarded key enforcement
(`buildCargoManifestPlan`),
not by generating them.
The scanner dependency is not in `CARGO_SHARED_DEPENDENCIES`
and `package/git-policy/cli` is not in `CARGO_PROFILE_BY_DIR`.
The dependency and profile lines were therefore added by hand.
Observed,
not inferred:
`mise run file-enforcer` in this worktree left `package/git-policy/cli/Cargo.toml` byte-identical.
It did rewrite the root `mise.toml` and `package/config/pnpr/config.yaml`,
which is unrelated drift also present in the main checkout;
those two changes were discarded here and are not part of this branch.

The manifest gains `[profile.dev.build-override]` and `[profile.release.build-override]` with `opt-level = 3`.
Cargo reads profiles only from the root manifest,
so the scanner's own override does not reach this crate,
and its build script would otherwise compile the embedded baseline unoptimized.
`package/cli/forbidden-strings.fuzz/Cargo.toml` is the precedent.

### Lockfile

`mise run //package/git-policy/cli:native:lock` (`cargo generate-lockfile --offline`)
resolves every dependency to the newest version in the local Cargo cache.
Its output was inspected and not committed:
70 registry package versions differed from the scanner's own lockfile,
among them the matcher's dependencies
(`aho-corasick` 1.1.5 for 1.1.4,
`regex-automata` 0.4.18 for 0.4.14,
`memchr` 2.8.3 for 2.8.0),
7 versions that no tracked lockfile holds,
and one crate (`jiff-core`) that no tracked lockfile holds.
That would have linked the scanner against versions its own verification never ran on,
and added third-party code beyond the one dependency this delegation allows.

The committed lockfile is the scanner's lockfile plus this crate and `monochromatic-jsonc-edit`:
155 packages,
153 of them identical to `package/cli/forbidden-strings/Cargo.lock`.
It is produced by a new task:

```toml
# package/git-policy/cli/mise.toml
[tasks."native:lock:scanner"]
run = ["cp ../../cli/forbidden-strings/Cargo.lock Cargo.lock", "cargo update --workspace --offline"]
```

`native:lock` is unchanged and would undo this.
Whether it should be redefined is a choice for the owner of that task.
The lockfile was not edited by hand.

### Gate snapshot and vendoring

The gate container has no network.
`bin/native-scanner-snapshot.mjs` copies the scanner crate
(`Cargo.toml`,
`Cargo.lock`,
`build.rs`,
`src`,
`data`)
and `package/rust-module/forbidden-regex`,
and runs `cargo vendor --offline --locked --versioned-dirs` on the host.
Vendoring succeeded from the existing Cargo cache
(151 packages,
113 MiB),
so no `native:dependencies:fetch` task was added.
It succeeded because this host had already downloaded every archive the scanner's lockfile names.
A host that has not needs `cargo fetch --locked` in the wrapper package once before the gate,
and has no task for it;
that is the case the delegation's `native:dependencies:fetch` task was meant for.
The image copies the vendored sources with `--chown=1000:1000`:
`fnv-1.0.7/.travis.yml` is mode `0640` in its archive,
and the first gate run stopped because the tester could not read it.

The memory bound was not raised and compiler jobs were not lowered;
the build was never killed.
The container build of the test targets took 125 seconds with the scanner in one run,
between 183 and 301 seconds in runs that shared the host with other sessions' builds,
and 3.51 seconds for the wrapper alone in the baseline run.

Every container started from the gate image used to compile from nothing:
the gate's test run,
each of the mutation runner's five planted controls,
and the mutation baseline,
which the runner bounds at 300 seconds per build.
Commit `d34761d35` adds one build step to the image
(`cargo test --offline --locked --all-targets --no-run`),
so those containers rebuild only what changed.
The Clippy run uses the mounted host toolchain and still compiles for itself.

## Gate results

The gate is `GIT_POLICY_NATIVE_IMAGE_TAG=candidates mise run //package/git-policy/cli:native:test:container`.
Every run is listed,
failed ones included.

- Baseline on the merged tree (`2cfaf22b0`):
  322 unit tests,
  21 binary-level tests,
  Clippy passed.
  Evidence `package/git-policy/cli/target/verification/native-Lr0W4j`.
- First run with the dependency (sources of `265c57562`):
  stopped before compiling on the unreadable vendored file.
  Evidence `native-CgkwVM`.
- Candidate layer (sources of `265c57562` with the ownership fix):
  382 unit tests and 21 binary-level tests passed;
  Clippy failed on `collapsible_if` and twice on `chunks_exact_to_as_chunks`.
  Evidence `native-IsacfX`.
- Candidates and scanner adapter (`9e55cdd84`):
  393 of 395 unit tests passed;
  the two failures were the mistyped control names described under "Controls and their isolation".
  Clippy did not run.
  Evidence `native-bP1bMZ`.
- `1bc4bf402`:
  394 of 395 unit tests passed.
  `request_to_an_exited_process_is_a_reader_failure` failed:
  the write to the exited stand-in succeeded and the read reported the ended stream.
  A child another test thread is starting can hold an inherited copy of the pipe until it executes,
  so which step notices is not fixed.
  The control now accepts either;
  the failure kind and the closed reader are what it pins.
  Evidence `native-zGeY5k`.
- `a678bdfe6`:
  395 unit tests,
  21 binary-level tests,
  Clippy passed.
  Test image `1206b4c7bfccc5b9107e06566ff27e2b4fa5ac8f932fcac466611d4d97100f88`;
  evidence `native-QBnkSC`.
- `abaa364d7`:
  396 unit tests and 21 binary-level tests passed,
  then `podman run` of the test container returned status 127 without a message,
  and Clippy did not run.
  Other Podman commands failed with `database is locked` in the same minutes,
  while other sessions were running containers on the host;
  the cause of the 127 was not established.
  This run is not counted as a pass.
  Evidence `native-1cOzuy`.
- `c2690ad39`:
  396 unit tests,
  21 binary-level tests,
  1 public-interface consumer test,
  Clippy passed.
  The host's load average was above 70 with other sessions' containers,
  and the unit tests took 147.55 seconds where an unloaded run took 6.03.
  Evidence `native-81pAf1`.
- `a815718f4`,
  before the image build step existed:
  stopped by hand while the image was being built,
  because the runner was about to change.
  It produced no result.
- Final run,
  on the sources of `a815718f4` with the runner of `d34761d35`:
  398 unit tests in the library,
  0 unit tests in the executable,
  21 binary-level tests (`native_binary`),
  1 public-interface consumer test (`native_candidates`),
  Clippy passed,
  exit status 0.
  The image build compiled the test targets in 4 minutes 16 seconds;
  the test container then found them built in 10.22 seconds.
  The unit tests took 63.82 seconds with the host's load average between 70 and 106.
  Test image `9ffa5c481579a9f6501944626169fbb599602ce8458e0aa19f052c840ee65721`;
  evidence `native-fm9zle`.
  The commits after `a815718f4` change only the runner and this document.

## Mutation testing

### Campaigns

`native:mutation:scoped` binds to the last gate image by tag,
plants its five guard removals,
then runs cargo-mutants 27.1.0 with a 300-second build bound and a 90-second test bound.
All campaigns here ran against the final gate image
`9ffa5c481579a9f6501944626169fbb599602ce8458e0aa19f052c840ee65721`.

The ten new source files were split over three campaigns that ran at the same time,
because one mutant took minutes on the shared host.
The runner names its campaign image by the tag,
so campaigns that run together need different tags.
The second and third campaign therefore used the tags `candidates-b` and `candidates-c`,
which `podman tag` made further names of the same gate image;
each campaign's `manifest.json` records that image identity as `baseImage`.
This departs from "always `candidates`" in the delegation;
the tags are this worktree's own.

- Tag `candidates`:
  `candidate_batch.rs`,
  `candidate_record.rs`,
  `candidate_object.rs`,
  `candidate_error.rs`.
- Tag `candidates-b`:
  `candidate_reader.rs`,
  `candidate_store.rs`,
  `candidate_version.rs`.
- Tag `candidates-c`:
  `scanner_adapter.rs`,
  `scanner_run.rs`,
  `scanner_selection.rs`.

### Results

Across the three campaigns cargo-mutants generated 147 mutants:
114 were caught,
33 did not compile,
none was missed and none timed out.
There was no survivor to disposition,
no mutant was excluded,
and no source or test changed after the campaigns.
Every campaign exited with status 0 and noticed all five planted guard removals first.

- Tag `candidates`,
  evidence `package/git-policy/cli/target/verification/native-mutation-oRwTOn`:
  84 mutants,
  73 caught,
  11 did not compile.
  `candidate_batch.rs` 36 caught and 5 not compiled,
  `candidate_record.rs` 21 and 4,
  `candidate_object.rs` 15 and 2,
  `candidate_error.rs` 1 and 0.
  Unmutated baseline:
  2.2 seconds to build,
  62.3 seconds to test.
- Tag `candidates-b`,
  evidence `native-mutation-qkwQPV`:
  39 mutants,
  22 caught,
  17 did not compile.
  `candidate_reader.rs` 4 caught and 7 not compiled,
  `candidate_store.rs` 16 and 7,
  `candidate_version.rs` 2 and 3.
  Unmutated baseline:
  0.2 seconds to build,
  67.5 seconds to test.
- Tag `candidates-c`,
  evidence `native-mutation-2k2Nnt`:
  24 mutants,
  19 caught,
  5 did not compile.
  `scanner_adapter.rs` 2 caught and 3 not compiled,
  `scanner_run.rs` 3 and 1,
  `scanner_selection.rs` 14 and 1.
  Unmutated baseline:
  0.2 seconds to build,
  67.2 seconds to test.

### Margin to the test bound

The host was shared,
so the unmutated suite took 62 to 68 seconds against the 90-second bound.
The slowest test run of any mutant took 81.3 seconds and ended in a failing test,
so it was caught,
not timed out.
A mutant that no test notices has to pass the whole suite,
which on this host took about as long as the baseline;
the margin was about 22 seconds.
`timeout.txt` and `missed.txt` are empty in all three campaigns,
so nothing here rests on a timeout.
A rerun on a busier host can turn caught mutants into timeouts;
compare each with the `Unmutated baseline` line of the same run before reading it as a hang.

MUTATION-UNVIABLE-PENDING

## Fuzzing

### Target

`package/git-policy/cli.fuzz` gains `batch_reply` over `read_batch_reply`.
Each input is used twice:
split at its first line feed into a request and a raw stream,
and mapped by `generated_reply` to one of 14 built shapes with the outcome it must have
(canonical replies for each object kind and both hash formats,
missing notices,
a reply for another object,
content shorter and longer than declared,
a stream ending in the header or before the closing line feed,
an overlong header,
headers Git never prints,
a missing notice for another request,
and an empty stream).

`check_batch_reply` asserts,
for any bytes:
reading is repeatable;
an accepted reply is byte for byte Git's canonical rendering of the returned value;
a reply to a request by name names that object;
bytes after the reply change nothing;
no sampled proper prefix of an accepted reply is accepted;
and a refusal is one of the four reply failures,
"ended" only for an empty stream.

### Controls

`mise run //package/git-policy/cli.fuzz:test` passes 11 generator controls,
4 of them new.
They count that the generator reaches every object kind,
both hash formats,
a missing notice and all four failures.
`mise run //package/git-policy/cli.fuzz:test:planted` plants 7 defects,
2 of them new,
and all were noticed:
"object content past its declared size is accepted"
and "an object reply for another object is accepted"
were each noticed by `batch::tests::fixed_hard_cases_hold` and `batch::tests::generated_replies_reach_every_outcome`.
Evidence `package/git-policy/cli.fuzz/target/verification/planted-2bQ4Q5`.

A first choice of planted defect,
removing the check that fewer content bytes arrived than declared,
was dropped before it ran:
a stream that ends early also fails the read of the closing line feed,
so on a pipe that removal changes only the message.
The check stays,
because the reply reader accepts any buffered source:
`candidate_batch_resume_tests.rs` gives it a source that reports its end and then yields a line feed,
as a file still being written can,
and the check is what refuses the shortened content there.

### Smoke campaign

`GIT_POLICY_NATIVE_IMAGE_TAG=candidates mise run //package/git-policy/cli.fuzz:smoke`
builds the four targets with AddressSanitizer in a bounded container and fuzzes each for 30 seconds
with no host mounts,
no network,
2 GiB,
2 CPUs,
128 PIDs
and a 4,096-byte input limit.

The first run did not reach the new target.
`global_arguments` reported 401,541 executions and `config_loading` 142,750,
each with exit status 0;
`config_schema` ran,
and then a Podman command failed with `database is locked`
and the runner's cleanup failed the same way,
while other sessions were running containers on the host.
Three leftover containers of this worktree's run image were removed by hand.
Evidence `package/git-policy/cli.fuzz/target/verification/campaign-xNWDLy`.

The second run,
on the sources of `a815718f4`,
exited with status 0:

- `global_arguments`: 971,930 executions, exit status 0.
- `config_loading`: 363,596 executions, exit status 0.
- `config_schema`: 19,909 executions, exit status 0.
- `batch_reply`: 89,225 executions in 31 seconds, exit status 0,
  684 inputs added to the corpus,
  no crash artifact,
  peak resident memory 483 MiB.

Evidence `package/git-policy/cli.fuzz/target/verification/campaign-zPxrE8`;
its manifest records base image `62ba2f7ce22ba9bc501110d3452c7ae814fba367c46f7eea3629a79286353884`.
The execution counts of the first three targets differ from the first run by more than a factor of two;
both runs shared the host with other sessions,
so the counts say the targets ran,
not how fast they are.

## Public API for the optional-policy phase

All under `git_policy_cli::`.

```rust
// package/git-policy/cli/src/native/candidate_store.rs
impl CandidateStore {
    pub fn new(real_git: &Path, global_prefix: &[OsString], overlay: &[(OsString, OsString)]) -> CandidateStore;
    pub fn version(&mut self, source: &CandidateSource) -> Result<Rc<CandidateVersion>, CandidateError>;
    pub fn bytes(&mut self, candidate: &Candidate) -> Result<Rc<[u8]>, CandidateError>;
    pub fn invalidate(&mut self);
}

// package/git-policy/cli/src/native/candidate_version.rs
pub enum CandidateSource { StagedAgainstHead, StagedAgainstCommit(ObjectId), Committed(ObjectId) }
pub struct CandidateIdentity { pub generation: u64, pub index: usize }
pub struct Candidate {
    pub identity: CandidateIdentity,
    pub path: Vec<u8>,
    pub mode: CandidateMode,
    pub change: CandidateChange,
    pub object: Option<ObjectId>,
}
impl CandidateVersion {
    pub fn candidates(&self) -> &[Candidate];
    pub fn candidate_at_path(&self, path: &[u8]) -> Option<&Candidate>;
}

// package/git-policy/cli/src/native/scanner_adapter.rs
pub struct RulesSource { pub path: PathBuf, pub explicit: bool }
impl CandidateScanner {
    pub fn load(rules: &RulesSource, builtin_rules: bool) -> Result<CandidateScanner, ScannerError>;
    pub fn cache_warnings(&self) -> &[forbidden_strings::CacheWarning];
    pub fn scan(&self, candidate: &Candidate, bytes: &[u8]) -> Result<forbidden_strings::CandidateScan, ScannerError>;
}

// package/git-policy/cli/src/native/scanner_selection.rs
pub fn rules_source(configured: Option<&OsStr>, repository_root: &Path) -> RulesSource;
pub fn rules_candidate_path(rules_path: &Path, repository_root: &Path) -> Option<Vec<u8>>;
pub fn is_scannable(candidate: &Candidate, rules_path: Option<&[u8]>) -> bool;

// package/git-policy/cli/src/native/scanner_run.rs
pub fn scan_version(
    scanner: &CandidateScanner,
    store: &mut CandidateStore,
    version: &CandidateVersion,
    rules_path: Option<&[u8]>,
) -> Result<Vec<forbidden_strings::CandidateScan>, ScanRunError>;
```

Also public:
`candidate_object::{ObjectId, parse_object_id, CandidateMode}`,
`candidate_record::CandidateChange`,
`candidate_error::{CandidateError, CandidateFailure}`,
`scanner_adapter::{ScannerError, ScannerFailure}`,
`scanner_run::ScanRunError`,
and the pure parsers `candidate_batch::read_batch_reply` and `candidate_record::parse_raw_records`,
which the fuzz sidecar uses.

A policy pass is:
create one `CandidateStore` per invocation with the caller's global prefix and child environment overlay;
take `version(source)`;
load one `CandidateScanner` if the policy is enabled;
call `scan_version`;
map each `CandidateScan` by `identity` back to `version.candidates()[identity]`.
After a fix or replay,
call `invalidate` and take the version again.

## Gaps in the scanner's embedding API

None blocks this work.
Three are worth the scanner owner's attention:

- `Scanner::load` returns `anyhow::Result`.
  The wrapper has no `anyhow` dependency and may not add one,
  so the adapter can only render the failure as text;
  it cannot branch on a missing file versus an invalid rule versus a cache configuration error.
  A typed load error would let the policy phase choose engine-failure codes.
- A consumer cannot provoke a loader or matcher panic,
  so the wrapper cannot observe the scanner's catch boundary end to end.
  The build-time unwind assertion is the only consumer-side control.
  The scanner's own guard tasks cover the boundary inside the scanner.
- The payload-free panic hook (`omit_panic_payload`) is private to the scanner's executable.
  Every embedding host has to restate it.
  Exporting it would give hosts one definition.

The rules-file precedence and the self-match exclusions live in the scanner's executable and in the TypeScript policy,
not in the library.
They are restated in `scanner_selection.rs`.
That is duplication by position,
not a gap in what the library can do.

## Edits outside the owned files

The delegation owned new `candidate_*.rs` and `scanner_*.rs` files,
`lib.rs` module declarations,
the wrapper manifest and lockfile,
one fuzz target and its registration,
and this document.
Linking the scanner made these further edits necessary;
each is additive.

- `package/git-policy/cli/bin/test-native-container.mjs`:
  one import,
  `...scannerSnapshotEntries({ context })` in the copy list,
  one `await vendorLockedDependencies({ context: context.path })`,
  two `COPY --chown=1000:1000` lines for `vendor` and `cargo-config`,
  and one `RUN ["cargo", "test", "--offline", "--locked", "--all-targets", "--no-run"]` line
  after `WORKDIR`,
  described under "Gate snapshot and vendoring".
  Commits `975260fc9`,
  `d2d8860be` and `d34761d35`.
- `package/git-policy/cli/bin/native-scanner-snapshot.mjs`:
  new,
  holding those two helpers so the runner stays under the 300-line limit of its Oxlint configuration.
  Both files pass `mise run //package/git-policy/cli:lint:oxlint:paths`.
- `package/git-policy/cli/mise.toml`:
  the `native:lock:scanner` task appended.
- `package/git-policy/cli.fuzz/Cargo.toml`:
  the `batch_reply` target and the two build-override profiles.
- `package/git-policy/cli.fuzz/Cargo.lock`:
  regenerated as the wrapper lockfile plus the sidecar's 8 own packages.
  The 7 packages it previously shared with the wrapper's dependency tree moved to the scanner lockfile's versions;
  the sidecar-only packages kept their versions.
- `package/git-policy/cli.fuzz/mise.toml`:
  a `lock:subject` task appended,
  the sidecar's counterpart of `native:lock:scanner`.
- `package/git-policy/cli.fuzz/bin/container.mjs`:
  one `targets` entry,
  and `copyInputs` also copies the scanner and its engine.
- `package/git-policy/cli.fuzz/bin/planted-controls.mjs`:
  the scanner and engine inputs,
  and 2 planted defects.
- `package/git-policy/cli.fuzz/src/lib.rs`,
  `src/batch.rs`,
  `src/batch_tests.rs`,
  `seed/batch_reply`,
  `dictionary/batch_reply.dict`:
  the target's generator,
  invariants,
  controls and inputs.

Without the copies in the two sidecar runners,
the existing `smoke` and `test:planted` tasks would no longer build,
because the subject they compile now depends on the scanner.

No `.ts` file and nothing under `package/cli/forbidden-strings` was edited.

## Choices open to veto

- The lockfile is seeded from the scanner's lockfile instead of taken from `native:lock`.
  Reason under "Lockfile".
- `native:lock:scanner` and `lock:subject` are new tasks in files this delegation only partly owned.
  They exist so the committed lockfiles are reproducible through `mise run`.
- The build-override profiles in the wrapper and sidecar manifests.
- The reader's standard error is discarded.
  Nothing reads it while replies are awaited,
  and a full unread pipe would block Git,
  for example on the progress output of a lazy fetch in a partial clone.
  A reader failure therefore reports the protocol state and names the command to rerun,
  not Git's own text.
  The alternative that keeps Git's text is a thread that drains the pipe.
- `invalidate` retires every version,
  committed ones included,
  although a commit's delta cannot change.
  Taking a committed version again costs one process.
- A stale candidate is refused instead of answered from its still-valid object name.
- Gitlink bytes are the submodule commit's name and deleted bytes are empty,
  as in the TypeScript wrapper,
  instead of a separate "no content" variant.
- An intent-to-add entry is a candidate,
  although a commit does not record it.
  `git diff-index --cached --ita-invisible-in-index` hides it
  (probed in the gate image);
  Git's default was kept.
  Whether the TypeScript wrapper treated such an entry as a candidate was not checked.
- All blob bytes read in an invocation stay in memory until the store is dropped,
  as `loadBlobBatch` kept them.
- Candidates are scanned one after another.
  The standalone scanner scans files in parallel.
  No timing was measured,
  so this document makes no speed claim in either direction.

## Failed or skipped

- Of the gate runs,
  four failed,
  one ended with a Podman status 127 whose cause was not established,
  and one was stopped by hand;
  each is listed under "Gate results".
  The first fuzz smoke run failed on a Podman error before it reached the new target.
- The control for a request written to an exited process could not be made to observe one fixed step,
  for the reason given there.
  The write-failure branch of `ObjectReader::request` is reached only when the pipe has no other holder.
- No consumer-level control exists:
  the executable does not call these layers,
  so the ledger's "stage clean bytes, dirty the worktree, commit" observation and its `strace` count are open.
- Nothing here was compiled or run on Windows or macOS.
  The new modules hold no platform-specific variant;
  the adapter calls the foundation's `path_from_git_bytes`,
  whose non-Unix variant the Linux gate does not compile.
- Sparse and split indexes were not exercised.
- No timing was measured.
  The motivation for the rewrite was commit latency;
  this branch removes per-file processes and temporary files and proves the process count,
  and makes no claim about elapsed time.
- `file-enforcer` output for unrelated files was discarded,
  not committed.
- The Oxlint task was run for the two wrapper runner files only;
  the fuzz sidecar has no Oxlint task.

## What remains

- Call these layers from the policy engine:
  build the `forbidden-strings` policy over `scan_version`,
  map `ScanFinding` values and cache warnings to JSONL events,
  and decide the exit status of `EngineError` and `PathnameLineBreak`.
- Install a payload-free panic hook in `main.rs` before the first scan.
- Candidate sources this branch does not provide:
  the `git add` staged delta between two index states
  (`src/policy-engine/add-staged-delta.ts`),
  tracked files that are not candidates
  (`commit-transaction-tracked-files.ts`),
  many commits in one listing for manual push
  (`manual-push-candidates.ts`),
  and worktree bytes for direct `check`
  (`direct-check-facts.ts`).
- Policy read sets and input fingerprints,
  which decide when a recorded result may be reused after a replay.
- The consumer-level controls named under "Failed or skipped".

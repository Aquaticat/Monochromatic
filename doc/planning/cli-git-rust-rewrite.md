# Should cli-git be rewritten in Rust?

## Status and authority

Context gathering for the user's request:
"Should we rewrite our cli-git in Rust /grill-me".
No language recommendation,
architecture adoption,
or product changes are authorized by this interview.

The interview proceeds through independent preference questions first.
Architecture,
validation targets,
and migration choices follow only after their prerequisites are settled.

## Current evidence

- `package/git-policy/cli/package.json` exposes both a shadowing `git` executable and a policy-authoring import.
  The runtime range is `^24.11.0 || ^26.0.0`.
- `package/git-policy/cli/src/index.ts` exports the authoring API and runs the executable only for direct execution.
- `cli-git.config.ts` registers repository,
  forbidden-strings,
  and Markdown plugins.
  Its forbidden-strings command uses the Rust scanner executable;
  its Markdown command invokes Node.
  Rewriting the wrapper alone does not decide the runtime requirements of those consumers.
- `doc/decision/cli-git-policies-platform.md`,
  "Decision",
  "Goals",
  and "Non-goals",
  accepts trusted executable repository configuration and a pluggable policy platform.
  Working without mise is required;
  working without Node is not the same requirement.
  Registry publication is deferred,
  not replaced by an accepted native-binary distribution plan.
- `doc/decision/cli-git-concurrent-commits.md` describes private preparation,
  shadow repositories,
  compare-and-swap landing,
  replay,
  and recovery.
  A language evaluation must inventory these semantics rather than treating the package as argument forwarding alone.
- `package/git-policy/cli/SPEC.md`,
  "Benchmark method",
  defines paired real-Git baselines and separate lifecycle scenarios.
  Existing recorded results are historical evidence,
  not a fresh baseline or evidence of a Rust rewrite's effect.
- `doc/decision/monorepo-manager-all-rust.md`,
  "Status" and "Context",
  scopes its all-Rust approval to that tool and records a single-file distribution requirement.
  That requirement must not silently transfer to cli-git.

## Settled interview requirements

### Performance

The user wants faster execution throughout cli-git,
not only faster startup.
The reported experience is that a commit might take 20 seconds.
This is a reported symptom,
not an agent measurement or an attributed bottleneck.
The user then supplied a concrete observation:
staging `doc/planning/slint-ide-0x.md`,
then committing that explicit path with message `docs(planning): fix scope interview semantic line breaks`,
took 8.9 seconds in the command harness.
This is combined staging and commit elapsed time,
not an isolated commit-phase measurement.
Real Git confirms commit `c37f58ca54c197cc98bddeb37562b30d10967331` changed that Markdown file
with 10 insertions and 5 deletions.
The sample establishes an end-to-end workload to investigate,
not its cause.

No numeric acceptance budget is settled for the new design.
The incumbent benchmark already defines wrapper-added budgets in
`package/git-policy/cli/perf/lifecycle-latency-contracts.ts`,
including a 2,000 ms upper ceiling and a 1,150 ms post-commit scenario budget.
Those are synthetic-fixture overhead budgets,
not a promise that this repository's entire add/commit/push operation finishes within those times.

### Language and runtime

The user answered yes to whether achieving the desired outcomes without a rewrite would satisfy them.
Rust is a means rather than an independent goal.
Eliminating an external Node installation is not a hard requirement.

### Configuration

The user explicitly selected JSONC and removed the requirement to retain TypeScript support.
They identified the repository's recently ported Rust JSONC package for reuse.
Inspect that package before proposing another parser.
Retiring executable configuration does not by itself decide whether custom policies may run as external commands.

### Embedding

The user wants cli-git to "embed in forbidden-strings".
The direction and scope of embedding are not yet settled:
clarify whether forbidden-strings hosts the Git wrapper,
the Git wrapper calls the scanner in-process,
or both share reusable modules and a distribution artifact.
Do not silently invert the user's wording.

## Local interface inspection

- `package/rust-module/jsonc-edit/Cargo.toml` declares `monochromatic-jsonc-edit` 0.1.0 with no dependencies.
  `src/lib.rs` exports `parse_jsonc`,
  `emit_jsonc_value`,
  `parse_jsonc_edit`,
  and immutable editing operations.
  Reuse is explicitly requested;
  this interview has not rerun its tests.
- `package/cli/forbidden-strings/Cargo.toml` already defines both a library and an executable.
  `src/lib.rs` exposes rule compilation and `run_cli_from_env`,
  while scan orchestration modules remain private.
  A library target alone is not evidence that the desired embedding interface already exists.
- `node_modules/.bin/git` dispatches to the built `git-policy-cli` MJS artifact.
  The existing packed tarball and built artifact have different modification dates.
  Do not benchmark the tarball as the current installed wrapper without verifying artifact identity.

## Next preference frontier

- Clarify the embedding purpose and direction:
  hosting cli-git inside forbidden-strings,
  eliminating the scanner subprocess from cli-git,
  shared configuration,
  one installation,
  or a combination.
- Decide whether JSONC may register entirely new policies implemented as external executables,
  or only configure shipped policies.
  A shipped adapter's existing command option does not establish a generic external-plugin contract.

Performance budgets and implementation ranking await measured workload evidence.
Do not propose backgrounding auto-push as a latency remedy before measuring it.
Preserve accepted safety,
concurrent-commit,
and recovery requirements unless the user explicitly reopens them;
rewriting is not permission to drop functionality.
Trust design follows the authority granted to JSONC settings and any selected external-command model.
No implementation language,
module arrangement,
or migration strategy has been adopted.

## Pending evidence and dependent questions

- Inventory implementation responsibilities,
  consumers,
  parallel systems,
  workarounds,
  suppressions,
  tests,
  and platform contracts before recommending a replacement.
- Measure a fresh incumbent baseline and unchanged-input variability for any performance claim.
  Separate wrapper startup,
  policy execution,
  Git subprocess work,
  locking,
  filesystem work,
  and remote latency.
- Freeze relevant hard constraints and criteria from the user's answers.
- Discover and evaluate alternatives,
  including retaining the incumbent,
  before ranking implementations.
- Decide scope,
  policy execution boundary,
  parity requirements,
  migration,
  and rollback only when prerequisite preferences are settled.
- Request explicit confirmation of shared understanding before implementation.

## Installed-wrapper baseline execution

A detached worktree under the private agent scratch directory,
`cli-git-rust-latency-20261004`,
contains a temporary `perf:installed-boundary` task in `package/git-policy/cli/mise.toml`.
No production sources are changed.

The task runs the existing lifecycle benchmark twice in fresh,
mount-free containers.
It copies the installed wrapper rather than the differently dated packed tarball.
Both original and copied `index.mjs` have SHA-256
`a418ca48f202850cbda6943efe8eaaad02488c16aad5d9e7321ea10af22894cd`.

The source Containerfile for the reused local image is
`package/git-policy/cli/e2e/concurrent-commits.Containerfile`.
The pinned local base image ID is
`1d29d429cddf5663ca721fc1f4bc2480c90e09694b3acacafc648e7638748910`.
The probe reuses its installed dependencies,
replaces the wrapper artifact,
and selects its Git 2.55.0 executable.
No dependency download runs.

Execution is bounded to 2 GiB RAM,
2 CPUs,
256 PIDs,
and the existing finite sample and fixture counts.
Network is disabled;
no real home,
credentials,
repository mount,
or external remote is available.
All fixtures,
trust records,
commits,
and pushes stay inside the disposable container.
The inspected benchmark uses a synthetic scanner,
a 2,048-file tree,
and local bare remotes.
It does not reproduce the live repository's Markdown policy,
real scanner workload,
GitHub transport,
or concurrent host commits.
It cannot establish or dismiss the cause of the reported 8.9 seconds.

Invocation:
`mise run //package/git-policy/cli:perf:installed-boundary` in the detached worktree.
Managed process:
`cli-git-installed-lifecycle-baseline`.
Status:
started;
results pending.

## Next action

Ask the embedding and custom-policy questions together and wait for the user's answers.
Inspect baseline completion when notified,
then extend only the missing workload surfaces needed to reproduce the reported delay.
Keep the current implementation running;
do not port code during the interview.

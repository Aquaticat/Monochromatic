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
The user subsequently selected shipped policies only,
rejecting the proposed generic external-policy extension capability.
The user also wants the executable-config trust subsystem removed.
A broad enough built-in catalog to avoid writing new policies is a 2.x goal.
Whether 2.x scopes the catalog alone or the whole redesign remains to be clarified.

Existing built-in adapters accept executable paths and command arrays:
`package/git-policy/markdown-lint/src/index.ts` defines `command`,
and `package/git-policy/forbidden-strings/src/index.ts` defines `executable`.
The generated copies under `package/git-policy/cli/src/optional/` retain these options.
The shipped-only design must not preserve arbitrary program selection through JSONC;
that would retain the executable-config problem under a different name.
Deleting the trust subsystem does not remove the need to validate data,
constrain file writes,
or choose whether repository configuration may weaken user-required enforcement.

### Embedding

The user clarified:
"cli-git should come with forbidden-strings bundled in."
Cli-git is the distributing tool and forbidden-strings is bundled with it,
not the reverse.
Keep this product requirement distinct from selecting in-process linkage versus an owned child executable.
No scanner replacement is requested.

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

- Decide whether repository JSONC may automatically weaken enforcement,
  such as switching off secret scanning or excluding all files,
  or whether user-required policies remain a non-overridable minimum.
  This is configuration authority,
  not consent to execute code.
- Clarify whether the 2.x goal refers only to expanding the built-in catalog,
  or also to the wrapper redesign,
  JSONC,
  bundling,
  and trust removal.

Performance budgets and implementation ranking await representative workload evidence.
Do not propose backgrounding auto-push as a latency remedy before measuring it.
Preserve accepted safety,
concurrent-commit,
and recovery requirements unless the user explicitly reopens them;
rewriting is not permission to drop functionality.
The rejected alternative is a generic external-policy plugin interface.
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
completed with exit 0.
Baseline-capture mode collects measurements without enforcing performance budgets;
exit 0 is not a budget-pass result.

Raw results:

- [`installed-baseline-run-1.json`](cli-git-rust-rewrite-evidence/installed-baseline-run-1.json).
- [`installed-baseline-run-2.json`](cli-git-rust-rewrite-evidence/installed-baseline-run-2.json).

Each scenario records 30 samples after 6 warm-ups in each run.
The installed artifact identity is its recorded SHA-256;
`revision: unrecorded` in the raw benchmark output must not be represented as a verified source revision.

One-file commit plus local auto-push had wrapper wall-time medians of 436.710 and 450.966 ms.
Its paired direct Git commit plus push medians were 27.035 and 27.509 ms.
Paired wrapper-added medians were 409.953 and 423.590 ms;
wrapper-added p95 values were 444.931 and 439.857 ms.
These figures measure the synthetic fixture,
not the reported Markdown workload.

Unchanged-run variability is material elsewhere:
the 256-path commit wrapper medians were 2,336.066 and 582.359 ms.
No implementation comparison has run,
and no causal explanation for that spread is established.
Do not attribute either the spread or the real-repository delay to Rust,
Node,
trust,
network,
or contention from these samples.

Harness scope warning:
`strict-mjs`,
`strict-typescript`,
`validator`,
and `relaxed-rebuild` issue `status` commands in `lifecycle-latency-definitions.ts`.
The current `trust/command-classification.ts` classifies `status` as `skip-config`.
Their labels alone do not establish that they exercise config loading or rebuilding.
A consumer-boundary positive control remains required before drawing trust-cost conclusions.

## Next action

Ask the configuration-authority and release-scope questions together and wait for the user's answers.
Extend the fixture to exercise the actual Markdown policy and bundled scanner workload,
and validate benchmark reach with positive controls,
before attributing the reported delay or setting rewrite acceptance budgets.
Keep the current implementation running;
do not port code during the interview.

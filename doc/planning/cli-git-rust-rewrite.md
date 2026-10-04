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
No numeric acceptance budget is settled yet.

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

## Next preference frontier

- Clarify the intended embedding relationship and user-facing executable arrangement.
- Decide whether JSONC may register custom external policy commands,
  in addition to selecting built-in policies.
  This is separate from retaining TypeScript configuration.
- Establish whether latency improvements must preserve current synchronous completion semantics,
  including auto-push,
  rather than merely return the shell prompt before work completes.

Performance budgets and implementation ranking await measured workload evidence.
No language,
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

## Next action

Inspect the Rust JSONC and forbidden-strings interfaces and prepare disposable performance measurements.
Ask the next independent preference questions together and wait for the user's answers.
Keep the current implementation running;
do not port code during the interview.

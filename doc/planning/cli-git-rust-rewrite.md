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

## First-round preference frontier

### Desired outcomes

Which concrete frustration or desired capability motivates reconsidering the implementation?
Rank the outcomes that matter,
including latency,
reliability,
installation requirements,
maintainability,
and authoring experience.
The user chooses priorities;
the agent measures current behavior.

### Rust as means or goal

If retaining TypeScript achieved the desired operational outcomes,
would that satisfy the user?
Learning Rust or standardizing implementation languages is a separate possible goal,
not evidence of a performance improvement.

### Runtime distribution requirement

Is removing an external Node installation a hard requirement,
a preference,
or irrelevant for cli-git?
Distinguish requiring no separately installed Node from prohibiting any JavaScript engine.
Do not assume the monorepo manager's distribution decision applies here.

### Policy-authoring design freedom

Must repository owners retain arbitrary TypeScript or JavaScript policy functions,
imports,
and typed configuration,
or may those capabilities be redesigned?
Changing config syntax and retiring authoring capabilities are separate decisions.
The current package is unpublished;
a changed authoring model is a product design change,
not an assumed published compatibility obligation.

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

Ask the first-round preference questions together and wait for the user's answers.
No answers or rejected implementation options have been recorded yet.

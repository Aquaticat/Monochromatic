# meow software model exploration

## Status

Proposal for meow 0.x,
not an accepted model or an implementation authorization.
This continues the [from-scratch design](monorepo-manager-from-scratch-design.md)
after the user rejected carrying forward Claude's definition of a task.

The user's instruction:

> Do not accept Claude's framing of what a "task" even is.
> I believe better UX can be had by not thinking of stages that software must go through
> in development as "build task" and so on.

The previous inference,
"build and test are special task names",
is withdrawn.
The user's earlier acceptance of `meow run` syntax does not establish that everything addressed by it is a task.
The name,
override,
and namespace questionnaire assumed precisely the model now being challenged.

## Start from software rather than commands

Recommended direction:
meow maintains knowledge about software and the work needed to keep that knowledge and its products current.
A command execution is one means of doing that,
not the common definition of everything the user cares about.

Working distinctions,
not finalized configuration keywords:

- Subject:
  the package or other software being discussed.
  Platform and output kind distinguish products when relevant;
  they do not imply a single global package revision.
- Product:
  something usable,
  such as a Node bundle or an executable for a particular platform.
  Record whether it is present and whether its recorded inputs still match.
- Evidence:
  an observation about the software,
  such as the result of a particular test suite.
  Record its input provenance separately from whether the result passed.
- Readiness for a use:
  an answer assembled from the products and evidence that use requires.
  Being usable for debugging need not mean being acceptable for release.
  Neither use is proposed as a new command here.
- Execution:
  an attempt to produce a product,
  obtain evidence,
  or perform an imperative operation.
  It still has identity,
  output,
  priority,
  and process controls.

These are distinctions to test,
not five new block types to implement.
In particular,
a single opaque command renamed to a goal would retain the rejected model.

Freshness,
outcome,
and activity answer different questions:

- Freshness:
  does this record describe the relevant current inputs?
- Outcome:
  what did the check or production attempt establish?
- Activity:
  what is queued,
  running,
  paused,
  or blocked while obtaining a current result?

A current failing test is current evidence of failure.
An interrupted test establishes no passing or failing assertion result.
A current failed bundle-production attempt does not make the previous bundle current.
Failure caching still applies;
this distinction does not authorize retrying unchanged failures until they pass.

## Repository scenario

Read directly from the repository when preparing this proposal:

- `package/module/jsonc-edit/package.json` exports `/ts` from `src/index.ts`,
  plus Node and neutral bundles under `dist/final`.
  These are distinct consumption paths,
  not consecutive steps every consumer must follow.
- `package/module/jsonc-edit/src/parse.unit.test.ts:14-22` imports the neutral bundle.
  That check needs its actual product to be current;
  naming a generic package build would not explain which product it consumes.
- `package/module/jsonc-edit/mise.toml` defines `buildAndTest` by explicitly running `build`
  and then `test:unit`.
  This is evidence of incumbent orchestration,
  not a requirement for meow's ontology.
- `AGENTS.md`,
  rule `ST3`,
  directs cross-package workspace imports to TypeScript source through `/ts`.
  Such an import does not consume the built bundle merely because its package can also produce one.

Illustrative state,
not a measured build result:
a package's source may be available,
its neutral bundle current,
its latest unit-test evidence current and failing,
and another platform's executable absent.
Calling the whole package either built or failed loses distinctions a person needs.

A stage view could summarize these facts.
It should not erase them or invent a universal progression from source through build through test.
Independently tracked evidence does not imply independently executable checks:
the neutral-bundle test genuinely needs that bundle.
The rule that establishes such relationships remains undecided;
no `depends_on` mechanism is adopted here.

## Primary-source precedents

These are source-verified conceptual precedents,
not runtime probes or technology selections.
The implications for meow are proposals.

- [OpenTofu's language documentation](https://opentofu.org/docs/v1.12/language/)
  calls the language its primary interface and describes intended goals rather than steps.
  This supports questioning command-shaped configuration,
  not importing OpenTofu's dependency syntax or plan/apply workflow.
- Kubernetes' [`metav1.Condition` definition][condition-source]
  separates `True`,
  `False`,
  or `Unknown` from `observedGeneration`.
  Its source explicitly describes an observation of an older generation as out of date.
  This supplies precedent for distinguishing the result from its applicability.
  meow's accepted content hashes need not become whole-package generation counters.
- Kubernetes' [Pod lifecycle documentation][pod-lifecycle]
  explicitly calls a phase a high-level summary,
  not a comprehensive observation rollup or state machine.
  This is evidence for allowing stage summaries alongside independent facts,
  not an argument that stages must disappear.

The analogy stops where producing an artifact differs from discovering a defect.
Meow can rebuild an absent bundle;
it cannot make deterministic failing assertions pass merely by rerunning them.

A further validity requirement for the proposed model:
a check finishing after an edit must not certify newer inputs that it never consumed.
Completion order is not freshness order.
Recording an input fingerprint alone also does not prevent mixed-version reads during execution.
The consistency mechanism needs a separate design;
no snapshot requirement or implementation is selected here.

[condition-source]: https://raw.githubusercontent.com/kubernetes/apimachinery/master/pkg/apis/meta/v1/types.go
[pod-lifecycle]: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-phase

## Candidate primary experiences

### Software state first (recommended)

The person navigates software and asks what is available,
what is known about it,
and what prevents the intended use.
A development-stage view can summarize those answers without owning their meaning.

- Pros:
  exposes the distinction between current artifacts and failing checks;
  handles source consumers and bundle consumers without pretending they traverse the same stages;
  fits a daemon already keeping affected work current.
- Cons:
  meow must explain which evidence belongs to which product or input set;
  a single ready label is insufficient without naming a use;
  custom operations still need a separate explanation.

### Development stages first

The person navigates meaningful milestones such as prepared,
built,
and verified.
A stage has explicit completion criteria rather than being an alias for one command.
Stages could branch by ecosystem or intended use instead of forming one fixed linear pipeline.

- Pros:
  foregrounds progress and completion criteria;
  gives teams a place to express lifecycle policy without exposing process orchestration.
- Cons:
  parallel product and evidence states still need representation;
  source consumption,
  debugging a failing application,
  and target-specific results resist a single package-stage answer;
  stage definitions can become task lists under another name.

Ranking:
software state first > development stages first,
because both can expose milestones,
but the former makes the mixed state in the repository scenario primary rather than an exception.
This ranks the primary experience,
not mutually exclusive storage architectures.

The rejected special-task questionnaire is not a third live option.
Useful commands and process controls remain available under either candidate.

## Existing contracts and limits

This proposal preserves the recorded behavior unless the user explicitly revisits it:

- `meow watch` keeps affected builds and default tests current.
  Failure is reported and cached,
  not repaired by rerunning forever.
- `meow run` keeps its entry syntax,
  attachment,
  priority,
  output replay,
  byte forwarding for one target,
  and exit behavior.
  The referent of a label is not thereby required to be an argv definition.
- Native manifests remain the source of cross-package relationships.
- Content hashes remain the freshness source of truth.
- `meow status` remains attention-only in 0.x;
  this is not a proposal to print all successful products there.
- Imperative operations remain real:
  editing secrets,
  publishing,
  and changing source are not automatically repeatable checks.
  No new permission to perform them on a file change follows from this proposal.
- The prior tag,
  inheritance,
  and explicit-override choices remain recorded.
  Applying their `task` block shape to every development concept is no longer assumed.

## Next question

Which should be the primary experience:
software with separately tracked products and evidence,
with stages as views,
or first-class development stages with explicit completion criteria?
Use the mixed-state repository scenario to distinguish them,
not preferences about the words task or goal.

Do not ask about built-in names,
HCL block shape,
overrides,
readiness-contract ownership,
or sequencing until this direction has been discussed.
An answer does not authorize implementation.

## Process-rule proposal

The existing `AGENTS.md` rule `QPM` questions mechanisms but does not explicitly question inherited nouns.
Proposed replacement,
not applied:

> Every option set asserts a premise,
> including inherited nouns.
> Treat incumbent labels as hypotheses:
> test whether the domain needs the concept before offering mechanisms.
> Dissolving beats choosing.

This merges the lesson into the existing premise-checking rule instead of adding an overlapping rule.

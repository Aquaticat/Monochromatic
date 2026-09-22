# meow 0.x design workpad

## Purpose

Think through the design by writing and revising concrete models here.
This is working material,
not a transcript archive or an accepted specification.
Write the next case or hypothesis before exploring it further.
The deliverable remains an implementation-ready 0.x plan.

## Current result

Q11 A is accepted:
a package-wide concern includes all applicable native parts owned by that package.
The original Android example grouped the Kotlin application and Rust engine together.
The user's Q12 correction requires separate package identities for them.
A package-wide label covers its owned parts;
containment or a dependency does not automatically make another package owned code.
Narrower addresses remain possible;
their syntax is undecided.

Q12 A is accepted:
when native declarations do not establish nested membership,
the root configuration must provide the missing connection.
The user also said:

> that one was actually a bad setup of the repo
> they should always be separate packages,
> so it's fine to ask the user to provide additional effort.

The user clarified:
"Both".
The Android Gradle application and Rust engine should be separate packages;
the fixture cases should also be separate packages.
Do not optimize the model around preserving either incumbent grouping.
No source move or repository reorganization is authorized by this design answer.

## Model on paper

The following distinctions are a working model,
not proposed HCL block names:

- Package:
  the software unit the user addresses.
- Native part:
  a Cargo crate,
  Gradle project,
  or other discovered part belonging to that package.
- Concern:
  a maintained responsibility such as building or checking that package.
- Execution:
  work with a defined input set and output set.
- Foreground request:
  a person's interest in the current result of a concern or operation.

These are not interchangeable.
A package-wide concern can require multiple executions.
Multiple requests can refer to an equivalent computation.
Different resolved inputs can require distinct executions even when the label is identical.
Those executions use the ordinary priority scheduler.
There is no label-wide scheduling lane.

## Ownership correction after Q12

The original Android example grouped two things the user says should be separate packages.
Revise the model rather than preserving that grouping:

- The Gradle application is one package.
- The Rust engine is another package.
- The application's use of the Rust product is a cross-package relationship,
  not an excuse to absorb the engine into the application's identity.
- The nested fixture cases likewise receive separate package identities rather than becoming native parts
  of a wrapper merely through containment.

Q11 still means all applicable checks within the selected package.
It does not mean recursively treating every nested package or dependency as owned code.
Physical relocation is outside this design session;
separate identity and the required relationship must be expressible independently of that migration.

Consequence for the next case:
package ownership and dependency eligibility are different questions.
An upstream check may block a consumer without becoming one of the consumer's own checks.

## Worked case: Android lint (original grouping)

This case motivated Q11.
Its grouping is superseded by the ownership correction;
retain its check-aggregation behavior for parts genuinely owned by one package.

Source facts:

- `package/music-player/android-app/settings.gradle.kts` includes `:app`.
- `package/music-player/android-app/rust/Cargo.toml` defines `musicplayer-native` and its own workspace.
- `package/music-player/android-app/mise.toml` separately defines Android Lint,
  Rust Clippy,
  and the repository's Rust linter.

Requested concern:
`meow run //package/music-player/android-app:lint`.

What is settled:

1.  Select the applicable lint checks for the package's owned native parts.
2.  Obtain the inputs needed to perform those checks.
3.  Reuse matching recorded results when their inputs and outputs permit it.
4.  Put required executions through the ordinary priority scheduler.
5.  Collect the independent source-check results even if one fails.
6.  A blocking source-check failure prevents downstream production.
7.  A foreground request blocked by that failure reports it and returns nonzero.

What is not settled:

- How native-part ownership is inferred and overridden.
- The exact leaf labels and configuration addresses.
- Which declared products and variants belong to automatic maintenance.
- How the package-wide result combines and presents its constituent results.

## Gate versus prerequisite: a case that must work

Existing example:
`ensureOxlintConfig` in `mise.toml` builds the linter configuration before running lint.
Therefore,
all lint cannot be required before every build.

Working distinction:

- Production needed to perform a source gate can proceed so that the gate can be evaluated.
- Ordinary downstream production remains blocked when that gate fails.

Counterexample to an overly broad exception:
"Tests require the application binary,
so build the application despite failed source lint."
That would defeat the accepted resource-saving policy.
Merely being a prerequisite of some later check cannot grant a universal bypass.

Hypothesis to develop:
record the reason a product is needed,
not only that a consumer reads it.
The producer's cached computation can be shared,
while the eligibility of a particular consumer remains separate.
This is not yet a chosen implementation.

## Cache identity worked through

Accepted rule:
every execution has defined inputs and outputs;
execution caching stays on.
There is no per-definition reuse toggle.

Case:
two requests have the same label but different test-file inputs.
They are different computations,
not an argument for serializing the entire label.

Case:
a definition includes `currentDateTime` among its inputs.
A different resolved time value changes its ordinary cache key.
It does not switch caching off.

Unresolved binding detail:
when is that value sampled and held stable?
A scheduler repeatedly checking a queue must not accidentally create an endless stream of new computations.
Hypothesis:
bind the input set for a maintenance activation or explicit request,
then keep that binding stable through lookup and execution.
Clock precision and repeated requests still need a concrete contract;
do not assume that two time samples must differ.

## Foreground request worked through

Accepted:

- A waiting maintenance request follows the latest relevant inputs.
- Superseded ordinary background work is cancelled.
- Ctrl+C detaches the foreground requester;
  it does not end automatic maintenance.
- `meow end` is forbidden for automatic work in 0.x.
- Foreground requests do not implicitly bypass failed gates.

Consequences to specify:

- How supersession is made intelligible in the forwarded output.
- How control selection works when one label covers multiple invocations.
- How a paused concern behaves when an input edit supersedes its old execution.

Do not invent an answer merely to complete a state diagram.
Write the concrete transition and identify whether it follows from an accepted rule or requires a user decision.

## Ownership sketch: first attempt

Candidate rule:
a recognized repository package owns its native projects,
except where another recognized package boundary takes ownership.
Native workspace boundaries and repository-package boundaries are not necessarily identical.

Apply it to the observed Android case:

- Repository package:
  `package/music-player/android-app`.
- Gradle part:
  the `:app` project declared by its settings file.
- Cargo part:
  `rust/`,
  despite its separate Cargo workspace boundary.
- Package-wide lint:
  gathers the applicable checks of both parts,
  as Q11 requires.

Stress cases to resolve before adopting the rule:

- A nested manifest used only as test data must not become maintained software merely because its filename matches.
- An independently owned nested repository package must not be silently absorbed into its parent.
- A dependency outside the package is a dependency,
  not an owned part;
  the Android Rust manifest's path reference to `../../truepeak-core` is a concrete example.

Evidence checkpoint:
a repository scan for visible `Cargo.toml` files,
excluding `target` and `node_modules`,
found the Android nested crate but did not provide the desired nested-fixture counterexample.
Inspect comparable nested Node manifests before claiming this repository demonstrates that case.
The fixture case currently remains a design stress case,
not an observed repository fact.

## Counterexample found: nested pseudo-packages

The comparable Node scan found nested manifests under
`package/test-fixture/oxlint-test-import/case/`.

Evidence:

- The outer `package.json` describes these files as manifest shapes and import forms for testing a lint rule.
- `case/standard/package.json` looks like an ordinary package:
  a name,
  version,
  module type,
  and source and built exports.
- `package/oxlint-plugin/test-import/src/owning-package.unit.test.ts:13-17`
  explicitly calls these nested pseudo-packages and uses their paths as test inputs.

The first ownership sketch is therefore incomplete.
Directory containment plus a recognized manifest cannot establish that a nested project should be maintained.
It can be data used to test package discovery itself.

Revised working distinction:

1.  Discovery finds candidate native projects and their metadata.
2.  Membership determines which candidates belong to maintained software.
3.  Applicability determines which concerns and variants apply to those members.

Collapsing these steps would register test data as software merely because it has convincing metadata.

## Membership alternatives, worked against both cases

Candidate A:
starting from a recognized repository package,
use its native project and workspace declarations to establish membership;
let the root HCL supply relationships those declarations do not express.
Finding another workspace file somewhere below that package does not independently enroll it.
The initial repository-package discovery rule still needs specification;
this candidate addresses membership inside an already recognized package.

- Android:
  Gradle declares `:app`;
  the Cargo/JNI relationship currently expressed by Mise must be supplied during migration.
  Do not pretend Gradle's settings already declare the Rust part.
- Fixture:
  a nested manifest is not sufficient to enroll another maintained part.
  Its files can remain inputs to the owning fixture package and its consumers.
- Benefit:
  membership follows declared intent rather than filename recognition alone.
- Cost:
  cross-ecosystem composition can require an explicit declaration.

Candidate B:
include nested native manifests by default and let configuration exclude data or unwanted projects.

- Android:
  finds the Rust part without an explicit membership declaration.
- Fixture:
  needs exclusions or a reliable fixture convention before those manifests become active.
- Benefit:
  less membership configuration for otherwise unconnected native parts.
- Cost:
  a newly added test fixture can change the maintained project set unless excluded.

Accepted:
A over B.
Require the missing declared connection rather than enrolling merely from manifest presence.
The user explicitly accepts the additional authoring effort.

The user confirmed that both example groups should instead use separate packages.
A required connection can therefore be a cross-package dependency,
not necessarily nested membership.
Configuration attribute names remain a later step.

## Next worked case: source consumption across package boundaries

Illustrative case,
not a claim about current build results:

- Package B consumes package A's source,
  rather than A's compiled output.
- A's source lint fails.
- B's own source checks pass.
- Building B would consume A's source.

Already settled:
A's ordinary build is blocked,
and source consumption must not invent an unrelated compiled-output prerequisite.

Still to decide:
does A's failed source gate also block B's production,
even though the source files themselves are available?

Candidate A (recommended):
propagate applicable source gates across package-consumption relationships.
B's build waits for A's source checks,
not for an unnecessary build of A.
B's independent source checks can still finish.
Benefit:
skips downstream production that incorporates an upstream package with a blocking source failure.
Cost:
withholds consumer build diagnostics until that failure is fixed.

Candidate B:
only the selected package's own source gates and actual input availability block its production.
B can therefore build while A has lint findings.
Benefit:
obtains additional consumer results.
Cost:
continues production involving a package already rejected by a source gate.

Ranking:
A > B for consistency with the accepted resource-saving progression.
This remains a proposal until the user answers Q13.

Keep dependency runtime tests separate from this question.
Whether they also gate consumers is not decided by the source-lint case.
Do not fold an entire package-wide success state into every dependency edge by accident.

## Parking lot: do not branch into these yet

These issues surfaced while sketching the model.
Recording them here is preferable to pursuing them all before resolving ownership.

- Gate prerequisites:
  a product needed to run a source gate differs from a product needed by a downstream artifact test.
  The latter must not justify bypassing failed source gates.
- Shared writes:
  different invocations may run concurrently under the priority model,
  but output collisions and shared tool-cache locks still need a correctness contract.
  A label-wide mutex is not the answer.
- Aggregate output:
  one package-wide label can select multiple check executions.
  The terminal contract must explain that case without assuming one label equals one process.
- Input completeness:
  native metadata may omit cross-ecosystem relationships,
  as the JNI output path currently supplied by Mise illustrates.
  Root configuration must be able to provide missing intent.
- Volatile input binding:
  define activation and sampling boundaries before promising how `currentDateTime` behaves.
- Native applicability:
  do not equate every discoverable build variant with the set the repository intends to maintain automatically.

## Proposed instruction correction

The user's request concerns thinking through written models,
not just retaining conclusions.
Proposed replacement for `AGENTS.md` rule `DCK`,
not applied:

> Think in repo files:
> sketch cases before branching.
> Record requirements,
> hypotheses,
> corrections,
> decisions,
> evidence,
> rejections,
> questions,
> commits,
> and next action.
> Docs are canonical.

## Immediate next working step

Complete the source-consumption case and ask only its unresolved eligibility question.
Q11,
Q12,
and the separate-package interpretation are settled;
do not reopen them.
Keep dependency runtime-test gating and the parking-lot branches separate.

Publication remains outside 0.x.
No product code is authorized.

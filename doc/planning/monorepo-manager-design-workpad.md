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
For the Android example,
package-wide lint includes the applicable Kotlin and Rust checks,
not just the native tool at the root.
Narrower addresses remain possible;
their syntax is undecided.

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

## Worked case: Android lint

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

## Immediate next working step

Inspect nested Node-manifest examples to challenge the ownership sketch.
Then write a revised rule and only the user choice that surviving evidence cannot decide.
Do not investigate the parking-lot branches during this step.

Publication remains outside 0.x.
No product code is authorized.

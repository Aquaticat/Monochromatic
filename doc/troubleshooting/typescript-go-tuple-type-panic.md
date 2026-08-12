# typescript-go 7.0.2 panics serializing a tuple-flagged type, aborting a whole Oxlint semantic program

A repository-wide `mise run lint:oxlint` loses the readonly analysis of one file when the
TypeScript API server panics inside its type-serialization path.
The loss is reported rather than silent:
 the rule catches the failure and emits
`Readonly semantic analysis unavailable` for that file,
 carrying the panic text.
So this costs coverage,
 not soundness;
 no offer is made for the file on partial information.

## Symptom

During `mise run lint:oxlint` at the repository root:

```text
[error] [prefer-readonly-parameter-types] [Program] semantic rule failed: Error: panic: interface conversion: checker.TypeData is *checker.TypeReference, not *checker.TupleType
```

The message is followed by a Go stack and then `Error running tsgolint: "exit status: exit status: 2"`.
The report is attached to `package/webapp-productivity/rss/src/index.ts`,
 at `1:1`,
 which is the file whose analysis is lost.

An earlier reading of mine named `package/module/test/src/expect-matchers.ts` instead,
 inferred from diagnostics printed near the panic in an interleaved log.
That was wrong,
 and it is why the reproduction below looked unavailable for so long:
 every narrowing attempt probed the wrong package.

The panic is not caused by anything in this repository's rule changes.
It appears in all five workspace sweeps taken while investigating an unrelated soundness
question,
 the earliest of which predates every change in that series.

### A second surface: a dependency's shipped implementation

The panic now also strikes inside code this repository does not own.
Measured at `94af5da15`,
 reading the cause `effect-demand-index.ts` logs beside each omission:

```text
omitting package/webapp-productivity/rss/src/index.ts:2646:3443:219 ... Error: panic: interface conversion
omitting package/webapp-productivity/rss/src/index.ts:3500:4182:263 ... Error: panic: interface conversion
omitting node_modules/.../@optique/core@1.2.0/.../dist/facade.js:12673:15456:263 ... Error: panic: interface conversion
```

Five panics,
 three omitted callables,
 so the counts do not correspond one to one.

The third is new,
 and it appeared only once the external channel began loading shipped implementations,
 which needed the worker-count defect fixed first.
It stays sound:
 an omitted external callable answers `NO_EFFECT_SUMMARY`,
 the effect resolver reports unavailable,
 and the consumer's call falls to the unresolved boundary,
 which withholds.

The practical consequence is for reading captures.
A sweep must be searched for omissions under `node_modules` as well as under `package`,
 which no capture before this one needed.

## Root cause

The stack names the failing frames:

```text
github.com/microsoft/typescript-go/internal/checker.(*Type).AsTupleType(...)
	github.com/microsoft/typescript-go/internal/checker/types.go:693
	github.com/microsoft/typescript-go/internal/api/proto.go:675 +0x9e5
github.com/microsoft/typescript-go/internal/api.checkerSetup.newTypeResponse(...)
	github.com/microsoft/typescript-go/internal/api/session.go:465
```

Line numbers in the stack come from the installed build,
 TypeScript 7.0.2.
The excerpts below come from a shallow clone of `microsoft/typescript-go` at commit
`f209df30`,
 so the same code sits at different line numbers.

The serializer decides a type is a tuple from that type's own object flags,
 then asserts
tuple data immediately,
 at `internal/api/proto.go:735-747`:

```go
case flags&checker.TypeFlagsObject != 0:
	resp.ObjectFlags = uint32(t.ObjectFlags())
	objectFlags := t.ObjectFlags()
	if objectFlags&checker.ObjectFlagsReference != 0 {
		var ref *checker.TypeReference
		if objectFlags&checker.ObjectFlagsTuple != 0 {
			tuple := t.AsTupleType()
			ref = tuple.AsTypeReference()
			resp.ElementFlags = tuple.ElementFlags()
```

`AsTupleType` is an unchecked type assertion,
 at `internal/checker/types.go:695`:

```go
func (t *Type) AsTupleType() *TupleType { return t.data.(*TupleType) }
```

The checker's own predicate for "is this a tuple" never does that.
It reads `Reference` from the type and `Tuple` from the type's target,
 at
`internal/checker/checker.go:23473-23475`:

```go
func isTupleType(t *Type) bool {
	return t.objectFlags&ObjectFlagsReference != 0 && t.Target().objectFlags&ObjectFlagsTuple != 0
}
```

The reason for that indirection is documented at `internal/checker/types.go:956-960`:

```go
// TupleType:
// ObjectFlagsReference|ObjectFlagsTuple: Originating generic tuple type (synthesized)

// TypeReference
// ObjectFlagsReference: Instantiated generic class, interface, or tuple type
```

So by the stated invariant the two flags together mark the synthesized originating tuple,
which does hold `*TupleType` data,
 and it is built in exactly one place,
`internal/checker/checker.go:24794`:

```go
t := c.newObjectType(ObjectFlagsTuple|ObjectFlagsReference, nil)
```

An instantiated tuple is a `*TypeReference` carrying `ObjectFlagsReference` alone,
 and
`internal/checker/checker.go:25091-25101` builds it without adding the tuple flag,
since `ObjectFlagsPropagatingFlags` at `internal/checker/types.go:618` covers only
`ContainsWideningType`,
 `ContainsObjectOrArrayLiteral` and `NonInferrableType`:

```go
t := c.newObjectType(ObjectFlagsReference|objectFlags|c.getPropagatingFlagsOfTypes(typeArguments, TypeFlagsNone), target.symbol)
d := t.AsTypeReference()
```

The panic is proof that some type reaching `newTypeResponse` carries `ObjectFlagsTuple`
while holding `*TypeReference` data,
 which the documented invariant says cannot happen.
Whether that type is produced by a path this trace did not find,
 or the invariant is
simply not enforced,
 is not established here.
What is established is that the serializer is the only reader that trusts the type's own
tuple flag to imply tuple data,
 and that the checker's own predicate does not,
 so the
serializer is where a mismatch becomes a crash rather than a wrong answer.

An earlier reading of mine was wrong and is recorded so it is not re-derived:
I first suspected this repository's own accessor-body scan in
`package/oxlint-plugin/prefer-readonly-parameter-type/src/prefer-readonly-parameter-types/effect-packaged-callable-origins.ts`,
because that scan asked the checker about every name it walked,
 including names in type
positions.
Counting `semantic rule failed` across the sweeps disproved it:
 the panic is present in
the baseline sweep taken before that scan existed.
Keeping the scan out of type positions is still correct on its own terms and landed
separately,
 but it is not a fix for this.

## Verification

Version under test:
 TypeScript 7.0.2,
 resolved at
`node_modules/.pnpm/typescript@7.0.2/node_modules/typescript`.
Source excerpts:
 `microsoft/typescript-go` at commit `f209df30`.

Reproduces:

```bash
mise run lint:oxlint
```

Does not reproduce,
 each run completing with findings and no panic:

```bash
# 7 findings, no panic
node package/dev-script/task-util/dist/final/node/oxlint-wrapper.mjs --type-aware package/module/test/src/expect-matchers.ts

# 52 findings, no panic
node package/dev-script/task-util/dist/final/node/oxlint-wrapper.mjs --type-aware package/module/test

# 422 findings, no panic
node package/dev-script/task-util/dist/final/node/oxlint-wrapper.mjs --type-aware package/module

# 52 findings, no panic
mise run //package/module/test:lint:oxlint
```

The file the run is working through when it panics therefore does not trigger it on its
own,
 nor does its package,
 nor its whole package family.
The trigger depends on the wider program the repository-scoped run assembles,
 which is
consistent with an instantiated tuple type that only exists once the larger set of source
files is in one program.

Counting the failure across sweeps,
 each on a clean tree:

```bash
rg --count-matches 'semantic rule failed' -- <sweep-output>
```

returns exactly 1 for every sweep taken,
 including the earliest baseline.

## Upgrading does not fix it

`typescript@7.1.0-dev.20260726.1` was installed across the whole workspace and swept.
The panic persists,
 with the same message and the same site.

The sweep produced 1859 findings and 23 offers,
 identical to the run on 7.0.2,
 and one `semantic rule failed` with the same
`interface conversion: checker.TypeData is *checker.TypeReference, not *checker.TupleType`.

The stack is what makes the correspondence exact.
On 7.0.2 it reads `internal/api/proto.go:675`;
 on the nightly it reads `internal/api/proto.go:741`,
 which is the line the clone at commit `f209df30` holds the unguarded `t.AsTupleType()` on.
So the nightly ships that code with no guard added.

The source agrees.
The newest upstream commit before that nightly's cutoff is `8d29e62f`,
 dated 2026-07-24,
 and `git show 8d29e62f:internal/api/proto.go` still has the unguarded branch.
`8d29e62f` is titled "Fix panic in variadic tuple relationship checking",
 which is a panic in the relater rather than in this serializer,
 so it is a different bug that happens to share the word tuple.

The catalog was returned to `'typescript': '>=7.0.2'` and reinstalled,
 because carrying a prerelease that fixes nothing is cost without benefit.
A future version is worth retesting the same way:
 pin the catalog entry,
 install,
 sweep,
 and grep the output for `semantic rule failed`.

## The omission was fail-closed on one side only, fixed

Recorded 2026-08-07,
 because the panic's cost was much larger than this document described and the
reason was on our side.

`effect-demand-index.ts` catches the failed summary build and omits that one callable,
 and its comment
states the omission is fail-closed:
 callers hit the absent-callee branch in
`effect-fixed-point-propagation.ts` and take opacity.
 That half was true.
 `assertReachedCallSummaries` in
`effect-reached-edge.ts` then refused any call edge whose callee had no summary,
 including the one just
omitted on purpose,
 and threw.
 The throw aborts the whole program's analysis.

So one panicking callable cost every file in that program its readonly analysis rather than costing
itself its summary.
 Measured before the fix:
 `package/claude-code-plugin/statusline` lost `activity.ts`,
`render.ts` and `statusline.ts` entirely,
 reported as `semantic rule failed, so ... has no readonly
analysis this run`.

The assertion now receives the set of deliberately omitted keys and skips them,
 for callee and callback
edges alike.
 Measured after:
 workspace semantic failures 3 to 0,
 rule findings 1677 to 1678,
 which is the
one real finding those three files were hiding,
 and read-only offers unchanged at 33.

The panic itself is untouched and still fires.
 Checked across every sweep taken during this work,
 the
earliest predating all of it:
 16 occurrences each time, so nothing in the rule's own changes caused or
worsened it.

## The remaining cost, and the shape of a narrower catch

With the assertion fixed the panic no longer costs a program its analysis,
 but it still costs 16
callables their summaries per sweep,
 counted identically in every sweep taken during this work.
 Their
callers take opacity through the absent-callee branch,
 so this is precision rather than soundness:
 the
answer is conservative, not wrong.

The trigger is narrower than "a tuple".
 `findGerundInText` in
`package/claude-code-plugin/statusline/src/activity.ts` writes
`lowercaseValue.match(GERUND_PATTERN,) ?? []`,
 whose type is `RegExpMatchArray | []`,
 and `[]` is an empty
tuple.
 The serializer reads `Reference | Tuple` off that type's own object flags and immediately asserts
tuple data,
 which an instantiated type does not carry.
 So the shape to look for when this fires elsewhere
is a `?? []` or `: []` fallback beside a non-tuple array type, not a declared tuple.

A narrower catch would recover the 16.
 The panic surfaces when a type crosses the sync bridge, so
catching it at the type query rather than at the callable would lose one fact instead of one summary,
and the rule already treats an unresolved type as fail-closed nearly everywhere.
 The cost is that
`getTypeAtLocation` is called from about a dozen modules,
 so it means a helper plus a mechanical
replacement at every site,
 and every site then has to be checked for whether `undefined` really is its
fail-closed direction.
 Not attempted here:
 a wide mechanical change to recover precision is worth doing
deliberately rather than at the end of a long session.

## What we do about it

An internal failure no longer reports a lint issue.
The rule catches it,
 logs a warning naming the file,
 and leaves that file without readonly analysis for the run.
The reasoning is attribution:
 a panic inside the upstream API is not a fact about the linted file,
 so putting an error on that file blames an author who can do nothing about it.
One consequence worth knowing:
 a file that panics no longer fails the lint,
 so the warning is the only signal.

## Minimal reproduction

Delta-debugging the affected file from 186 lines to 30 in 149 runs,
 then hand-reducing,
 gives a dependency-free case.
Every run took about a second,
 so the whole minimization cost a few minutes:

```ts
export function take<Fn extends (...args: never[]) => unknown,>(
  fn: Fn,
  args: Parameters<Fn>,
): void {
  void fn;
  void args;
}

export function use(): void {
  take(
    function render(): string {
      return '';
    },
    [],
  );
}
```

The essential ingredients are a generic parameter typed `Parameters<Fn>` and a call site
that instantiates it.
That matches the reading under "Root cause":
 an instantiated tuple is a `*TypeReference`,
 and the serializer branches on the type's own tuple flag.

None of these panic,
 which is what pins the generic instantiation as necessary:

```ts
export function take(args: [],): void {}
export function take(args: Parameters<() => string>,): void {}
export function take(args: [string, number,],): void {}
```

A variant returning the tuple-taking callable rather than accepting the tuple directly
panics as well,
 so the shape of the wrapper does not matter.

The original file reaches this through `memoizeAsync`,
 whose returned caller takes `{ args: Parameters<Fn> }`,
 called as `memoizedGetHtmlBody({ args: [], },)`.

## Why no workaround analyzes the construct

The panic happens while building the effect summary index,
 not while verifying,
 which a probe calling `buildEffectSummaryIndex` directly confirms.

More to the point,
 it happens inside the API's serialization of a type response.
Receiving the type object at all requires that response,
 so the rule cannot inspect the type's flags first and then decline:
 the first request that returns this type panics.
There is no sequence of API calls that reads the construct safely.

What is available is a smaller blast radius.
The failure currently costs the whole file,
 because the catch wraps the whole run.
That is built.
A callable whose summary cannot be built is omitted from the index with a warning naming
the cause,
 rather than aborting the run for its whole file.
Omission is fail-closed on both sides:
 callers of an absent callee take opacity,
 which also fixed a defect of its own,
 since propagation previously returned silently there and turned an unresolved callee into
 a no-effect one.
The rule skips verifying an omitted callable rather than reporting against code whose
author cannot act on it.

Measured at workspace scale by diagnostic position,
 which is what distinguishes the two
states.
Before,
 the only diagnostic in `package/webapp-productivity/rss/src/index.ts` sat at `1:1`,
 the bail-out report standing in for the file's whole analysis.
After,
 it sits at `171:39`,
 a real finding in the body,
 and the sweep carries two omission warnings naming the callables that were dropped.

## Verified workarounds

None at our boundary.
The rule cannot avoid asking the API for types,
 which is its entire mechanism,
 and it
cannot tell in advance which request will hit the bad type.

The partial mitigation already in place is that per-package lint tasks do not reproduce
it,
 so `mise run //package/<path>:lint:oxlint` gives complete analysis for any single
package,
 including the one the sweep loses.
The tradeoff is that it is a per-package workflow:
 a repository-wide sweep still loses one
program,
 and no per-package run tells you which.

## What does not work

- Narrowing the repository-wide run to the file,
   the package,
   or the package family.
  All three complete without the panic,
   so none of them can serve as a minimal harness.
- Attributing it to this repository's accessor-body scan over type-position names.
  Disproved by the baseline sweep,
   as recorded under "Root cause".
- Passing paths through the mise task,
   as in `mise run lint:oxlint -- <path>`.
  That task has no usage spec,
   so mise splices the argument into the script body and the
  run dies with `ERR_INVALID_TYPESCRIPT_SYNTAX` before oxlint starts.
  Invoke `oxlint-wrapper` directly instead,
   as the verification commands do.

## Upstream filing decision

Filing upstream is out of scope by the repository owner's standing instruction for this
work,
 which grants unlimited budget "except actually filing it upstream".
No `.out-of-scope/` entry covers typescript-go or this bug class;
 the closest,
`.out-of-scope/typescript-project-references.md`,
 is about not adopting project
references and does not apply.
The six constraints are still walked so a future session can act if that instruction
changes,
 and no fileable draft is kept.

1.  **Is it really upstream's fault?
    **
    Yes.
     The panic is raised inside `internal/api`,
     in upstream's own serialization of a
    type response,
     from an unchecked assertion in `internal/checker`.
     No consumer input
    can be malformed enough to make an unchecked cast the correct behavior.
2.  **Can upstream fix it?
    **
    Yes,
     and cheaply.
     The serializer needs to establish tuple data before asserting it,
    the way `isTupleType` establishes it from the target rather than from the type's own
    flag.
     That is a guard in one branch of `newTypeResponse`,
     plus whatever exported
    helper the `api` package needs,
     since `Type.data` is unexported.
3.  **Are they supporting this use case?
    **
    Yes.
     The whole `internal/api` package exists to serve external consumers such as
    tsgolint,
     and `newTypeResponse` is on that path.
4.  **Would the repo welcome our contribution?
    **
    Not checked.
     `CONTRIBUTING.md`,
     issue templates and AI-assistance policy in
    `microsoft/typescript-go` were not read,
     because the filing decision was already
    settled by the standing instruction.
5.  **Will they likely fix it?
    **
    Not checked.
     The upstream tracker was not searched for a duplicate,
     for the same
    reason.
     Any future session acting on this must run that search first,
     since a
    duplicate report is itself an incident.
6.  **Have we prototyped a minimal fix?
    **
    No. Not attempted,
     because constraints 4 and 5 were deliberately left unevaluated and
    the prototype exists to make a filing credible.

A future session that is authorized to file must complete constraints 4,
 5 and 6 before
drafting anything,
 starting from the duplicate search.

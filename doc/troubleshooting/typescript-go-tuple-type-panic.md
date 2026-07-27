# typescript-go 7.0.2 panics serializing a tuple-flagged type, aborting a whole Oxlint semantic program

A repository-wide `mise run lint:oxlint` loses the analysis of one program when the
TypeScript API server panics inside its type-serialization path.
The rule reports nothing further for that program, so its files are silently unanalyzed
while the run continues and exits as if only ordinary findings were produced.

## Symptom

During `mise run lint:oxlint` at the repository root:

```text
[error] [prefer-readonly-parameter-types] [Program] semantic rule failed: Error: panic: interface conversion: checker.TypeData is *checker.TypeReference, not *checker.TupleType
```

The message is followed by a Go stack and then `Error running tsgolint: "exit status: exit status: 2"`.
The surrounding diagnostics show the run was working through
`package/module/test/src/expect-matchers.ts` at the time, near `toHaveLastReturnedWith`,
a matcher that reads sinon spy call records.

The panic is not caused by anything in this repository's rule changes.
It appears in all five workspace sweeps taken while investigating an unrelated soundness
question, the earliest of which predates every change in that series.

## Root cause

The stack names the failing frames:

```text
github.com/microsoft/typescript-go/internal/checker.(*Type).AsTupleType(...)
	github.com/microsoft/typescript-go/internal/checker/types.go:693
	github.com/microsoft/typescript-go/internal/api/proto.go:675 +0x9e5
github.com/microsoft/typescript-go/internal/api.checkerSetup.newTypeResponse(...)
	github.com/microsoft/typescript-go/internal/api/session.go:465
```

Line numbers in the stack come from the installed build, TypeScript 7.0.2.
The excerpts below come from a shallow clone of `microsoft/typescript-go` at commit
`f209df30`, so the same code sits at different line numbers.

The serializer decides a type is a tuple from that type's own object flags, then asserts
tuple data immediately, at `internal/api/proto.go:735-747`:

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

`AsTupleType` is an unchecked type assertion, at `internal/checker/types.go:695`:

```go
func (t *Type) AsTupleType() *TupleType { return t.data.(*TupleType) }
```

The checker's own predicate for "is this a tuple" never does that.
It reads `Reference` from the type and `Tuple` from the type's target, at
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
which does hold `*TupleType` data, and it is built in exactly one place,
`internal/checker/checker.go:24794`:

```go
t := c.newObjectType(ObjectFlagsTuple|ObjectFlagsReference, nil)
```

An instantiated tuple is a `*TypeReference` carrying `ObjectFlagsReference` alone, and
`internal/checker/checker.go:25091-25101` builds it without adding the tuple flag,
since `ObjectFlagsPropagatingFlags` at `internal/checker/types.go:618` covers only
`ContainsWideningType`, `ContainsObjectOrArrayLiteral` and `NonInferrableType`:

```go
t := c.newObjectType(ObjectFlagsReference|objectFlags|c.getPropagatingFlagsOfTypes(typeArguments, TypeFlagsNone), target.symbol)
d := t.AsTypeReference()
```

The panic is proof that some type reaching `newTypeResponse` carries `ObjectFlagsTuple`
while holding `*TypeReference` data, which the documented invariant says cannot happen.
Whether that type is produced by a path this trace did not find, or the invariant is
simply not enforced, is not established here.
What is established is that the serializer is the only reader that trusts the type's own
tuple flag to imply tuple data, and that the checker's own predicate does not, so the
serializer is where a mismatch becomes a crash rather than a wrong answer.

An earlier reading of mine was wrong and is recorded so it is not re-derived:
I first suspected this repository's own accessor-body scan in
`package/oxlint-plugin/prefer-readonly-parameter-type/src/prefer-readonly-parameter-types/effect-packaged-callable-origins.ts`,
because that scan asked the checker about every name it walked, including names in type
positions.
Counting `semantic rule failed` across the sweeps disproved it: the panic is present in
the baseline sweep taken before that scan existed.
Keeping the scan out of type positions is still correct on its own terms and landed
separately, but it is not a fix for this.

## Verification

Version under test: TypeScript 7.0.2, resolved at
`node_modules/.pnpm/typescript@7.0.2/node_modules/typescript`.
Source excerpts: `microsoft/typescript-go` at commit `f209df30`.

Reproduces:

```bash
mise run lint:oxlint
```

Does not reproduce, each run completing with findings and no panic:

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
own, nor does its package, nor its whole package family.
The trigger depends on the wider program the repository-scoped run assembles, which is
consistent with an instantiated tuple type that only exists once the larger set of source
files is in one program.

Counting the failure across sweeps, each on a clean tree:

```bash
rg --count-matches 'semantic rule failed' -- <sweep-output>
```

returns exactly 1 for every sweep taken, including the earliest baseline.

## Verified workarounds

None at our boundary.
The rule cannot avoid asking the API for types, which is its entire mechanism, and it
cannot tell in advance which request will hit the bad type.

The partial mitigation already in place is that per-package lint tasks do not reproduce
it, so `mise run //package/<path>:lint:oxlint` gives complete analysis for any single
package, including the one the sweep loses.
The tradeoff is that it is a per-package workflow: a repository-wide sweep still loses one
program, and no per-package run tells you which.

## What does not work

- Narrowing the repository-wide run to the file, the package, or the package family.
  All three complete without the panic, so none of them can serve as a minimal harness.
- Attributing it to this repository's accessor-body scan over type-position names.
  Disproved by the baseline sweep, as recorded under "Root cause".
- Passing paths through the mise task, as in `mise run lint:oxlint -- <path>`.
  That task has no usage spec, so mise splices the argument into the script body and the
  run dies with `ERR_INVALID_TYPESCRIPT_SYNTAX` before oxlint starts.
  Invoke `oxlint-wrapper` directly instead, as the verification commands do.

## Upstream filing decision

Filing upstream is out of scope by the repository owner's standing instruction for this
work, which grants unlimited budget "except actually filing it upstream".
No `.out-of-scope/` entry covers typescript-go or this bug class; the closest,
`.out-of-scope/typescript-project-references.md`, is about not adopting project
references and does not apply.
The six constraints are still walked so a future session can act if that instruction
changes, and no fileable draft is kept.

1.  **Is it really upstream's fault?**
    Yes. The panic is raised inside `internal/api`, in upstream's own serialization of a
    type response, from an unchecked assertion in `internal/checker`. No consumer input
    can be malformed enough to make an unchecked cast the correct behavior.
2.  **Can upstream fix it?**
    Yes, and cheaply. The serializer needs to establish tuple data before asserting it,
    the way `isTupleType` establishes it from the target rather than from the type's own
    flag. That is a guard in one branch of `newTypeResponse`, plus whatever exported
    helper the `api` package needs, since `Type.data` is unexported.
3.  **Are they supporting this use case?**
    Yes. The whole `internal/api` package exists to serve external consumers such as
    tsgolint, and `newTypeResponse` is on that path.
4.  **Would the repo welcome our contribution?**
    Not checked. `CONTRIBUTING.md`, issue templates and AI-assistance policy in
    `microsoft/typescript-go` were not read, because the filing decision was already
    settled by the standing instruction.
5.  **Will they likely fix it?**
    Not checked. The upstream tracker was not searched for a duplicate, for the same
    reason. Any future session acting on this must run that search first, since a
    duplicate report is itself an incident.
6.  **Have we prototyped a minimal fix?**
    No. Not attempted, because constraints 4 and 5 were deliberately left unevaluated and
    the prototype exists to make a filing credible.

A future session that is authorized to file must complete constraints 4, 5 and 6 before
drafting anything, starting from the duplicate search.

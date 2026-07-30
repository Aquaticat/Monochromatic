# Handover: making `prefer-readonly-parameter-type` bulletproof

Live document. Updated as work lands, not at the end.

Scope: `package/oxlint-plugin/prefer-readonly-parameter-type`.
Goal in force: no false offers.
A false offer is the rule offering `readonly` for a parameter something writes through.
Withholding an offer is always safe and costs only precision.

## The bar that decides everything here

A defect is not a defect until it is falsified.
Falsification means all four of:

- the rule produces the annotation
- every suggestion in the file is applied, not just the one under test
- the result type-checks clean
- a driver observes the caller's state change
- **the escape comes from something the annotated callable does, not from something the caller
  hands it**

That last clause was implicit until it caught me out. A driver that supplies the escaping
 behaviour proves nothing about the callable it is driving: handing a value to a callback the
 caller wrote is handing it back to the caller, who already had it, and the callback relation
 defers that decision to the caller on purpose. The same invalid driver would equally "falsify"
 `returnRowDirectly`, which is kept offered as the policy control.

The third point needs a control in the same file,
 usually a callable carrying `@ts-expect-error` over a direct write,
 because `ReadonlyDeep` resolving to an error type makes every other function in the file
 type-check for the wrong reason.
Every falsification in this work compiles for one reason:
 TypeScript ignores `readonly` property modifiers in assignability,
 so a callee declaring `Row` launders a `ReadonlyDeep<Row>` straight back to mutable.

Summaries and boundary checks are not the bar.
A clean report and a disabled rule look identical,
 which is why a must-still-be-offered control belongs in every boundary check.
The rule is disabled for its own package by `readonlyEffectSelfHostingOverride`
 (`package/config/oxlint/src/overrides.ts`).

## How to work here

Build both artifacts, in order, or the measurement is of something else:

```bash
mise run //package/oxlint-plugin/prefer-readonly-parameter-type:build
mise run //package/config/oxlint:build
```

The second produces the sidecar oxlint actually loads.
A sweep silently uses whichever sidecar is on disk.

Probe summaries with `probe.mjs` from the session scratch directory,
 copied into the plugin package to run,
 since TypeScript resolution fails from elsewhere:

```bash
PROBE=$(mktemp --tmpdir="$PWD" probe-XXXX.mjs)
cp <scratch>/probe.mjs "$PROBE"
node "$PROBE" <fixture-file> <exported-name>...
```

Falsify inside `package/module/kv-store`,
 which is the nearest package that both depends on `type-fest` and type-checks,
 then delete the files.
The fixture package has `type-fest` but its `lint:types` is deliberately absent.

Commit before mutation-checking.
`git checkout --` restores to HEAD and will delete an uncommitted fix rather than the mutant.

## Sweep discipline

While a sweep runs: no rebuilds, and no edits to any file it lints.
Docs, reads and probes of the built artifact are fine.

Record beside every capture: the commit, the plugin digest, the sidecar digest.
A capture without those cannot be told from one taken against a stale sidecar.

Registered criterion, in its reusable form:

- offers must not rise, which is the only soundness statement
- no category other than argument opacity may move
- offers falling is expected, and each fall is sampled to its cause
- argument opacity rising is expected, and is **not** required to accompany an offer loss

That last clause was learned the hard way. A capture landing on a callable-typed parameter has
 no offer to lose, because that classification is an opaque capability.

A delta that disagrees with expectation is not evidence about the change until the change has
 been removed and the capture repeated.
A delta that survives removing the thing under test was never about it.

Wall clock is retired as an instrument, three times over.
Identical findings have come back at 169s, 543s, 8m16s and 3m00s,
 and the transitive-capture walk came in faster while doing strictly more work.

## What the baseline is, and what a zero means

Current baseline: `sweep-51-prefix.txt` at 1966 findings, digests recorded beside it.
It is the first capture in this work that can be checked afterwards rather than trusted.

The previous standing baseline of 1939 is **retired as unreproducible**.
Four runs spanning both code states and both cache states read 1966,
 including one restoring the exact pre-fix source with both artifacts rebuilt.
Forty-two files appeared in both the added and removed sets of that difference,
 meaning one finding renamed rather than findings gained and lost,
 which is the signature of a capture blended across two analyzer versions.
Task #71 holds the repair of the one substantive claim that rested on it.

A zero delta does **not** mean the shape is absent.
Of 1966 findings only 32 are offers, so 1934 parameters are already withheld for other reasons,
 and a shape occurring constantly on already-withheld parameters produces the identical zero.
Counting syntax rather than findings:
 25 stores of a function expression into a property target,
 37 returns of a function expression,
 356 identifier stores into property targets.
Those are lower bounds and were sampled as genuine.
The shapes are common here; the zeros describe the offer population.

## Channels now closed, with the mechanism for each

- bare closure stored outward: capture recorded at the store site
- closure handed to a retaining callee: captures carried per formal on the owned call edge
- closure stored or returned by name: resolve the callable, never test the syntax
- conditional and container held in a local: ask what a value can be, one walk
- closure reaching state only through a sibling call: the capture walk follows calls
- closure returned: opacity, because the benign-return precondition fails
- construction: opacity, since `NewExpression` was handled nowhere at all
- yield: opacity, since a yielded value reaches no returned set
- async return: **not** a withholding, a tracking repair, by making `await` transparent
- tagged template: opacity, since a tag is a call and a `TaggedTemplateExpression` is not one
- throw: opacity, since a handler outlives the throw and no returned record exists to track it
- callable inside a returned literal: descend the literal, reusing the result-site aggregate walk
- store of what a nested callable hands back: a nested callable has no summary to defer against
- destructuring default: scan binding-element defaults, where the declaration scan never looked
- call result as an argument, and through a pattern, logical assignment or parameter default
- conditional write target, and an element or property of an authored literal

## Design decisions taken, and why

The admission gate for a handed capture is the callee's own uncertainty about the formal,
 not the reason for it.
Gating on retention provenance is unsound:
 absent retention means call-caused or unknown, never proven non-retaining,
 so a callee forwarding its callback to something unresolved would pass.
Provenance is then copied unchanged, which is what makes one channel produce two messages,
 a silent store and a spoken forward, without a second decision.

Captures are kept beside ordinary origins on the edge, never folded into them.
An ordinary origin says the callee received the caller's value,
 so a write or a return it records is a fact about that value.
A capture says only that invoking the callable can reach the parameter.
Folding them together would also reach the unresolved boundary,
 where over-approximating withholds on ordinary `map` and `filter` code.

Captured origins must not go into `bindingOriginBySymbolId`.
That map asserts a value is parameter-derived, and a closure is not derived from what it
 captured; it carries a capability reaching it.
Overloading it turns silent store provenance into reportable call provenance.

A returned callable takes opacity rather than a returned origin.
A returned origin is a positive capability claim, and the available helper over-approximates by
 scanning nested callable bodies.
An over-approximation is safe on a channel that withholds and unsafe on one that claims.
Nothing discharges on a returned set today, so the reuse would state the wrong relation rather
 than break immediately.

The capture walk's source-file bound is a **cost** bound, not a soundness one.
Following a cross-file callee contributes nothing, because its body names symbols absent from
 the origin map, and loses nothing, because a callable able to capture those bindings is written
 inside the callable that owns them.
No assertion can defend it and none pretends to.

Provenance text must be true even where no reader sees it.
Three prefixes now exist, all silent, all recognised by `isRetentionProvenance`:
 `stored into `, `handed outward by `, `handed back as a callable capturing it at `.
Reusing one prefix for a different escape produced facts like
 `stored into a construction of RowKeeper`, which reads as a store into the construction.

## Mutation checking is the only instrument that finds an untested rule

Five mutants have survived a green suite in this work, and they did not mean the same thing.

Check first whether the mutant implements the defect it claims to. One here restored an early
 return only when origins had already been found, which never happens for the shape under test, so
 it behaved exactly like the fixed code and proved nothing. That reading is the cheapest to rule out
 and the easiest to mistake for the others.

- The retention-only gate survived every fixture and control.
  The design was right and nothing measured it.
  Resolution: a new fixture, `relayCallable`.
- Deleting the source-file bound survived.
  The code was right and my account of why was backwards.
  Resolution: correct the claim, and record that no assertion can defend it.
- Treating nullish coalescence as right-operand-only survived,
  because the coalescence fixture happened to put its capture on the right.
  Resolution: a fixture putting it on the left, built so the origin walk cannot reach it either.
- An activation fix through the possible-value walk changed nothing at all.
  Two shapes written to exercise it already passed without it.
  Resolution: revert. Landing a path no shape reaches, documented as a fix, is worse than
  leaving the defect recorded.

Assert on diagnostics, not on offer counts, wherever silence is the intended outcome.
A caller that says nothing and a caller that reports argument opacity naming its callee both
 lose their offer and both read the same opaque set.
Unique parameter names are what make a diagnostic count per callable rather than per file.

## The method that is replacing the queue

Walking escape channels on purpose is cheaper than waiting for defects to surface, and it found
 three in one pass.

Write one file where **every** parameter genuinely leaks, each through a different channel, each
 with a unique parameter name, plus two controls that must still be offered.
Any offer the file draws is then a false offer by construction,
 and oxlint names them with no reasoning about the analyzer required.
Then apply the ordinary bar to each candidate.

First pass: fourteen channels, six offers, two of them the intended controls.
Three real defects, all now fixed.
The fourth candidate, a callback parameter retained by its driver, is carried forward.

Second pass staged in `hunt2.ts` in the session scratch directory:
 `Object.defineProperty`,
 `splice`,
 `Array.from`,
 a spread copy,
 `WeakMap.set`,
 `Reflect.set`,
 an optional call,
 a class field initialiser,
 a method reaching state through `this`,
 a tagged template,
 the retained callback parameter,
 an iterator object handed back,
 and two controls.

Task #73 carries this. Record the channels covered rather than the conclusion:
 a pass that finds nothing is the only available evidence that the shape space is closed,
 and it is weak evidence.

## Channels closed by working the queue as one pass

The queue had been filed one defect at a time and named one cause eight times: a call result
 reaching a use site the deferred relation did not cover.
Measuring the whole queue in a single file resolved it.

- an argument that is a call result, through an unresolved receiver and an owned one
- a binding through a destructuring pattern, a logical assignment, a parameter default
- a conditional write target
- a property of an authored literal, and an element of one
- a return of any of those

The fix is one idea applied in three places: ask where a value can have **come from** rather
 than what layer sits over it.
The value-source walk is reused, aggregate members are added on top of it only for this
 question, and widening can only add call sites, so every shape it reaches is a hole closed.

Four queue tasks needed no fix at all, and measuring them said so:
 a store through a destructuring pattern, an object literal property, a store from a parameter
 initializer, and an element property write on an array parameter.
Those four were filed from reading rather than probing.
**Probe before filing.**

Activation discovery is now gated on ancestry.
It had visited every node in the body, so a call inside a closure nothing runs activated its
 target and the target's body was read as though the enclosing callable had run it.
Two forms differ, and the first probe used the wrong one:
 a sibling bound to a `const` arrow does not reproduce it,
 a function declaration does.
Assert both halves of that fix, since the false fact must go **and** the offer must stay
 withheld.

## Where the work stands

**Every false offer this work found and falsified is closed.** Four escape-channel hunt passes drew
 44 channels; the fourth found nothing, and none of its channels had been fixed directly, so the
 fixes generalise past the shapes that motivated them. That is encouraging and still weak evidence:
 four passes are four samples of a space nobody has enumerated. Two of the three false offers found
 since that fourth pass came from a stronger reviewer reading the source rather than from a hunt
 pass, which says something about where the remaining ones are: in the relations between channels,
 not in the syntax any one channel scans.

Closed and swept: #51, #66, #67, #68, #69, #72, #74.
Every sweep but #69's came back at zero delta; #69's moved by one true finding,
 a closure capturing a promise `resolve` handed to `handle.once`.

Closed, falsified and mutation-checked, and **not yet swept**: #77, #65, #63, #78 and the
 write-through half of #78. Task #80 holds that sweep. #63 raises offers by construction, which is
 the first change here that must justify offer growth rather than only offer loss.

### The three things a callee can do with a callable a caller handed it

This is the shape of the last two defects, and it is worth stating on its own because the same
 relation went wrong twice in the same afternoon. A callee can:

-    **keep it**, which `propagateCapturedCapability` answered from the callee's `opaque` set, and
     which #69 closed
-    **hand back what invoking it produced**, which nothing answered, so `storeInvokedResult` stored
     a row aliasing the caller's own and was offered
-    **write through what invoking it produced**, which nothing answered either, so
     `handInlineToWriter` recorded no effect at all while the callee's `mutated=[0]` said exactly
     what it does

All three now read the same per-formal captures, and the choice of channel per case is deliberate:
 keeping speaks as opacity with the callee's own provenance, handing back speaks as a returned
 origin so the accepted return policy still applies, and writing speaks as a mutation because that
 is what happens. The precision control for all three is `readThroughCallable`, whose formal is
 neither opaque nor returned nor written because it keeps only a primitive, and whose caller
 `handCaptureToReader` keeps its offer.

### The fourth thing, which is not a callee at all

**#79** closes the same relation at the other kind of boundary. Captures lived on owned call edges
 only, so a call with no owned edge recorded none, and the reach of that is much wider than library
 functions: a possibly-overridden method is treated as unresolved on purpose, so **every instance
 method that keeps a callback** was losing the capture. Measured three ways, the same retainer
 written as an instance method recording nothing while the static and plain-function forms record
 `opaque=[0]`. Falsified twice.

The gate is narrow and its narrowness rests on a premise now measured in full: a closure handed as
 an argument is activated, and an activated closure's body is scanned inline as part of the
 enclosing callable, so every channel the enclosing callable has applies to the closure too. A
 store, an unresolved handoff, a construction, a throw, and a push into a container the callee
 itself supplied all record opacity for a closure that completes with nothing. The single channel
 that cannot apply is what invoking the closure hands back, because the uninspectable callee
 receives that value instead of the enclosing callable. So the gate asks only that, and
 `rows.map((row) => config.row.label,)` keeps its offer.

### Where a capture reaches an implementation, which is three positions rather than one

The inspection took a call's arguments alone. A capturing closure can also arrive as the
 **receiver**, which is what `.bind`, `.call`, `.apply` and any retaining method look like, or as the
 **callee**, which is what an unresolved invocation of a dynamically selected closure looks like. All
 three are inspected now, and the receiver form was falsified.

### And a declared type can lie about what a completion is

The gate that keeps the capture channel narrow asks whether a closure's completion can carry mutable
 state, and trusted the completion's static type. Two measured shapes abuse that trust: a local
 annotated `() => void` holding a row-returning callable, and a row asserted to a string. A completion
 is now judged by what it is, with assertions stripped and a call followed to its callable, and
 following stops at an external callee because an external declaration's return type is what this rule
 trusts everywhere else.

A property read is not a call, so the reach walk missed a getter over caller state entirely. It now
 collects every callable an authored literal or class expression declares whenever a body reads a
 property off one.

### Open

-    **#82**, two activation forms that still cannot reach a parameter default: a binding filled by
     assignment, whose fix needs the enclosing node universe that `closure-activity.ts` has and the
     value walk does not, and two more forms that are withheld today by other channels rather than by
     activation. Falsify the assignment-alias form before fixing.
-    **#81**, an owned call written only in a parameter default is invisible to the ownership scan.
     The comment claiming that cannot happen is corrected; the consequence is unmeasured.
-    **#87**, memoisation for the completion and reach walks. Insurance rather than a fix: the sweep
     with the gate ran faster than the one before it, so nothing measured shows a problem.
-    **#89**, whether two call edges may share one call-site key. Raised by the advisor and not yet
     settled: a conditional default pushes two edges carrying one key, and
     `propagateResultApplications` keys a `Map` by it, which keeps the last pair. Both source
     orderings answer identically, because that shape is answered by the reach walk rather than by
     the edge, so the probe that would settle it needs the edge path and the edge path is broken by
     #97.
-    **#97**, a defaulted callee's returned fact never reaching a store of its result. Measured over
     one store: a directly named callee and a local alias both charge, and a parameter carrying that
     callee as its default does not, with one edge rather than two.
-    **#90** through **#96**, from sol's third review. The one to do first is #91, a capture handed
     to a callback parameter, because the direct callback branch returns before the unresolved-capture
     gate and so before anything records that capture.

### Declined with the reason recorded

-    **#54**, restoring an offer for a store into another parameter. The callee cannot decide it.
     The edge from one parameter to another escapes or not depending on where the first came from,
     which only the caller knows, so the naive fix admits a false offer. It needs a
     parameter-to-parameter reachability relation propagated at the edge, and it is precision only.
-    **#64**, the read-only-capture precision question. A `throw` is modelled nowhere, so no body
     summary is complete enough to grant an offer on the strength of it.

#63 and #65 were previously declined here and are now closed. Both declinations rested on one
 claim, that a call to a parameter whose declared type is a function cannot be resolved to the
 arrow written as its default. That claim was true of overload resolution and false of the
 question: `possibleValueNodes` answers it by following the parameter's declaration to its
 initializer, and no signature resolution is involved. The lesson is narrow and worth keeping: a
 declination that names one mechanism as impossible is a claim about that mechanism, not about the
 goal.

## What the capture-channel sweep settled

Offers held at 31 and only argument-opacity moved, six added and one removed. The six additions are
 one true shape across three locales times two layers. The removal is a derivation replacing a
 conservative fallback, and it is precision-only on the independent ground that no offer was added or
 removed anywhere. Recorded in full in the planning doc.

Both artifact digests were recorded before the run and re-verified after it, and the two doc-only
 commits that landed while it ran left both unchanged.

## Primary records

- `doc/planning/prefer-readonly-return-substitution.md`, the running measurement log
- `doc/decision/prefer-readonly-result-provenance.md`, the accepted result-provenance policy
- `doc/decision/prefer-readonly-contract-name-narrowing.md`

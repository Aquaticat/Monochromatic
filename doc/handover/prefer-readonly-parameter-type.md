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

Four mutants have survived a green suite in this work, and they did not mean the same thing.

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

Closed and swept: #51, #66, #67, #68, #69.
The three-channel fix for constructions, yields and awaited returns is landed, tested and
 mutation-checked, with its sweep running at time of writing; constructions are common here, so
 this is the first change in this work where a large offer fall would be plausible rather than
 surprising.
Every sweep but #69's came back at zero delta; #69's moved by one true finding,
 a closure capturing a promise `resolve` handed to `handle.once`.

Open, and none of them is a false offer:

- #71, re-measuring task #46's per-finding claim against the current baseline, running
- #74, discharging a construction whose constructor copies rather than retains
- #73, the next escape-channel hunt pass, staged and waiting for the queue to clear

Declined with the reason recorded, because building each the obvious way is worse than leaving
 it:

- #54, restoring an offer for a store into another parameter. The callee cannot decide it. The
  edge from one parameter to another escapes or not depending on where the first came from, which
  only the caller knows, so the naive fix admits a false offer. It needs a
  parameter-to-parameter reachability relation propagated at the edge, and it is precision only.
- #63, separating an initializer's own expression from a callable packaged inside it. The
  over-attribution is load-bearing. Gating the callable requires its invocation site to activate
  it, and `callback()` on a parameter typed `() => void` resolves to the type's signature rather
  than to the arrow written as the default, so the fix would lose a write the callable genuinely
  performs.
- #65, activating a closure filled by assignment. The same missing capability as #63: what a
  binding whose declared type is a function actually holds. A change for it measured as dead code
  and was reverted rather than landed.
- #64, the read-only-capture precision question. A `throw` is modelled nowhere, so no body
  summary is complete enough to grant an offer on the strength of it.

Everything else in the queue is closed. Four of those closures needed no code at all, and
 measuring them said so.

## Primary records

- `doc/planning/prefer-readonly-return-substitution.md`, the running measurement log
- `doc/decision/prefer-readonly-result-provenance.md`, the accepted result-provenance policy
- `doc/decision/prefer-readonly-contract-name-narrowing.md`

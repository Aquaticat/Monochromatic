/**
 * Fixture probing where a collection member's result carries receiver state.
 *
 * Every function here mutates caller-owned state reached through a call result
 * rather than through the receiver directly. Nothing currently records that a
 * result aliases the receiver, so each lands on the opaque boundary instead of
 * being attributed to the parameter it actually changes.
 *
 * @module
 */

/**
 * Element carrying mutable state, so an interior write is observable.
 */
type Labelled = {
  label: string;
};

/**
 * Mutates a parameter held inside an object this callable built.
 *
 * The first of the two programs `doc/planning/prefer-readonly-container-value-provenance.md`
 * names as the ones a careless container fix would wrongly offer read-only. The write goes
 * *through* the fresh object to the caller's own value, so it has to stay attributed.
 *
 * The container record that suppresses `stack.pop()` must not touch this: it is consulted
 * only where a member restructures its receiver, and this is an ordinary property write
 * whose origins run through the value path. Emptying those origins instead, which is the
 * redesign that document costs and rejects, empties this.
 *
 * @param box - Value written through a locally built object.
 *
 * @example
 * ```ts
 * heldObjectMutationEffect({ label: 'original', },);
 * ```
 */
export function heldObjectMutationEffect(box: Labelled,): void {
  /**
   * Object built here, holding the caller's value.
   */
  const held = {
    inner: box,
  };
  held.inner.label = 'rewritten';
}

/**
 * Mutates a parameter held inside an array this callable built.
 *
 * The second of the two programs, through the element path rather than the property path.
 * `held` is a container this callable constructed, so the record covers it and the
 * structural charge on it is suppressed; the write below is still the caller's value being
 * rewritten and is attributed by the element step.
 *
 * @param box - Value written through a locally built array.
 *
 * @example
 * ```ts
 * heldArrayMutationEffect({ label: 'original', },);
 * ```
 */
export function heldArrayMutationEffect(box: Labelled,): void {
  /**
   * Array built here, holding the caller's value.
   */
  const held = [box,];
  /**
   * Element read back out of the local array.
   */
  const first = held[0];
  if (first === undefined)
    throw new Error('Expected the held element to rewrite.',);
  first.label = 'rewritten';
}

/**
 * Restructures a container this callable built while holding a parameter.
 *
 * The case the container record exists for, and the direction opposite to the two above.
 * Nothing writes `box`: `pop` restructures the fresh array, and the parameter is what the
 * array holds rather than what holds the array. Reported as a mutation before the record
 * existed, on the work-stack idiom `AGENTS.md` requires over recursion.
 *
 * @param box - Value the local array holds and nothing writes.
 *
 * @returns whether the array still holds anything.
 *
 * @example
 * ```ts
 * heldContainerRestructureEffect({ label: 'original', },);
 * ```
 */
export function heldContainerRestructureEffect(box: Labelled,): boolean {
  /**
   * Array built here, holding the caller's value.
   */
  const stack = [box,];
  stack.pop();
  return stack.length > 0;
}

/**
 * Restructures a container the caller owns, reached through one local hop.
 *
 * The control that keeps the record from covering every local. `inner` names the caller's
 * own array rather than one built here, so its binding arrives through a property step,
 * the record is not set, and the structural charge stands. A record keyed on locality
 * rather than on how the value was built would discharge this and lose a real write.
 *
 * @param carrier - Carrier whose own array is restructured.
 *
 * @example
 * ```ts
 * borrowedContainerRestructureEffect({ rows: [], },);
 * ```
 */
export function borrowedContainerRestructureEffect(
  carrier: { rows: Labelled[]; },
): void {
  /**
   * Caller's own array, reached through one local hop.
   */
  const inner = carrier.rows;
  inner.push({ label: 'appended', },);
}

/**
 * Mutates the element an observer member handed back on its own.
 *
 * The pair to `boundLookupMutationEffect`, for the arm of the result gate that answers
 * a bare value rather than a container. `find` carries the verified relation saying its
 * result is one of the receiver's own elements, and it takes an owned observer, so the
 * receiver is discharged and the write below is recorded against `rows` directly.
 *
 * Before that arm existed the call reported opacity instead, which read as caution and
 * was a hole: `at` carries the identical relation and answered from the channel table,
 * so the same write through the same kind of element was attributed for one member and
 * merely reported for the other.
 *
 * Both directions fail here. Remove the value arm from `viewResultUnaccounted` and this
 * reports opacity rather than a mutation; remove the element attribution beneath it and
 * the mutation disappears while the discharge stays, which is the wrong offer this
 * fixture exists to prevent.
 *
 * @param rows - Rows whose matching element is rewritten through a result.
 *
 * @example
 * ```ts
 * observerValueResultMutationEffect([{ label: 'target' },]);
 * ```
 */
export function observerValueResultMutationEffect(rows: Labelled[],): void {
  /**
   * Matching element obtained through an owned predicate.
   */
  const found = rows.find(function isTarget(candidate: { readonly label: string; },): boolean {
    return candidate.label === 'target';
  },);
  if (found === undefined)
    throw new Error('Expected a match to rewrite.',);
  found.label = 'rewritten';
}

/**
 * Mutates a looked-up value through an intermediate binding.
 *
 * The shape the rule's own `addUncertaintyProvenance` uses, and the reason
 * `readonlyEffectSelfHostingOverride` cannot narrow: `Map.get` reaches no user code
 * and returns a value that carries state, and the body mutates exactly that value.
 *
 * @param facts - Map whose stored set is extended.
 *
 * @param key - Lookup key.
 *
 * @example
 * ```ts
 * boundLookupMutationEffect(new Map(), 'k');
 * ```
 */
export function boundLookupMutationEffect(
  facts: Map<string, Set<string>>,
  key: string,
): void {
  /**
   * Stored set obtained from the receiver, or a fresh accumulator.
   */
  const stored = facts.get(key,) ?? new Set<string>();
  stored.add('recorded',);
  facts.set(
    key,
    stored,
  );
}

/**
 * Mutates a looked-up value with no intermediate binding at all.
 *
 * The chained form. Provenance that only registers variable declarations cannot
 * see this, because there is no binding to register: the receiver of `add` is
 * itself a call expression.
 *
 * @param facts - Map whose stored set is extended in place.
 *
 * @param key - Lookup key.
 *
 * @example
 * ```ts
 * chainedLookupMutationEffect(new Map(), 'k');
 * ```
 */
export function chainedLookupMutationEffect(
  facts: Map<string, Set<string>>,
  key: string,
): void {
  facts.get(key,)
    ?.add('recorded',);
}

/**
 * Writes through a result reached by property access, with no binding.
 *
 * `values.at(0)` hands back an element, and the write targets a property of that
 * element. The write target's root is a call expression rather than an identifier,
 * so root resolution stops before reaching the parameter.
 *
 * @param values - Array whose first element is rewritten.
 *
 * @example
 * ```ts
 * chainedElementWriteEffect([]);
 * ```
 */
export function chainedElementWriteEffect(values: Labelled[],): void {
  /**
   * Element obtained without binding, whose property is overwritten.
   */
  const element = values.at(0,);
  if (element !== undefined)
    element.label = 'rewritten';
}

/**
 * Destructures a looked-up value and mutates the extracted part.
 *
 * Provenance must survive destructuring, or the extracted binding carries no
 * origin and the write is attributed to nothing.
 *
 * @param rows - Map whose stored row is rewritten through a destructured element.
 *
 * @param key - Lookup key.
 *
 * @example
 * ```ts
 * destructuredLookupMutationEffect(new Map(), 'k');
 * ```
 */
export function destructuredLookupMutationEffect(
  rows: Map<string, Labelled[]>,
  key: string,
): void {
  /**
   * Stored row, destructured to its first element.
   */
  const [first,] = rows.get(key,) ?? [];
  if (first !== undefined)
    first.label = 'rewritten';
}

/**
 * Passes a looked-up value to a callee this rule cannot inspect.
 *
 * The escape case. Attributing the mutation is not enough here: once the result
 * leaves through an unresolved call, the parameter it came from must be reported as
 * reaching that call, exactly as a direct argument would be.
 *
 * @param facts - Map whose stored set escapes into an unresolved call.
 *
 * @param key - Lookup key.
 *
 * @example
 * ```ts
 * escapingLookupEffect(new Map(), 'k');
 * ```
 */
export function escapingLookupEffect(
  facts: Map<string, Set<string>>,
  key: string,
): void {
  /**
   * Stored set handed to a host serializer.
   */
  const stored = facts.get(key,);
  if (stored !== undefined)
    JSON.stringify([...stored,],);
}

/**
 * Returns a looked-up value, letting caller-owned state leave the callable.
 *
 * Provenance says this result is reachable from `facts`. Whether a returned alias
 * is itself an effect is a separate question from attribution, and this function
 * exists to pin whichever answer the model gives rather than to assert one.
 *
 * @param facts - Map whose stored set is handed back.
 *
 * @param key - Lookup key.
 *
 * @returns stored set, aliasing receiver interior.
 *
 * @example
 * ```ts
 * returnedLookupEffect(new Map(), 'k');
 * ```
 */
export function returnedLookupEffect(
  facts: Map<string, Set<string>>,
  key: string,
): Set<string> | undefined {
  return facts.get(key,);
}

/**
 * Reads a looked-up value without mutating it.
 *
 * The control. Provenance must not turn every lookup into an effect: this receiver
 * is only read, so it must still be offered as read-only. Absent this, every
 * assertion here would hold against a fixture nothing linted.
 *
 * @param facts - Map read through a lookup.
 *
 * @param key - Lookup key.
 *
 * @returns stored count.
 *
 * @example
 * ```ts
 * readOnlyLookupEffect(new Map(), 'k');
 * ```
 */
export function readOnlyLookupEffect(
  facts: Map<string, Set<string>>,
  key: string,
): number {
  return (facts.get(key,) ?? new Set<string>()).size;
}

/**
 * Mutates a looked-up value reached through computed member access.
 *
 * The syntax-shape probe. `facts['get']` is an element access rather than a property
 * access, and both the result relation and the opaque boundary test for a property
 * access before doing anything, so this call may be invisible to each. Any diagnostic
 * at all is the minimum; silence means a mutation of caller state went unreported.
 *
 * @param facts - Map whose stored set is extended through a computed lookup.
 *
 * @param key - Lookup key.
 *
 * @example
 * ```ts
 * computedLookupMutationEffect(new Map(), 'k');
 * ```
 */
export function computedLookupMutationEffect(
  facts: Map<string, Set<string>>,
  key: string,
): void {
  const stored = facts['get'](key,) ?? new Set<string>();
  stored.add('recorded',);
  facts['set'](key, stored,);
}

/**
 * Mutates a looked-up value narrowed by an assertion.
 *
 * The transparent-form probe: `as` erases at runtime, so the value is the lookup's own.
 *
 * @param facts - Map whose stored set is extended after an assertion.
 *
 * @param key - Lookup key.
 *
 * @example
 * ```ts
 * assertedLookupMutationEffect(new Map(), 'k');
 * ```
 */
export function assertedLookupMutationEffect(
  facts: Map<string, Set<string>>,
  key: string,
): void {
  const stored = facts.get(key,) as Set<string>;
  stored.add('recorded',);
}

/**
 * Restructures a receiver through computed member access.
 *
 * The sharpened syntax-shape probe. Unlike the map cases, `string[]` has an honest
 * deeply read-only projection, so nothing suppresses a suggestion here on grounds of
 * the value type. If computed access is invisible to the collection handling, this
 * parameter is offered as read-only while the body pushes to it, and applying that
 * suggestion does not compile.
 *
 * @param values - Array restructured through a computed member call.
 *
 * @example
 * ```ts
 * computedStructureEffect([]);
 * ```
 */
export function computedStructureEffect(values: string[],): void {
  values['push']('appended',);
}

/**
 * Second element shape, so a map value type can be a union of object types.
 */
type Tagged = {
  tag: string;
};

/**
 * Mutates a looked-up value whose declared type is a union of object types.
 *
 * The normalization probe. `Map<string, Labelled | Tagged>.get` returns
 * `Labelled | Tagged | undefined`, whose constituents are the two object types plus
 * absence, while the receiver's held position is the union `Labelled | Tagged` as one
 * type object. Asking whether any result constituent is identical to that union finds
 * nothing, because the union object never appears among its own flattened
 * constituents, so this mutation went unattributed.
 *
 * @param records - Map whose stored union-typed value is rewritten.
 *
 * @param key - Lookup key.
 *
 * @example
 * ```ts
 * unionValueLookupEffect(new Map(), 'k');
 * ```
 */
export function unionValueLookupEffect(
  records: Map<string, Labelled | Tagged>,
  key: string,
): void {
  const stored = records.get(key,);
  if (stored === undefined)
    return;
  if ('label' in stored)
    stored.label = 'rewritten';
  else
    stored.tag = 'rewritten';
}

/**
 * Mutates a destructured property its contract does not name.
 *
 * The callee half of the restricted-walk probe. Its parameter is destructured and it
 * carries a contract, which is the shape that makes the argument analysis walk a
 * caller's object literal with only the contract-named properties.
 *
 * @param named - Property the contract declares as mutated.
 *
 * @param unnamed - Property the contract omits while the body still mutates it.
 *
 * @mutates named - Adds a recorded entry.
 *
 * @example
 * ```ts
 * mutateBeyondContract({ named: new Set(), unnamed: new Set() });
 * ```
 */
function mutateBeyondContract({
  named,
  unnamed,
}: {
  named: Set<string>;
  unnamed: Set<string>;
},): void {
  named.add('declared',);
  unnamed.add('undeclared',);
}

/**
 * Passes a looked-up value in a literal property the callee contract omits.
 *
 * If the restricted walk skips `unnamed`, the lookup result carries no origin into the
 * call, so mutating it inside the callee is attributed to nothing, while the escape
 * check calls literal membership attributed and licenses discharging the lookup. That
 * combination would be a silent miss, so this probe exists to find out whether the
 * restricted path is reachable from a literal the escape check accepts.
 *
 * @param facts - Map whose stored set is handed to a partially contracted callee.
 *
 * @param key - Lookup key.
 *
 * @example
 * ```ts
 * contractRestrictedLiteralEffect(new Map(), 'k');
 * ```
 */
export function contractRestrictedLiteralEffect(
  facts: Map<string, Set<string>>,
  key: string,
): void {
  const stored = facts.get(key,) ?? new Set<string>();
  mutateBeyondContract({
    named: new Set<string>(),
    unnamed: stored,
  },);
}

/**
 * Mutates both properties of a destructured parameter its contract fully names.
 *
 * Control isolating the contract-name restriction from callee routing in general. Its
 * parameter is destructured exactly like `mutateBeyondContract`, and the only
 * difference is that every mutated property appears in the contract.
 *
 * @param named - First mutated property.
 *
 * @param alsoNamed - Second mutated property.
 *
 * @mutates named - Adds a recorded entry.
 *
 * @mutates alsoNamed - Adds a recorded entry.
 *
 * @example
 * ```ts
 * mutateWithinContract({ named: new Set(), alsoNamed: new Set() });
 * ```
 */
function mutateWithinContract({
  named,
  alsoNamed,
}: {
  named: Set<string>;
  alsoNamed: Set<string>;
},): void {
  named.add('declared',);
  alsoNamed.add('also-declared',);
}

/**
 * Mutates properties reached through an identifier parameter.
 *
 * Control isolating the destructuring shape. Its parameter is a plain identifier, which
 * is the shape that makes the argument analysis walk a caller's literal with every
 * property rather than the contract-named subset.
 *
 * @param bag - Container whose stored sets are mutated.
 *
 * @mutates bag - Adds recorded entries to stored sets.
 *
 * @example
 * ```ts
 * mutateThroughIdentifier({ named: new Set(), unnamed: new Set() });
 * ```
 */
function mutateThroughIdentifier(bag: {
  named: Set<string>;
  unnamed: Set<string>;
},): void {
  bag.named
    .add('declared',);
  bag.unnamed
    .add('undeclared',);
}

/**
 * Passes a looked-up value in a literal property the callee contract names.
 *
 * Pairs with `contractRestrictedLiteralEffect`: same caller shape, same lookup, same
 * literal, and the callee differs only in naming every mutated property.
 *
 * @param facts - Map whose stored set is handed to a fully contracted callee.
 *
 * @param key - Lookup key.
 *
 * @example
 * ```ts
 * fullContractLiteralEffect(new Map(), 'k');
 * ```
 */
export function fullContractLiteralEffect(
  facts: Map<string, Set<string>>,
  key: string,
): void {
  const stored = facts.get(key,) ?? new Set<string>();
  mutateWithinContract({
    named: new Set<string>(),
    alsoNamed: stored,
  },);
}

/**
 * Passes a looked-up value in a literal handed to an identifier parameter.
 *
 * Pairs with `contractRestrictedLiteralEffect`: same caller shape, same lookup, same
 * literal, and the callee differs only in taking an identifier instead of a
 * destructuring pattern.
 *
 * @param facts - Map whose stored set is handed to an identifier-parameter callee.
 *
 * @param key - Lookup key.
 *
 * @example
 * ```ts
 * identifierParameterLiteralEffect(new Map(), 'k');
 * ```
 */
export function identifierParameterLiteralEffect(
  facts: Map<string, Set<string>>,
  key: string,
): void {
  const stored = facts.get(key,) ?? new Set<string>();
  mutateThroughIdentifier({
    named: new Set<string>(),
    unnamed: stored,
  },);
}

/**
 * Row shape whose single property the rule can express as readonly.
 */
type LabelledRow = {
  label: string;
};

/**
 * Mutates a row reached through a destructured property its contract omits.
 *
 * Row-typed counterpart of `mutateBeyondContract`, written so the caller's parameter has
 * a readonly form the rule is able to offer. That is what turns an unrecorded mutation
 * from a lost warning into a suggestion that does not compile.
 *
 * @param named - Row the contract declares as mutated.
 *
 * @param unnamed - Row the contract omits while the body still writes it.
 *
 * @mutates named - Overwrites recorded label.
 *
 * @example
 * ```ts
 * mutateBeyondContractRow({ named: { label: '' }, unnamed: { label: '' } });
 * ```
 */
function mutateBeyondContractRow({
  named,
  unnamed,
}: {
  named: LabelledRow;
  unnamed: LabelledRow;
},): void {
  named.label = 'declared';
  unnamed.label = 'undeclared';
}

/**
 * Passes an element in a literal property the callee contract omits.
 *
 * The parameter is an array of rows, whose readonly form the rule offers, so an
 * unrecorded write through the omitted property surfaces as an offer that fails to
 * compile once applied rather than as a merely missing warning.
 *
 * @param rows - Array whose element is handed to a partially contracted callee.
 *
 * @example
 * ```ts
 * contractRestrictedRowEffect([{ label: '' }]);
 * ```
 */
export function contractRestrictedRowEffect(rows: LabelledRow[],): void {
  const first = rows.at(0,) ?? { label: '', };
  mutateBeyondContractRow({
    named: { label: '', },
    unnamed: first,
  },);
}

/**
 * Passes a parameter itself in a literal property the callee contract omits.
 *
 * No collection lookup and no receiver opacity are involved, so this probe isolates the
 * contract-name narrowing from result provenance entirely. If the narrowing drops the
 * parameter's origin here, the resulting offer is wrong for reasons that predate any
 * provenance work.
 *
 * @param row - Row handed to a partially contracted callee through an omitted property.
 *
 * @example
 * ```ts
 * directRestrictedRowEffect({ label: '' });
 * ```
 */
export function directRestrictedRowEffect(row: LabelledRow,): void {
  mutateBeyondContractRow({
    named: { label: '', },
    unnamed: row,
  },);
}

/**
 * Passes a parameter directly to a callee whose contract omits the mutated property.
 *
 * Companion to `directRestrictedRowEffect` using a direct argument rather than a literal
 * property, so the two together separate the literal-walk path from argument handling in
 * general.
 *
 * @param bag - Container handed straight to a partially contracted callee.
 *
 * @example
 * ```ts
 * directArgumentRestrictedEffect({ named: { label: '' }, unnamed: { label: '' } });
 * ```
 */
export function directArgumentRestrictedEffect(bag: {
  named: LabelledRow;
  unnamed: LabelledRow;
},): void {
  mutateBeyondContractRow(bag,);
}

/**
 * Mutates one destructured property and only reads the other.
 *
 * Companion to `mutateBeyondContractRow` whose contract is accurate, used to measure what
 * dropping the contract-name narrowing costs in precision rather than in soundness.
 *
 * @param named - Row the body writes.
 *
 * @param unnamed - Row the body only reads.
 *
 * @mutates named - Overwrites recorded label.
 *
 * @example
 * ```ts
 * mutateOnlyNamedRow({ named: { label: '' }, unnamed: { label: '' } });
 * ```
 */
function mutateOnlyNamedRow({
  named,
  unnamed,
}: {
  named: LabelledRow;
  unnamed: LabelledRow;
},): void {
  if (unnamed.label === '')
    named.label = 'declared';
}

/**
 * Passes one parameter to a mutated property and another to a read-only one.
 *
 * Records the precision the sound propagation gives up. The callee writes only `named`,
 * so only `first` is really mutated, and propagating every packaged origin credits
 * `second` as well. The cost is a withheld offer, never a wrong one, and recovering it
 * needs the callee's own measured per-property effects rather than its authored contract.
 *
 * @param first - Row the callee writes.
 *
 * @param second - Row the callee only reads.
 *
 * @example
 * ```ts
 * narrowingPrecisionCostEffect({ label: '' }, { label: '' });
 * ```
 */
export function narrowingPrecisionCostEffect(
  first: LabelledRow,
  second: LabelledRow,
): void {
  mutateOnlyNamedRow({
    named: first,
    unnamed: second,
  },);
}

/**
 * Invokes one destructured property and reads another.
 *
 * The callee half of the invocation-exclusion probe. Its contract names only the array it
 * appends to, so the property holding a caller-owned row is one an authored contract used
 * to filter out, and every destructured binding here maps to parameter index zero.
 *
 * @param run - Callback the body invokes.
 *
 * @param collected - Array the body appends to.
 *
 * @param spare - Row the body only reads.
 *
 * @mutates collected - Appends one recorded label.
 *
 * @example
 * ```ts
 * inspectWithCallback({ run: () => {}, collected: [], spare: { label: '' } });
 * ```
 */
function inspectWithCallback({
  run,
  collected,
  spare,
}: {
  run: () => void;
  collected: string[];
  spare: LabelledRow;
},): void {
  run();
  collected.push(spare.label,);
}

/**
 * Mutates a parameter directly and also passes it beside an invoked callback.
 *
 * Middle link of the invocation-exclusion probe. Propagating every packaged origin puts
 * this parameter into the invoked set, because the callee invokes a sibling property and
 * every destructured binding collapses to parameter zero. Mutation propagation subtracts
 * the invoked set, so the direct write here can stop reaching an outer caller.
 *
 * @param victim - Row written directly and passed onward beside a callback.
 *
 * @example
 * ```ts
 * middleInvokedExclusionEffect({ label: '' });
 * ```
 */
export function middleInvokedExclusionEffect(victim: LabelledRow,): void {
  victim.label = 'direct';
  inspectWithCallback({
    run(): void {},
    collected: [],
    spare: victim,
  },);
}

/**
 * Passes a parameter to a callable that both mutates and appears to invoke it.
 *
 * Outer link of the invocation-exclusion probe, and the position where suppression would
 * become a wrong offer rather than a lost fact.
 *
 * @param row - Row handed to the middle link.
 *
 * @example
 * ```ts
 * outerInvokedExclusionEffect({ label: '' });
 * ```
 */
export function outerInvokedExclusionEffect(row: LabelledRow,): void {
  middleInvokedExclusionEffect(row,);
}

/**
 * Invokes one destructured property and writes another.
 *
 * Both effects land on parameter index zero, because every destructured binding of one
 * object parameter shares that index. Mutation propagation subtracts the invoked set from
 * the mutated set by index, so one call that does both can cancel itself out.
 *
 * @param run - Callback the body invokes.
 *
 * @param target - Row the body writes.
 *
 * @mutates target - Overwrites recorded label.
 *
 * @example
 * ```ts
 * invokeAndMutate({ run: () => {}, target: { label: '' } });
 * ```
 */
function invokeAndMutate({
  run,
  target,
}: {
  run: () => void;
  target: LabelledRow;
},): void {
  run();
  target.label = 'mutated';
}

/**
 * Passes a parameter to a callee that both invokes a callback and writes the parameter.
 *
 * Contract-independent probe: the contract names `target`, so the property holding this
 * parameter is one the narrowing keeps. Anything wrong here comes from the index-level
 * subtraction of invoked from mutated, not from which properties were walked.
 *
 * @param row - Row the callee writes.
 *
 * @example
 * ```ts
 * invokedExclusionDirectEffect({ label: '' });
 * ```
 */
export function invokedExclusionDirectEffect(row: LabelledRow,): void {
  invokeAndMutate({
    run(): void {},
    target: row,
  },);
}

/**
 * Packages a parameter behind an object-literal getter.
 *
 * The argument walk reads literal properties and spreads. A getter's value comes from
 * running its body, so a parameter returned by one reaches the callee without ever
 * appearing as a property value the walk can see.
 *
 * @param row - Row the callee writes, reachable only through an accessor body.
 *
 * @example
 * ```ts
 * accessorPackagedEffect({ label: '' });
 * ```
 */
export function accessorPackagedEffect(row: LabelledRow,): void {
  mutateBeyondContractRow({
    named: { label: '', },
    get unnamed(): LabelledRow {
      return row;
    },
  },);
}

/**
 * Packages a parameter through a spread of a local object.
 *
 * Companion shape: the value reaches the callee through a spread rather than a named
 * property, which the walk is documented to follow.
 *
 * @param row - Row the callee writes, reached through a spread.
 *
 * @example
 * ```ts
 * spreadPackagedEffect({ label: '' });
 * ```
 */
export function spreadPackagedEffect(row: LabelledRow,): void {
  mutateBeyondContractRow({
    named: { label: '', },
    ...{ unnamed: row, },
  },);
}

/**
 * Packages a parameter behind accessors nested one literal deeper.
 *
 * Neighbour of `accessorPackagedEffect` checking that the accessor handling is reached
 * wherever a literal is walked rather than only at the argument's top level, and that a
 * setter writing straight through to a parameter counts as much as a getter reading from
 * one.
 *
 * @param row - Row both accessors reach.
 *
 * @example
 * ```ts
 * nestedAccessorPackagedEffect({ label: '' });
 * ```
 */
export function nestedAccessorPackagedEffect(row: LabelledRow,): void {
  mutateBeyondContractRow({
    named: { label: '', },
    unnamed: {
      get label(): string {
        return row.label;
      },
      set label(next: string,) {
        row.label = next;
      },
    },
  },);
}

/**
 * Calls a supplied method and writes through what it returns.
 *
 * Callee half of the method-return probe. Nothing in the caller writes, so the caller's
 * own direct-write scan cannot record anything: the origin has to travel through the
 * argument walk for this write to be attributed at all.
 *
 * @param get - Method the body calls for a row it then writes.
 *
 * @mutates get - Overwrites a label on whatever row is returned.
 *
 * @example
 * ```ts
 * callThroughMethodResult({ get: () => ({ label: '' }) });
 * ```
 */
function callThroughMethodResult({ get, }: { get: () => LabelledRow; },): void {
  get()
    .label = 'written-through-result';
}

/**
 * Packages a parameter behind an object-literal method the callee calls.
 *
 * The shape `passedContainerClosureSemanticEffect` does not cover. There the mutation is
 * written in the caller's own scope, so the caller's direct-write scan finds it whatever
 * the argument walk does. Here the write is in the callee, through the value the method
 * returns, which is the same position the accessor defect occupied.
 *
 * @param row - Row the callee writes after calling the supplied method.
 *
 * @example
 * ```ts
 * methodReturnPackagedEffect({ label: '' });
 * ```
 */
export function methodReturnPackagedEffect(row: LabelledRow,): void {
  callThroughMethodResult({
    get(): LabelledRow {
      return row;
    },
  },);
}

/**
 * Packages a parameter behind an arrow function held in an ordinary property.
 *
 * Third form of the same shape. Here the property does have a value the walk reads, but
 * that value is a callable whose body is what reaches the parameter, so reading the
 * property value alone still finds no origin.
 *
 * @param row - Row the callee writes after calling the supplied function.
 *
 * @example
 * ```ts
 * arrowReturnPackagedEffect({ label: '' });
 * ```
 */
export function arrowReturnPackagedEffect(row: LabelledRow,): void {
  callThroughMethodResult({
    get: (): LabelledRow => {
      return row;
    },
  },);
}

/**
 * Holder returned by the shorthand and explicit packaging pair.
 */
export type PackagedRow = {
  /**
   * Row the holder was built around.
   */
  readonly held: LabelledRow;
};

/**
 * Packages a parameter into a returned literal written in shorthand form.
 *
 * The shorthand name resolves to the property rather than to the local it reads, so the
 * provenance walk asked the checker for the wrong symbol and recorded no returned origin.
 * Its sibling `packageRowExplicit` writes the identical literal in longhand and recorded
 * one, which is how the two are kept together: they must agree.
 *
 * @param held - Row the returned holder carries.
 *
 * @returns holder carrying the row it was given.
 *
 * @example
 * ```ts
 * packageRowShorthand({ label: '' });
 * ```
 */
export function packageRowShorthand(held: LabelledRow,): PackagedRow {
  return { held, };
}

/**
 * Packages a parameter into a returned literal written in longhand form.
 *
 * @param held - Row the returned holder carries.
 *
 * @returns holder carrying the row it was given.
 *
 * @example
 * ```ts
 * packageRowExplicit({ label: '' });
 * ```
 */
export function packageRowExplicit(held: LabelledRow,): PackagedRow {
  return { held: held, };
}

/**
 * Writes through a holder packaged in shorthand form.
 *
 * The write lands on the caller's own row, reached through the returned holder. Without the
 * shorthand value symbol the callee returned no origin, this write was attributed to
 * nothing, and the parameter it mutates kept its read-only offer while
 * `explicitPackagedWriteEffect` reported the identical write.
 *
 * @param row - Row this writes through the returned holder.
 *
 * @mutates row - Writes the label through a returned shorthand holder.
 *
 * @example
 * ```ts
 * shorthandPackagedWriteEffect({ label: '' });
 * ```
 */
export function shorthandPackagedWriteEffect(row: LabelledRow,): void {
  /**
   * Holder carrying the caller's row.
   */
  const packaged = packageRowShorthand(row,);
  packaged.held
    .label = 'written';
}

/**
 * Writes through a holder packaged in longhand form.
 *
 * The control for `shorthandPackagedWriteEffect`, identical in every respect except how the
 * callee wrote its literal.
 *
 * @param row - Row this writes through the returned holder.
 *
 * @mutates row - Writes the label through a returned longhand holder.
 *
 * @example
 * ```ts
 * explicitPackagedWriteEffect({ label: '' });
 * ```
 */
export function explicitPackagedWriteEffect(row: LabelledRow,): void {
  /**
   * Holder carrying the caller's row.
   */
  const packaged = packageRowExplicit(row,);
  packaged.held
    .label = 'written';
}

/**
 * Row whose every reachable property is readonly, so it draws no offer of its own.
 */
export type SealedRow = {
  /**
   * Label this fixture reads and never writes.
   */
  readonly label: string;
};

/**
 * Packages a primitive read into a freshly allocated object.
 *
 * The returned object holds one string and shares no identity with the parameter, so a
 * caller can reach nothing through it. The walk reached the parameter anyway, because
 * `expressionRoot` strips the property access back to the receiver, which answers what was
 * read rather than what can be reached. That made this indistinguishable from
 * `packageRowShorthand`, which does hand the row back, and the whole result-provenance
 * decision rests on telling those two apart.
 *
 * Its parameter is deeply readonly so the case pins the returned origin alone and adds no
 * diagnostic to the sibling count.
 *
 * @param row - Row this reads one primitive from.
 *
 * @returns freshly allocated holder carrying no caller identity.
 *
 * @example
 * ```ts
 * packageCountFresh({ label: '' });
 * ```
 */
export function packageCountFresh(row: SealedRow,): { readonly named: string; } {
  return { named: row.label, };
}

/**
 * Writes an element of a fresh container built from the parameter.
 *
 * `slice` hands back a new array holding the receiver's own rows, so this write lands on
 * the caller's row. Nothing attributes it today, and nothing has to: `slice` is
 * undischarged, so the parameter is opaque and no offer is made. The element facet is what
 * turns the opacity into an attribution, and until it exists this case records which of the
 * two is carrying the parameter.
 *
 * @param rows - Rows whose element this writes through a copy.
 *
 * @mutates rows - Writes a row reached through a fresh container.
 *
 * @example
 * ```ts
 * containerElementWriteEffect([{ label: '' }]);
 * ```
 */
export function containerElementWriteEffect(rows: LabelledRow[],): void {
  /**
   * Fresh array holding the caller's own rows.
   */
  const copy = rows.slice();
  /**
   * First row of the copy, which is the caller's row.
   */
  const first = copy[0];
  if (first !== undefined)
    first.label = 'written';
}

/**
 * Grows a fresh container built from the parameter.
 *
 * The opposite answer about the same value, and the reason the facet cannot be one set: the
 * push reaches the copy and nothing the caller shared, so `rows` must never be recorded as
 * mutated here however the element write above is attributed.
 *
 * @param rows - Rows this copies and does not write.
 *
 * @param fresh - Row appended to the copy.
 *
 * @example
 * ```ts
 * containerGrowthEffect([{ label: '' }], { label: '' });
 * ```
 */
export function containerGrowthEffect(
  rows: LabelledRow[],
  fresh: LabelledRow,
): void {
  /**
   * Fresh array holding the caller's own rows.
   */
  const copy = rows.slice();
  copy.push(fresh,);
}

/**
 * Writes an element of a fresh container bound by an array pattern.
 *
 * The second element-step spelling, and the first that writes no element access. A pattern
 * binds elements, so it asks the element question; an object pattern beside it keeps asking
 * the value question, because a container's properties are its own rather than its elements.
 *
 * @param rows - Rows whose element this writes through a destructured copy.
 *
 * @mutates rows - Writes a row bound out of a fresh container by pattern.
 *
 * @example
 * ```ts
 * destructuredContainerWriteEffect([{ label: '' }]);
 * ```
 */
export function destructuredContainerWriteEffect(rows: LabelledRow[],): void {
  /**
   * Fresh array holding the caller's own rows.
   */
  const copy = rows.slice();
  /**
   * First row, bound by a pattern rather than by an element access.
   */
  const [first,] = copy;
  if (first !== undefined)
    first.label = 'written';
}

/**
 * Writes every element of a fresh container reached by iteration.
 *
 * The third spelling. Iteration advances an iterator through no element access and no call
 * this walk can inspect, which is why the element question is asked of the iterated
 * expression rather than derived from its syntax.
 *
 * @param rows - Rows this writes through an iterated copy.
 *
 * @mutates rows - Writes rows reached by iterating a fresh container.
 *
 * @example
 * ```ts
 * iteratedContainerWriteEffect([{ label: '' }]);
 * ```
 */
export function iteratedContainerWriteEffect(rows: LabelledRow[],): void {
  /**
   * Fresh array holding the caller's own rows.
   */
  const copy = rows.slice();
  for (const row of copy) {
    row.label = 'written';
  }
}

/**
 * Writes an element of a container built by spreading another container.
 *
 * The fourth spelling, and the one that stacks two element steps: the spread carries the
 * receiver's rows into a new array, and the access takes one back out.
 *
 * @param rows - Rows this writes through a spread copy.
 *
 * @mutates rows - Writes a row reached through a spread of a fresh container.
 *
 * @example
 * ```ts
 * spreadContainerWriteEffect([{ label: '' }]);
 * ```
 */
export function spreadContainerWriteEffect(rows: LabelledRow[],): void {
  /**
   * Fresh array built by spreading another fresh array.
   */
  const copy = [...rows.slice(),];
  /**
   * First row of the spread copy, which is the caller's row.
   */
  const first = copy[0];
  if (first !== undefined)
    first.label = 'written';
}

/**
 * Writes an element of a filtered container built from the parameter.
 *
 * The same shape as `containerElementWriteEffect` through the other member carrying the
 * container relation, so neither member's behaviour rests on the other's case.
 *
 * @param rows - Rows whose element this writes through a filtered copy.
 *
 * @mutates rows - Writes a row reached through a filtered container.
 *
 * @example
 * ```ts
 * filteredElementWriteEffect([{ label: '' }]);
 * ```
 */
export function filteredElementWriteEffect(rows: LabelledRow[],): void {
  /**
   * Filtered array holding the caller's own rows.
   */
  const kept = rows.filter(function keepsEvery(): boolean {
    return true;
  },);
  /**
   * First row of the filtered copy, which is the caller's row.
   */
  const first = kept[0];
  if (first !== undefined)
    first.label = 'written';
}

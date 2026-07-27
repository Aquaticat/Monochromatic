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

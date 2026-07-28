/**
 * Caller-side property matching, and every shape that has to defeat it.
 *
 * Each caller takes rows and hands them to a callee that writes through exactly one destructured
 * property. Narrowing works when the summary names only the parameters the callee can really
 * reach. The rest are shapes where narrowing would drop one, and each has to keep naming every
 * parameter a write could reach: usually both, but `prototypeKeyBroadcast` names one because only
 * one is reachable there, and the rest-index callers name what their arity allows. The expected
 * set is stated per shape in `effect-argument-properties.unit.test.ts`, never derived from a rule
 * about counts.
 *
 * @module
 */

/**
 * Row a callee can write through.
 */
export type LabelledRow = {
  label: string;
};

/**
 * Writes one destructured property and only reads the other.
 *
 * @param named - Row this writes.
 *
 * @param spare - Row this only reads.
 *
 * @mutates named - Assigns one label.
 *
 * @example
 * ```ts
 * writeNamedOnly({ named: { label: '' }, spare: { label: '' } });
 * ```
 */
function writeNamedOnly({
  named,
  spare,
}: {
  named: LabelledRow;
  spare: LabelledRow;
},): void {
  if (spare.label === '')
    named.label = 'written';
}

/**
 * Writes through a renamed destructured property.
 *
 * @param named - Row this writes, bound under another name.
 *
 * @param spare - Row this only reads.
 *
 * @mutates named - Assigns one label.
 *
 * @example
 * ```ts
 * writeRenamedOnly({ named: { label: '' }, spare: { label: '' } });
 * ```
 */
function writeRenamedOnly({
  named: bound,
  spare,
}: {
  named: LabelledRow;
  spare: LabelledRow;
},): void {
  if (spare.label === '')
    bound.label = 'written';
}

/**
 * Writes through a numerically keyed destructured property.
 *
 * @param one - Row this writes, keyed by a number.
 *
 * @param two - Row this only reads, keyed by a number.
 *
 * @mutates one - Assigns one label.
 *
 * @example
 * ```ts
 * writeNumericKeyOnly({ 1: { label: '' }, 2: { label: '' } });
 * ```
 */
function writeNumericKeyOnly({
  1: one,
  2: two,
}: {
  1: LabelledRow;
  2: LabelledRow;
},): void {
  if (two.label === '')
    one.label = 'written';
}

/**
 * Writes one level below a destructured property.
 *
 * @param named - Wrapper whose row this writes.
 *
 * @param spare - Row this only reads.
 *
 * @mutates named - Assigns one label below the wrapper.
 *
 * @example
 * ```ts
 * writeNestedOnly({ named: { deeper: { label: '' } }, spare: { label: '' } });
 * ```
 */
function writeNestedOnly({
  named,
  spare,
}: {
  named: { deeper: LabelledRow; };
  spare: LabelledRow;
},): void {
  if (spare.label === '')
    named.deeper
      .label = 'written';
}

/**
 * Writes through the row a destructured callable returns.
 *
 * @param named - Callable returning the row this writes.
 *
 * @param spare - Row this only reads.
 *
 * @mutates named - Assigns one label on what it returns.
 *
 * @example
 * ```ts
 * writeCallResultOnly({ named: () => ({ label: '' }), spare: { label: '' } });
 * ```
 */
function writeCallResultOnly({
  named,
  spare,
}: {
  named: () => LabelledRow;
  spare: LabelledRow;
},): void {
  if (spare.label === '')
    named()
      .label = 'written';
}

/**
 * Writes through the first element of a destructured rest array.
 *
 * @param box - Wrapper at rest index zero, whose row this writes.
 *
 * @mutates box - Assigns one label inside the first supplied wrapper.
 *
 * @example
 * ```ts
 * writeThroughRestIndex({ named: { label: '' } });
 * ```
 */
function writeThroughRestIndex(...{ 0: box }: readonly { named: LabelledRow; }[]): void {
  box.named
    .label = 'written';
}

//region Narrowing has to work

/**
 * Hands each row to the property the callee names.
 *
 * The acceptance shape. Only `first` is written, so only `first` may be named.
 *
 * @param first - Row the callee writes.
 *
 * @param second - Row the callee only reads.
 *
 * @example
 * ```ts
 * plainKeyNarrowing({ label: '' }, { label: '' });
 * ```
 */
export function plainKeyNarrowing(
  first: LabelledRow,
  second: LabelledRow,
): void {
  writeNamedOnly({
    named: first,
    spare: second,
  },);
}

/**
 * Hands each row over through shorthand properties.
 *
 * @param named - Row the callee writes.
 *
 * @param spare - Row the callee only reads.
 *
 * @example
 * ```ts
 * shorthandKeyNarrowing({ label: '' }, { label: '' });
 * ```
 */
export function shorthandKeyNarrowing(
  named: LabelledRow,
  spare: LabelledRow,
): void {
  writeNamedOnly({
    named,
    spare,
  },);
}

/**
 * Quotes the keys the callee reads unquoted.
 *
 * @param first - Row the callee writes.
 *
 * @param second - Row the callee only reads.
 *
 * @example
 * ```ts
 * quotedKeyNarrowing({ label: '' }, { label: '' });
 * ```
 */
export function quotedKeyNarrowing(
  first: LabelledRow,
  second: LabelledRow,
): void {
  writeNamedOnly({
    'named': first,
    'spare': second,
  },);
}

/**
 * Hands a row to a callee that binds the property under another name.
 *
 * @param first - Row the callee writes.
 *
 * @param second - Row the callee only reads.
 *
 * @example
 * ```ts
 * renamedKeyNarrowing({ label: '' }, { label: '' });
 * ```
 */
export function renamedKeyNarrowing(
  first: LabelledRow,
  second: LabelledRow,
): void {
  writeRenamedOnly({
    named: first,
    spare: second,
  },);
}

/**
 * Spells one numeric key differently from the callee.
 *
 * `1e0` and `1` name the same runtime property, so the write has to reach `first` alone. A
 * canonical key that kept the source spelling would read them as different keys, decide the
 * caller fills neither, and attribute the write to nothing.
 *
 * @param first - Row the callee writes.
 *
 * @param second - Row the callee only reads.
 *
 * @example
 * ```ts
 * numericKeyNarrowing({ label: '' }, { label: '' });
 * ```
 */
export function numericKeyNarrowing(
  first: LabelledRow,
  second: LabelledRow,
): void {
  writeNumericKeyOnly({
    1e0: first,
    2: second,
  },);
}

/**
 * Packages a row one literal deeper than the property the callee names.
 *
 * @param first - Row the callee writes.
 *
 * @param second - Row the callee only reads.
 *
 * @example
 * ```ts
 * nestedValueNarrowing({ label: '' }, { label: '' });
 * ```
 */
export function nestedValueNarrowing(
  first: LabelledRow,
  second: LabelledRow,
): void {
  writeNestedOnly({
    named: { deeper: first, },
    spare: second,
  },);
}

/**
 * Returns a row from a method the callee calls.
 *
 * @param first - Row the method returns.
 *
 * @param second - Row the callee only reads.
 *
 * @example
 * ```ts
 * methodResultNarrowing({ label: '' }, { label: '' });
 * ```
 */
export function methodResultNarrowing(
  first: LabelledRow,
  second: LabelledRow,
): void {
  writeCallResultOnly({
    named(): LabelledRow {
      return first;
    },
    spare: second,
  },);
}

/**
 * Puts a spread before the key that shadows it.
 *
 * The later exact key wins at runtime, so only `first` may be named.
 *
 * @param first - Row the callee writes.
 *
 * @param second - Row the spread carries, which the exact key shadows.
 *
 * @example
 * ```ts
 * spreadBeforeKeyNarrowing({ label: '' }, { label: '' });
 * ```
 */
export function spreadBeforeKeyNarrowing(
  first: LabelledRow,
  second: LabelledRow,
): void {
  writeNamedOnly({
    ...{
      named: second,
      spare: second,
    },
    named: first,
  },);
}

//endregion

//region Narrowing has to be withheld

/**
 * Puts a spread of unknown shape after the key it can overwrite.
 *
 * Both rows are genuinely reachable rather than conservatively named. The spread carries one
 * computed key, so `named` holds `first` unless that key resolves to `named`, in which case it
 * holds `second`. A spread of a literal naming `named` outright would make `first` unreachable
 * and turn this into a test of conservatism instead of reachability.
 *
 * @param first - Row named by the exact key.
 *
 * @param second - Row the spread may substitute.
 *
 * @param key - Property name resolved at runtime.
 *
 * @example
 * ```ts
 * spreadAfterKeyBroadcast({ label: '' }, { label: '' }, 'named');
 * ```
 */
export function spreadAfterKeyBroadcast(
  first: LabelledRow,
  second: LabelledRow,
  key: string,
): void {
  writeNamedOnly({
    named: first,
    spare: first,
    ...{ [key]: second, },
  } as { named: LabelledRow; spare: LabelledRow; },);
}

/**
 * Serves the callee's property from a prototype accessor that reads a sibling.
 *
 * The outer literal defines no own `named`. The inherited getter runs with the outer literal as
 * its receiver, so `this.hidden` is `first`, and the callee writes through it. Nothing about that
 * is visible in the getter body, which names no caller binding at all, and `hidden` is a
 * different known key that a walk looking for `named` would skip. A literal that sets a prototype
 * therefore cannot be decomposed at all.
 *
 * This is the shape that separates a sound rule from a plausible one, measured three ways.
 * Reading `__proto__` as an ordinary key reports no written parameter here and none for
 * `prototypeKeyBroadcast` either. Reading it as a wildcard carrying the origins found inside the
 * prototype fixes `prototypeKeyBroadcast` and still reports none here, because the origin this
 * reaches is not inside the prototype at all. Refusing to decompose reports both. Only the last
 * one avoids offering `readonly` for a row the callee mutates.
 *
 * @param first - Row the inherited getter reaches through its receiver.
 *
 * @param second - Row under a key the callee only reads.
 *
 * @example
 * ```ts
 * inheritedAccessorBroadcast({ label: '' }, { label: '' });
 * ```
 */
export function inheritedAccessorBroadcast(
  first: LabelledRow,
  second: LabelledRow,
): void {
  writeNamedOnly({
    __proto__: {
      get named(): LabelledRow {
        return (this as unknown as { hidden: LabelledRow; }).hidden;
      },
    },
    hidden: first,
    spare: second,
  } as unknown as { named: LabelledRow; spare: LabelledRow; },);
}

/**
 * Fills a property under a key no static walk can read.
 *
 * @param first - Row named by the exact key.
 *
 * @param second - Row behind the computed key.
 *
 * @param key - Property name resolved at runtime.
 *
 * @example
 * ```ts
 * computedKeyBroadcast({ label: '' }, { label: '' }, 'named');
 * ```
 */
export function computedKeyBroadcast(
  first: LabelledRow,
  second: LabelledRow,
  key: string,
): void {
  writeNamedOnly({
    named: first,
    spare: first,
    [key]: second,
  } as { named: LabelledRow; spare: LabelledRow; },);
}

/**
 * Serves the callee's property from an explicit prototype.
 *
 * The literal defines no own `named`, and the callee still writes through `second`. Treating
 * `__proto__` as an ordinary key attributes that write to nothing: measured that way, this
 * reported no written parameter at all.
 *
 * `second` alone is the reachable answer, and this names both, because a literal that sets a
 * prototype is not decomposed. `inheritedAccessorBroadcast` is why.
 *
 * @param first - Row placed under an ordinary key.
 *
 * @param second - Row reachable only through the prototype.
 *
 * @example
 * ```ts
 * prototypeKeyBroadcast({ label: '' }, { label: '' });
 * ```
 */
export function prototypeKeyBroadcast(
  first: LabelledRow,
  second: LabelledRow,
): void {
  writeNamedOnly({
    __proto__: { named: second, },
    spare: first,
  } as unknown as { named: LabelledRow; spare: LabelledRow; },);
}

/**
 * Defines the callee's property through an accessor pair.
 *
 * The setter comes last and carries no origin, so a walk that stops at the first exact match
 * from the end would drop the getter's row.
 *
 * @param first - Row the getter returns.
 *
 * @param second - Row under an ordinary key.
 *
 * @example
 * ```ts
 * accessorKeyBroadcast({ label: '' }, { label: '' });
 * ```
 */
export function accessorKeyBroadcast(
  first: LabelledRow,
  second: LabelledRow,
): void {
  writeNamedOnly({
    get named(): LabelledRow {
      return first;
    },
    set named(value: LabelledRow,) {
      if (value.label === '')
        return;
    },
    spare: second,
  },);
}

/**
 * Reaches the callee's property through `this` rather than through its own value.
 *
 * @param first - Row the getter reaches through `this`.
 *
 * @param second - Row under an ordinary key.
 *
 * @example
 * ```ts
 * thisAccessorBroadcast({ label: '' }, { label: '' });
 * ```
 */
export function thisAccessorBroadcast(
  first: LabelledRow,
  second: LabelledRow,
): void {
  writeNamedOnly({
    spare: second,
    hidden: first,
    get named(): LabelledRow {
      return this.hidden;
    },
  } as unknown as { named: LabelledRow; spare: LabelledRow; },);
}

/**
 * Hands one literal to a rest formal that destructures it by index.
 *
 * The rest formal's key `0` names an array index, not a property of the literal, so resolving
 * that key against the literal finds nothing. Catches the empty result, which is the dangerous
 * one.
 *
 * @param first - Row the callee writes.
 *
 * @example
 * ```ts
 * restIndexBroadcast({ label: '' });
 * ```
 */
export function restIndexBroadcast(first: LabelledRow,): void {
  writeThroughRestIndex({ named: first, },);
}

/**
 * Hands two literals to a rest formal that destructures it by index.
 *
 * Catches what the single-literal shape cannot: whether every actual reaching a rest formal
 * contributes to its property slots, rather than only the one whose position matches. The callee
 * writes through rest index `0`, so naming the second row as well is the conservatism the rule
 * states; naming only the second would be the inversion this shape exists to rule out.
 *
 * @param first - Row at rest index zero, which the callee writes.
 *
 * @param second - Row at rest index one.
 *
 * @example
 * ```ts
 * restIndexSpreadBroadcast({ label: '' }, { label: '' });
 * ```
 */
export function restIndexSpreadBroadcast(
  first: LabelledRow,
  second: LabelledRow,
): void {
  writeThroughRestIndex(
    { named: first, },
    { named: second, },
  );
}

//endregion

/**
 * Packages both rows into a local before handing it over.
 *
 * The literal is written once and named once, so every write the callee performs through it
 * reaches whichever row that property holds. Nothing about that is visible if the local carries
 * no origins at all, which is what a provenance walk with no case for an aggregate literal
 * produces: the callee's write is attributed to nothing and both rows are offered read-only.
 *
 * The actual is an identifier rather than a literal, so the edge cannot decompose it and both
 * rows stay named. Recovering `first` alone needs the local's own property structure, which is
 * a separate question from carrying its origins at all.
 *
 * @param first - Row the callee writes.
 *
 * @param second - Row the callee only reads.
 *
 * @example
 * ```ts
 * localLiteralProvenance({ label: '' }, { label: '' });
 * ```
 */
export function localLiteralProvenance(
  first: LabelledRow,
  second: LabelledRow,
): void {
  /**
   * Both rows packaged under the keys the callee destructures.
   */
  const packaged = {
    named: first,
    spare: second,
  };
  writeNamedOnly(packaged,);
}

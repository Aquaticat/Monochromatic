/**
 * Caller-side property matching, and every shape that has to defeat it.
 *
 * Each caller takes two rows and hands them to a callee that writes through exactly one
 * destructured property. Narrowing works when the summary names only the parameter the callee
 * really writes. The rest are shapes where narrowing would lose a write, and each has to keep
 * naming both parameters.
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
 * Puts a spread after the key it can overwrite.
 *
 * The spread runs later, so it can supply `named` too, and both rows stay named.
 *
 * @param first - Row named by the exact key.
 *
 * @param second - Row the spread carries.
 *
 * @example
 * ```ts
 * spreadAfterKeyBroadcast({ label: '' }, { label: '' });
 * ```
 */
export function spreadAfterKeyBroadcast(
  first: LabelledRow,
  second: LabelledRow,
): void {
  writeNamedOnly({
    named: first,
    ...{
      named: second,
      spare: second,
    },
  },);
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
 * `__proto__` as an ordinary key would attribute that write to nothing.
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
 * Hands a literal to a rest formal that destructures it by index.
 *
 * The rest formal's key `0` names an array index, not a property of the literal, so the write
 * through it has to keep naming the row.
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

//endregion

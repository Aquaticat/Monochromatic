/**
 * Parameter shapes whose slot allocation is asserted directly.
 *
 * Every callable here is deeply readonly and reads only, so the rule reports nothing and the
 * fixture adds no findings to a workspace sweep. That matters: the slot work is verified by
 * comparing sweeps, and a fixture that contributed findings would move the number the
 * comparison depends on.
 *
 * @module
 */

/**
 * Row with no writable property.
 */
export type SlotRow = { readonly label: string; };

/**
 * Aggregate holding a row behind a named property.
 */
export type SlotOuter = { readonly outer: SlotRow; };

/**
 * Property key reached only through a computed name.
 */
export const SLOT_COMPUTED_KEY = 'computed';

/**
 * Takes one parameter naming its whole value.
 *
 * @param row - Row read by body.
 *
 * @returns read label.
 *
 * @example
 * ```ts
 * wholeIdentifierSlot({ label: '' });
 * ```
 */
export function wholeIdentifierSlot(row: SlotRow,): string {
  return row.label;
}

/**
 * Destructures two shorthand properties.
 *
 * @param named - First row read.
 *
 * @param unnamed - Second row read.
 *
 * @returns both labels joined.
 *
 * @example
 * ```ts
 * shorthandPropertySlots({ named: { label: '' }, unnamed: { label: '' } });
 * ```
 */
export function shorthandPropertySlots({
  named,
  unnamed,
}: {
  readonly named: SlotRow;
  readonly unnamed: SlotRow;
},): string {
  return `${named.label}${unnamed.label}`;
}

/**
 * Binds one property under a different local name.
 *
 * @param bound - Row read, bound from property `named`.
 *
 * @returns read label.
 *
 * @example
 * ```ts
 * renamedPropertySlot({ named: { label: '' } });
 * ```
 */
export function renamedPropertySlot({ named: bound, }: { readonly named: SlotRow; },): string {
  return bound.label;
}

/**
 * Destructures one property twice under two local names.
 *
 * @param first - Row read, bound from property `named`.
 *
 * @param second - Same row read again, bound from the same property.
 *
 * @returns both labels joined.
 *
 * @example
 * ```ts
 * duplicateKeySlots({ named: { label: '' } });
 * ```
 */
export function duplicateKeySlots({
  named: first,
  named: second,
}: {
  readonly named: SlotRow;
},): string {
  return `${first.label}${second.label}`;
}

/**
 * Destructures through a property into a nested pattern.
 *
 * @param inner - Row read, reached through property `outer`.
 *
 * @returns read label.
 *
 * @example
 * ```ts
 * nestedPatternSlot({ outer: { label: '' } });
 * ```
 */
export function nestedPatternSlot({ outer: { label: inner, }, }: SlotOuter,): string {
  return inner;
}

/**
 * Destructures one named property beside a rest element.
 *
 * @param named - Row read by name.
 *
 * @param rest - Remaining properties, which name no single key.
 *
 * @returns read label and remaining key count.
 *
 * @example
 * ```ts
 * restPropertySlots({ named: { label: '' }, other: { label: '' } });
 * ```
 */
export function restPropertySlots({
  named,
  ...rest
}: {
  readonly named: SlotRow;
  readonly other: SlotRow;
},): string {
  return `${named.label}${String(Object.keys(rest,).length,)}`;
}

/**
 * Destructures positional elements rather than properties.
 *
 * @param first - First element read.
 *
 * @param second - Second element read.
 *
 * @returns both labels joined.
 *
 * @example
 * ```ts
 * arrayPatternSlots([{ label: '' }, { label: '' }]);
 * ```
 */
export function arrayPatternSlots([first, second,]: readonly SlotRow[],): string {
  return `${first?.label ?? ''}${second?.label ?? ''}`;
}

/**
 * Destructures a property named only by a computed key.
 *
 * @param value - Row read, reached through a computed key.
 *
 * @returns read label.
 *
 * @example
 * ```ts
 * computedKeySlot({ computed: { label: '' } });
 * ```
 */
export function computedKeySlot(
  { [SLOT_COMPUTED_KEY]: value, }: { readonly [SLOT_COMPUTED_KEY]: SlotRow; },
): string {
  return value.label;
}

/**
 * Destructures a property whose key is written as a number.
 *
 * @param one - Row read, reached through numeric key `1`.
 *
 * @returns read label.
 *
 * @example
 * ```ts
 * numericKeySlots({ 1: { label: '' } });
 * ```
 */
export function numericKeySlots({ 1: one, }: { readonly 1: SlotRow; },): string {
  return one.label;
}

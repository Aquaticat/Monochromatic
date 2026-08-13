/**
 * Call-edge shapes where a written parameter could still be offered readonly.
 *
 * Each function here is a hypothesis about the positional call-edge model, kept in one
 * file so a single lint run says which of them the rule currently gets wrong. Any
 * `can be deeply readonly` offer in this file names a parameter some callee writes.
 *
 * @module
 */

/**
 * Row shape whose single property the rule can express as readonly.
 */
type Row = {
  label: string;
};

/**
 * Writes through a later element of a rest parameter.
 *
 * @param rows - Rest parameter whose second element is written.
 *
 * @mutates rows - Overwrites a label on the second element.
 *
 * @example
 * ```ts
 * mutateSecondRest({ label: '' }, { label: '' });
 * ```
 */
function mutateSecondRest(...rows: Row[]): void {
  rows[1]!.label = 'written';
}

/**
 * Passes a parameter as the second actual argument to a rest formal.
 *
 * The edge records one entry per syntactic argument while propagation reads it by formal
 * parameter index, so a rest formal collecting the second actual may never be consulted.
 *
 * @param row - Row the callee writes through its rest parameter.
 *
 * @example
 * ```ts
 * restEdgeEffect({ label: '' });
 * ```
 */
export function restEdgeEffect(row: Row,): void {
  mutateSecondRest({ label: 'fresh', }, row,);
}

/**
 * Writes its second parameter and leaves the first alone.
 *
 * @param first - Row the body does not write.
 *
 * @param second - Row the body writes.
 *
 * @mutates second - Overwrites recorded label.
 *
 * @example
 * ```ts
 * mutateSecond({ label: '' }, { label: '' });
 * ```
 */
function mutateSecond(first: Row, second: Row,): void {
  if (first.label === '')
    second.label = 'written';
}

/**
 * Spreads a tuple so one syntactic argument covers two formals.
 *
 * @param row - Row the callee writes at formal index one.
 *
 * @example
 * ```ts
 * spreadEdgeEffect({ label: '' });
 * ```
 */
export function spreadEdgeEffect(row: Row,): void {
  mutateSecond(...[
    { label: 'fresh', },
    row,
  ] as [Row, Row,],);
}

/**
 * Writes its own parameter and also writes through a method that parameter holds.
 *
 * @param box - Container written directly and called for a row also written.
 *
 * @mutates box - Increments marker and overwrites a label on the returned row.
 *
 * @example
 * ```ts
 * invokeAndTouch({ marker: 0, get: () => ({ label: '' }) });
 * ```
 */
function invokeAndTouch(box: {
  marker: number;
  get(): Row;
},): void {
  box.marker += 1;
  box.get()
    .label = 'written';
}

/**
 * Packages a parameter behind a method beside a directly written sibling.
 *
 * @param row - Row the callee writes through the supplied method.
 *
 * @example
 * ```ts
 * mixedMethodEffect({ label: '' });
 * ```
 */
export function mixedMethodEffect(row: Row,): void {
  invokeAndTouch({
    marker: 0,
    get(): Row {
      return row;
    },
  },);
}

/**
 * Reads one property and writes nothing.
 *
 * @param box - Container whose property is read.
 *
 * @returns read value.
 *
 * @example
 * ```ts
 * readOnlyLookup({ value: 0 });
 * ```
 */
function readOnlyLookup(box: { readonly value: number; },): number {
  return box.value;
}

/**
 * Writes a parameter from inside a getter the callee triggers by reading.
 *
 * A property read is an implicit call, so the callee mutates without any call expression
 * naming the effect.
 *
 * @param row - Row written while the callee reads a property.
 *
 * @example
 * ```ts
 * getterBodyEffect({ label: '' });
 * ```
 */
export function getterBodyEffect(row: Row,): void {
  void readOnlyLookup({
    get value(): number {
      row.label = 'written';
      return 0;
    },
  },);
}

/**
 * Assigns its second parameter into a property of its first.
 *
 * @param slot - Container assigned into.
 *
 * @param value - Row stored in the container.
 *
 * @mutates slot - Stores supplied row.
 *
 * @example
 * ```ts
 * store({ value: { label: '' } }, { label: '' });
 * ```
 */
function store(slot: { value: Row; }, value: Row,): void {
  slot.value = value;
}

/**
 * Writes the assigned row from inside a setter the callee triggers by assigning.
 *
 * @param row - Row written by the setter it is assigned through.
 *
 * @example
 * ```ts
 * setterPairEffect({ label: '' });
 * ```
 */
export function setterPairEffect(row: Row,): void {
  /**
   * Row the getter hands back, never written.
   */
  const initial: Row = { label: 'initial', };
  store({
    get value(): Row {
      return initial;
    },
    set value(next: Row,) {
      next.label = 'written';
    },
  }, row,);
}

/**
 * Writes a parameter that defaults to an earlier parameter.
 *
 * @param primary - Row the default aliases.
 *
 * @param alias - Row written, defaulting to `primary`.
 *
 * @mutates alias - Overwrites recorded label.
 *
 * @example
 * ```ts
 * mutateDefaultAlias({ label: '' });
 * ```
 */
function mutateDefaultAlias(primary: Row, alias: Row = primary,): void {
  alias.label = 'written';
}

/**
 * Omits the argument whose default aliases the parameter it passes.
 *
 * @param row - Row reachable as the omitted parameter's default.
 *
 * @example
 * ```ts
 * defaultAliasEffect({ label: '' });
 * ```
 */
export function defaultAliasEffect(row: Row,): void {
  mutateDefaultAlias(row,);
}

/**
 * Writes its parameter.
 *
 * @param row - Row written.
 *
 * @mutates row - Overwrites recorded label.
 *
 * @example
 * ```ts
 * mutateRow({ label: '' });
 * ```
 */
function mutateRow(row: Row,): void {
  row.label = 'written';
}

/**
 * Reaches a mutating call from a parameter initializer rather than a body.
 *
 * @param row - Row written by the initializer of a later parameter.
 *
 * @param unused - Parameter whose initializer performs the write.
 *
 * @example
 * ```ts
 * defaultInitializerEffect({ label: '' });
 * ```
 */
export function defaultInitializerEffect(
  row: Row,
  unused: unknown = mutateRow(row,),
): void {
  void unused;
}

/**
 * Base handler whose method writes nothing.
 */
class Reader {
  /**
   * Accepts a row without writing it.
   *
   * @param row - Row left alone.
   *
   * @example
   * ```ts
   * new Reader().use({ label: '' });
   * ```
   */
  use(row: Row,): void {
    void row.label;
  }
}

/**
 * Derived handler whose override writes the row.
 */
class Writer extends Reader {
  /**
   * Writes the supplied row.
   *
   * @param row - Row written.
   *
   * @mutates row - Overwrites recorded label.
   *
   * @example
   * ```ts
   * new Writer().use({ label: '' });
   * ```
   */
  override use(row: Row,): void {
    row.label = 'written';
  }
}

/**
 * Handler whose declared type is the reading base and whose value writes.
 *
 * Exported so the writing override is reachable, which is what makes the dispatch
 * hazard concrete rather than hypothetical.
 *
 * @example
 * ```ts
 * polymorphicEffect(writingHandler, { label: '' });
 * ```
 */
export const writingHandler: Reader = new Writer();

/**
 * Calls a method that a subclass overrides with a writing implementation.
 *
 * @param handler - Handler whose runtime type may be the writing subclass.
 *
 * @param row - Row the override writes.
 *
 * @example
 * ```ts
 * polymorphicEffect(new Writer(), { label: '' });
 * ```
 */
export function polymorphicEffect(handler: Reader, row: Row,): void {
  handler.use(row,);
}

/**
 * Writes its row while declaring an explicit `this` parameter.
 *
 * @param row - Row written.
 *
 * @mutates row - Overwrites recorded label.
 *
 * @example
 * ```ts
 * mutateWithThis.call(undefined, { label: '' });
 * ```
 */
function mutateWithThis(this: void, row: Row,): void {
  row.label = 'written';
}

/**
 * Calls a callee whose first declared parameter is an explicit `this`.
 *
 * @param row - Row the callee writes at its first value parameter.
 *
 * @example
 * ```ts
 * explicitThisEffect({ label: '' });
 * ```
 */
export function explicitThisEffect(row: Row,): void {
  mutateWithThis(row,);
}

/**
 * Row carrying a method that writes its own receiver.
 */
class MutableRow {
  /**
   * Recorded label.
   */
  label = '';

  /**
   * Writes the receiver's own label.
   *
   * @example
   * ```ts
   * new MutableRow().write();
   * ```
   */
  write(): void {
    this.label = 'written';
  }
}

/**
 * Calls a zero-argument method that writes its receiver.
 *
 * @param row - Receiver the method writes, reachable through no argument position.
 *
 * @example
 * ```ts
 * receiverEffect(new MutableRow());
 * ```
 */
export function receiverEffect(row: MutableRow,): void {
  row.write();
}

/**
 * Writes through two nested properties of its parameter.
 *
 * @param box - Container whose nested row is written.
 *
 * @mutates box - Overwrites a label on the nested row.
 *
 * @example
 * ```ts
 * mutatePayload({ payload: { row: { label: '' } } });
 * ```
 */
function mutatePayload(box: { readonly payload: { readonly row: Row; }; },): void {
  box.payload
    .row
    .label = 'written';
}

/**
 * Names a parameter only through a shorthand property inside an accessor body.
 *
 * @param row - Row reachable only as an accessor-body shorthand.
 *
 * @example
 * ```ts
 * accessorShorthandEffect({ label: '' });
 * ```
 */
export function accessorShorthandEffect(row: Row,): void {
  mutatePayload({
    get payload(): { readonly row: Row; } {
      return { row, };
    },
  },);
}

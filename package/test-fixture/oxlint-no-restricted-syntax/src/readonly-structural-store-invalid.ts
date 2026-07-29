/**
 * Stores of structural parameter state into bindings the callable does not own.
 *
 * The array fixture beside this one cannot show what these cost. `readonly Row[]`
 * constrains structure and not elements, so storing an element and mutating it later
 * violates nothing that projection promised. `ReadonlyDeep<Config>` does constrain
 * elements, and `readonlyDeepSuggestions` rejects array and tuple parameter types
 * outright, so the two projections never meet on one parameter and only a structural
 * parameter can exhibit the false offer.
 *
 * Every callable here that stores must be reported. Every callable here that reads must
 * keep its offer, and those controls are the point: a classification wide enough to catch
 * the stores by looking at assignment alone would take the reads with them.
 *
 * @module
 */

/**
 * Mutable element shape.
 */
type Row = {
  label: string;
};

/**
 * Structural parameter shape, deliberately not an array type.
 */
type Config = {
  rows: Row[];
  row: Row;
};

/**
 * Binding declared outside every callable body, which nothing here can follow.
 */
let held: Row | undefined;

/**
 * Total that accumulates across calls without holding any caller state.
 */
let measured = 0;

/**
 * Stores an indexed element of a structural parameter into a module binding.
 *
 * Measured offered `ReadonlyDeep<Config>` before this was covered, and the applied
 * annotation type-checks clean while the caller's own `config.rows[0].label` changes
 * afterward through the escaped reference.
 *
 * @param config - Configuration whose first row escapes.
 *
 * @example
 * ```ts
 * storeElementIntoModuleBinding({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeElementIntoModuleBinding(config: Config,): void {
  held = config.rows[0];
}

/**
 * Stores a member result off a structural parameter into a module binding.
 *
 * The only one of these already covered, and covered incidentally: a verified member call
 * carries receiver opacity, and discharging that opacity is what runs the escape test at
 * all.
 *
 * @param config - Configuration whose first row escapes.
 *
 * @example
 * ```ts
 * storeMemberIntoModuleBinding({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeMemberIntoModuleBinding(config: Config,): void {
  held = config.rows
    .at(0,);
}

/**
 * Stores a plain property of a structural parameter into a module binding.
 *
 * No call anywhere, so nothing triggers escape analysis on the shape that needs it most.
 *
 * @param config - Configuration whose row escapes.
 *
 * @example
 * ```ts
 * storePropertyIntoModuleBinding({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storePropertyIntoModuleBinding(config: Config,): void {
  held = config.row;
}

/**
 * Stores a structural parameter's row into a module binding after an alias hop.
 *
 * @param config - Configuration whose row escapes.
 *
 * @example
 * ```ts
 * storeAliasedIntoModuleBinding({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeAliasedIntoModuleBinding(config: Config,): void {
  /**
   * Alias standing between the parameter read and the escaping store.
   */
  const alias = config.row;
  held = alias;
}

/**
 * Stores a structural parameter's row through a logical assignment.
 *
 * `||=` stores the reference exactly as `=` does whenever the target is absent, so the
 * operator breadth of any classification has to be decided rather than inherited.
 *
 * @param config - Configuration whose row escapes when nothing is stored yet.
 *
 * @example
 * ```ts
 * storeThroughLogicalAssignment({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeThroughLogicalAssignment(config: Config,): void {
  held ||= config.row;
}

/**
 * Stores a structural parameter's row through a nullish assignment.
 *
 * @param config - Configuration whose row escapes when nothing is stored yet.
 *
 * @example
 * ```ts
 * storeThroughNullishAssignment({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeThroughNullishAssignment(config: Config,): void {
  held ??= config.row;
}

/**
 * Stores a structural parameter's row through a conjunction assignment.
 *
 * @param config - Configuration whose row escapes when something is stored already.
 *
 * @example
 * ```ts
 * storeThroughAndAssignment({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeThroughAndAssignment(config: Config,): void {
  held &&= config.row;
}

/**
 * Stores an iteration binding of a structural parameter into a module binding.
 *
 * @param config - Configuration whose rows escape one at a time.
 *
 * @example
 * ```ts
 * storeIterationBinding({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeIterationBinding(config: Config,): void {
  for (const row of config.rows)
    held = row;
}

/**
 * Stores a structural parameter's row into a local of the enclosing callable.
 *
 * The nested callable does not own that local, and the enclosing callable outlives every
 * call to it, so this leaves the nested body exactly as a module binding does.
 *
 * @param config - Configuration whose row escapes the nested body.
 *
 * @returns label the nested callable stored, or empty when it never ran.
 *
 * @example
 * ```ts
 * storeIntoEnclosingLocal({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeIntoEnclosingLocal(config: Config,): string {
  /**
   * Local of the enclosing callable, written from the nested one.
   */
  let captured: Row | undefined;
  /**
   * Nested callable whose store leaves its own body.
   */
  function storeCaptured(): void {
    captured = config.row;
  }
  storeCaptured();
  return captured?.label ?? '';
}

/**
 * Assigns a structural parameter's row to another parameter.
 *
 * A parameter is local to the callable in every sense a reader would mean, and its
 * declaration nonetheless sits beside the body rather than inside it, so a containment
 * test answers no. This control exists to keep that over-narrowness from becoming a
 * report.
 *
 * @param config - Configuration whose row is copied.
 *
 * @param temporary - Parameter reused as scratch space.
 *
 * @returns label after the copy.
 *
 * @example
 * ```ts
 * assignIntoParameter({ rows: [], row: { label: '', }, }, { label: '', },);
 * ```
 */
export function assignIntoParameter(config: Config, temporary: Row,): string {
  temporary = config.row;
  return temporary.label;
}

/**
 * Assigns a structural parameter's row to a local declared inside the body.
 *
 * The value stays inside the callable, so this must keep its offer.
 *
 * @param config - Configuration whose row is read.
 *
 * @returns label read through the local.
 *
 * @example
 * ```ts
 * assignIntoOwnLocal({ rows: [], row: { label: '', }, },);
 * ```
 */
export function assignIntoOwnLocal(config: Config,): string {
  /**
   * Local the callable itself declares.
   */
  let owned: Row | undefined;
  owned = config.row;
  return owned.label;
}

/**
 * Accumulates a count derived from a structural parameter into a module binding.
 *
 * A primitive carries no caller-owned identity, so storing one beyond the callable grants
 * nothing and must keep its offer.
 *
 * @param config - Configuration whose row count is measured.
 *
 * @example
 * ```ts
 * countIntoModuleBinding({ rows: [], row: { label: '', }, },);
 * ```
 */
export function countIntoModuleBinding(config: Config,): void {
  measured += config.rows
    .length;
}

/**
 * Reads a structural parameter in place without binding anything.
 *
 * @param config - Configuration whose label is measured.
 *
 * @returns label length.
 *
 * @example
 * ```ts
 * readStructureInPlace({ rows: [], row: { label: '', }, },);
 * ```
 */
export function readStructureInPlace(config: Config,): number {
  return config.row
    .label
    .length;
}

/**
 * Iterates a structural parameter's rows while reading only primitives.
 *
 * @param config - Configuration whose labels are measured.
 *
 * @returns combined label length.
 *
 * @example
 * ```ts
 * iterateStructureRows({ rows: [], row: { label: '', }, },);
 * ```
 */
export function iterateStructureRows(config: Config,): number {
  /**
   * Running total over every row label.
   */
  const total = { value: 0, };
  for (const row of config.rows)
    total.value += row.label
      .length;
  return total.value;
}

/**
 * Returns a structural parameter's row, which the recorded policy calls benign.
 *
 * The caller already holds `config`, so handing back a piece of it grants no capability
 * it lacked. What makes that sound is the caller keeping track of the result, which is
 * what `storeThroughOwnedCall` then fails to do.
 *
 * @param config - Configuration whose row is handed back.
 *
 * @returns row belonging to caller.
 *
 * @example
 * ```ts
 * firstRow({ rows: [], row: { label: '', }, },);
 * ```
 */
export function firstRow(config: Config,): Row {
  return config.row;
}

/**
 * Stores a structural parameter's row laundered through an owned call.
 *
 * The one store here that no assignment-site classification can catch on its own.
 * `expressionOrigins` of the right side cannot substitute another owned callable's
 * returned slots, because a callee's summary does not exist while its callers are
 * scanned, so the store sees a call result with no origins and records nothing.
 * Closing it needs the deferred result relation rather than a wider assignment test.
 *
 * @param config - Configuration whose row escapes through the callee.
 *
 * @example
 * ```ts
 * storeThroughOwnedCall({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeThroughOwnedCall(config: Config,): void {
  held = firstRow(config,);
}

/**
 * Stores a fresh object built from a structural parameter's primitive.
 *
 * The control against reading the whole right side for whether it can carry state. The
 * literal is a mutable object, and the origin walk reaches `config` through the property
 * read that fills it, so a classification gated on the right side alone reports here. No
 * caller-owned object was retained: the label is a string, and the object holding it was
 * allocated by this callable.
 *
 * @param config - Configuration whose label is copied.
 *
 * @example
 * ```ts
 * storeFreshAggregate({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeFreshAggregate(config: Config,): void {
  held = { label: config.row
    .label, };
}

/**
 * Reports what the module bindings hold, so no store above is dead.
 *
 * @returns stored label and accumulated count.
 *
 * @example
 * ```ts
 * storedState();
 * ```
 */
export function storedState(): string {
  return `${held?.label ?? ''}:${String(measured,)}`;
}

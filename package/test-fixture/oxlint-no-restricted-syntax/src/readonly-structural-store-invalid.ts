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
 * Control, and it took a wrong explanation to see why. The store leaves the nested body,
 * which is what first read as an escape, but the callable being summarised is the
 * enclosing one and `captured` is its own per-invocation local. It dies when the call
 * returns and nothing outside can reach `config.row` through it, so withholding nothing is
 * correct rather than a gap. `storeFromNestedIntoModuleBinding` is the paired shape that
 * proves nesting is not what silences this one.
 *
 * @param config - Configuration whose row reaches a local of this callable.
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
   * Nested callable whose store stays inside the enclosing callable.
   */
  function storeCaptured(): void {
    captured = config.row;
  }
  storeCaptured();
  return captured?.label ?? '';
}

/**
 * Stores a structural parameter's row into a module binding from a nested callable.
 *
 * Paired with `storeIntoEnclosingLocal` to separate two explanations of why that one
 * reports nothing. Same nesting, same invocation, and only the target moves outside the
 * enclosing body. Reporting here proves the scan does see a nested body's origins and its
 * enclosing container together, so the silence next door is about the target rather than
 * about the nesting.
 *
 * @param config - Configuration whose row escapes past every callable involved.
 *
 * @example
 * ```ts
 * storeFromNestedIntoModuleBinding({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeFromNestedIntoModuleBinding(config: Config,): void {
  /**
   * Nested callable whose store leaves the enclosing callable too.
   */
  function storeCaptured(): void {
    held = config.row;
  }
  storeCaptured();
}

/**
 * Declares but never runs a nested callable that would store past every callable.
 *
 * Control for the activation half of the pair. A nested callable nothing invokes and
 * nothing hands outward contributes no effect, so the escaping syntax alone must not
 * report. Without this, `storeFromNestedIntoModuleBinding` would be satisfied by a scan
 * that ignored activation entirely.
 *
 * @param config - Configuration whose row is named but never stored.
 *
 * @example
 * ```ts
 * storeFromInertNested({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeFromInertNested(config: Config,): void {
  /**
   * Nested callable nothing invokes and nothing hands outward.
   */
  function storeCaptured(): void {
    held = config.row;
  }
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
 * Builds a fresh row, sharing no identity with its argument.
 *
 * Written in the local-and-conditional shape rather than as an object literal reading a
 * parameter property. A fresh literal whose only property is a copied primitive is still
 * recorded as returning parameter state, so a control written that way carries an origin
 * and discriminates nothing. Measured, not assumed.
 *
 * @param config - Configuration read to decide the fresh label.
 *
 * @returns newly allocated row.
 *
 * @example
 * ```ts
 * freshRow({ rows: [], row: { label: '', }, },);
 * ```
 */
export function freshRow(config: Config,): Row {
  /**
   * Row this callable allocates and owns.
   */
  const fresh: Row = { label: 'fresh', };
  if (config.row
    .label
    .length
    === 0)
    fresh.label = 'empty';
  return fresh;
}

/**
 * Stores a structural parameter's row laundered through an owned call.
 *
 * The one store here that no assignment-site classification can catch on its own.
 * `expressionOrigins` of the right side cannot substitute another owned callable's
 * returned slots, because a callee's summary does not exist while its callers are
 * scanned, so the store saw a call result with no origins and recorded nothing.
 *
 * That was a false offer, not a precision gap, and it was falsified rather than argued.
 * The rule offered `ReadonlyDeep` to this parameter and to `firstRow`'s, applying both
 * type-checked under TypeScript 7.0.2, and a later write through the stored value changed
 * the caller's row.
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
 * Stores a freshly allocated row laundered through an owned call.
 *
 * The control for the shape above, and the reason the deferred retention is an
 * attribution rather than a blanket withholding of every store whose right side is a
 * call. `freshRow` returns nothing the caller owns, so its returned set is empty and
 * substitution has nothing to hand over.
 *
 * @param config - Configuration read to seed a fresh row.
 *
 * @example
 * ```ts
 * storeFreshThroughOwnedCall({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeFreshThroughOwnedCall(config: Config,): void {
  held = freshRow(config,);
}

/**
 * Stores a returned piece of caller state after holding it in a local.
 *
 * A local between the call and the store hides the call from `parameterIndexes` exactly as
 * it hides one from the write walk, and the same binding record closes both.
 *
 * @param config - Configuration whose row escapes through a local.
 *
 * @example
 * ```ts
 * storeHeldResult({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeHeldResult(config: Config,): void {
  /**
   * Row this callable holds after the call handed it back.
   */
  const local = firstRow(config,);
  held = local;
}

/**
 * Stores a freshly allocated row after holding it in a local.
 *
 * The control for the shape above.
 *
 * @param config - Configuration read to seed a fresh row.
 *
 * @example
 * ```ts
 * storeHeldFresh({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeHeldFresh(config: Config,): void {
  /**
   * Row this callable owns, allocated by the callee.
   */
  const local = freshRow(config,);
  held = local;
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

/**
 * Mutates a caller-owned object copied into an object rest but absent from its type.
 *
 * The case that decides whether a rest may be discharged from type members at all. A
 * TypeScript object type states which members a value must have, never which members it
 * may have besides, so a value assignable to `{ label: string; count: number; }` can
 * carry an `inner` reference the annotation never mentions. Object rest copies own
 * enumerable properties at runtime rather than declared ones, so that reference lands in
 * the rest, and the `in` checks below narrow to it without a single assertion.
 *
 * @param wide - Configuration whose rows may carry members their type omits.
 *
 * @param seed - Row standing in for an absent first row.
 *
 * @returns label length read through the destructured primitive.
 *
 * @example
 * ```ts
 * mutateExcessRestMember({ rows: [], }, { label: '', count: 0, },);
 * ```
 */
export function mutateExcessRestMember(
  wide: { rows: { label: string; count: number; }[]; },
  seed: { label: string; count: number; },
): number {
  const { label, ...remainder } = wide.rows
    .at(0,) ?? seed;
  if (('inner' in remainder)
    && ((typeof remainder.inner) === 'object')
    && (remainder.inner !== null)
    && ('label' in remainder.inner))
    remainder.inner.label = 'changed';
  return label.length;
}

/**
 * Mutates parameter state through a closure created outside the callable body.
 *
 * A parameter initializer is a sibling of the body, exactly as a parameter declaration
 * is, so the holder scan walking the body never sees a closure written there. The
 * rebinding is classified local, its only body occurrence is the assignment target the
 * scan skips, and the closure observes the rebound value afterwards.
 *
 * @param config - Configuration supplying the caller-owned row.
 *
 * @param temporary - Scratch parameter replaced inside the body.
 *
 * @param mutate - Closure observing that scratch parameter after the replacement.
 *
 * @example
 * ```ts
 * mutateThroughParameterInitializer({ rows: [], row: { label: '', }, }, undefined,);
 * ```
 */
export function mutateThroughParameterInitializer(
  config: Config,
  temporary: Row | undefined,
  mutate: () => void = (): void => {
    if (temporary !== undefined)
      temporary.label = 'changed';
  },
): void {
  temporary = config.rows
    .at(0,);
  mutate();
}

/**
 * Binding holding an object rest that escaped every callable.
 */
let escapedRest: { count: number; } | undefined;

/**
 * Lets an object rest escape without writing through it anywhere in this callable.
 *
 * The decisive case for discharging a rest from its type members. Nothing here writes,
 * so the direct-write attribution that catches `mutateExcessRestMember` never fires, and
 * the only thing standing between this and an offer is whether the rest counts as
 * holding caller state. Its type says two primitives; a value assignable to that type may
 * carry any number of references besides, and object rest copies what the value has
 * rather than what its type declares.
 *
 * @param wide - Configuration whose rows may carry members their type omits.
 *
 * @param seed - Row standing in for an absent first row.
 *
 * @returns label length read through the destructured primitive.
 *
 * @example
 * ```ts
 * leakExcessRestMember({ rows: [], }, { label: '', count: 0, },);
 * ```
 */
export function leakExcessRestMember(
  wide: { rows: { label: string; count: number; }[]; },
  seed: { label: string; count: number; },
): number {
  const { label, ...remainder } = wide.rows
    .at(0,) ?? seed;
  escapedRest = remainder;
  return label.length;
}

/**
 * Writes through whatever the escaped rest carried beyond its declared members.
 *
 * @example
 * ```ts
 * mutateEscapedRest();
 * ```
 */
export function mutateEscapedRest(): void {
  if ((escapedRest !== undefined)
    && ('inner' in escapedRest)
    && ((typeof escapedRest.inner) === 'object')
    && (escapedRest.inner !== null)
    && ('label' in escapedRest.inner))
    escapedRest.inner.label = 'changed';
}

/**
 * Destructured input whose two bindings take their opacity from different causes.
 */
type MixedCauses = {
  stored: Row;
  called: Row;
};

/**
 * Stores one destructured binding and hands the other to an unresolved call.
 *
 * The subject of a report names authored bindings, and it is built from every opaque slot
 * without asking what made the slot opaque. One cause per binding is what separates the
 * two, so a subject that speaks about the call must name `called` alone.
 *
 * @param stored - Binding retained beyond this callable.
 *
 * @param called - Binding handed to a call this rule cannot inspect.
 *
 * @example
 * ```ts
 * reportMixedBindingCauses({ stored: { label: '', }, called: { label: '', }, },);
 * ```
 */
export function reportMixedBindingCauses({
  stored,
  called,
}: MixedCauses,): void {
  held = stored;
  JSON.stringify(called,);
}

/**
 * Binding retaining a projection whose declared readonly is dishonest.
 */
let heldEncoder: Readonly<TextEncoder> | undefined;

/**
 * Declares a readonly projection that still writes a supplied destination.
 *
 * Paired with `storeDishonestProjection` as the control half. `Readonly<TextEncoder>` keeps
 * `encodeInto`, so the declared type claims something the value does not honour, and this
 * shape must report that whatever else the callable does.
 *
 * @param encoder - Projection whose declared readonly is dishonest.
 *
 * @example
 * ```ts
 * declareDishonestProjection(new TextEncoder(),);
 * ```
 */
export function declareDishonestProjection(encoder: Readonly<TextEncoder>,): void {
  void encoder;
}

/**
 * Stores that same projection, which must not change what its declared type reports.
 *
 * The pair exists because a sweep of this repository cannot catch what it protects. Nothing
 * here pairs retention with a dishonest declared type, so the count of dishonest reports
 * held constant across three captures while this verdict was being suppressed. A store
 * silencing a verdict about a declared type is a placement mistake that only a shape built
 * to collide can show.
 *
 * @param encoder - Projection stored beyond this callable.
 *
 * @example
 * ```ts
 * storeDishonestProjection(new TextEncoder(),);
 * ```
 */
export function storeDishonestProjection(encoder: Readonly<TextEncoder>,): void {
  heldEncoder = encoder;
}

/**
 * Structural parameter whose elements are primitives rather than references.
 */
type Labels = {
  labels: string[];
};

/**
 * Binding retaining a primitive, which no caller can observe a write through.
 */
let heldLabel = '';

/**
 * Retains each row in a binding outside the callable through an iteration target.
 *
 * No assignment expression appears anywhere in this, which is what made it invisible to a
 * classification that reads assignments. The retention is the same one
 * `storePropertyIntoModuleBinding` performs, and it was measured offered while that one was
 * reported.
 *
 * @param config - Configuration whose rows escape one at a time.
 *
 * @example
 * ```ts
 * storeIterationTarget({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeIterationTarget(config: Config,): void {
  for (held of config.rows)
    void held;
}

/**
 * Hands the caller's own rows straight back.
 *
 * @param config - Configuration whose rows are handed back.
 *
 * @returns same array.
 *
 * @example
 * ```ts
 * rowsOf({ rows: [], row: { label: '', }, },);
 * ```
 */
export function rowsOf(config: Config,): Row[] {
  return config.rows;
}

/**
 * Builds a fresh array, sharing no identity with its argument.
 *
 * @param config - Configuration whose row count seeds a fresh array.
 *
 * @returns newly allocated array.
 *
 * @example
 * ```ts
 * freshRows({ rows: [], row: { label: '', }, },);
 * ```
 */
export function freshRows(config: Config,): Row[] {
  /**
   * Array this callable allocates and owns.
   */
  const fresh: Row[] = [];
  if (config.rows
    .length
    > 0)
    fresh.push({ label: 'fresh', },);
  return fresh;
}

/**
 * Retains each row through an iterable that came back from an owned call.
 *
 * The iteration form of the store `storeThroughOwnedCall` performs, and it needs the same
 * deferred retention for the same reason: the iterable is a call result, so the origin
 * walk over it comes back with nothing while `for (held of config.rows)` beside it records
 * the retention directly.
 *
 * Present because `recordResultRetention` is called from two sites and a fixture covering
 * one of them proves nothing about the other.
 *
 * @param config - Configuration whose rows escape through the callee.
 *
 * @example
 * ```ts
 * storeIterationThroughCall({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeIterationThroughCall(config: Config,): void {
  for (held of rowsOf(config,))
    void held;
}

/**
 * Retains each element of a freshly allocated iterable, which the caller does not own.
 *
 * The control keeping the iteration half an attribution rather than a rule against
 * iterating any call result.
 *
 * @param config - Configuration read to seed a fresh array.
 *
 * @example
 * ```ts
 * storeIterationThroughFreshCall({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeIterationThroughFreshCall(config: Config,): void {
  for (held of freshRows(config,))
    void held;
}

/**
 * Iterates primitives into a binding outside the callable.
 *
 * Control for the half of this that decides from the element rather than the iterable. An
 * array of strings is itself an object, so a classification asking only what the iterable
 * can carry would report this, and the binding holds nothing any caller could write
 * through.
 *
 * @param config - Configuration whose labels are read one at a time.
 *
 * @example
 * ```ts
 * storeIterationPrimitiveTarget({ labels: [], },);
 * ```
 */
export function storeIterationPrimitiveTarget(config: Labels,): void {
  for (heldLabel of config.labels)
    void heldLabel;
}

/**
 * Declares a fresh binding per iteration, which dies with the iteration.
 *
 * The control that stops the classification from taking every read loop with it. A
 * declaration initializer is not a store however the loop drains.
 *
 * @param config - Configuration whose rows are read one at a time.
 *
 * @returns count of rows carrying a label.
 *
 * @example
 * ```ts
 * declareIterationBinding({ rows: [], row: { label: '', }, },);
 * ```
 */
export function declareIterationBinding(config: Config,): number {
  /**
   * Rows whose label is not empty.
   */
  let labelled = 0;
  for (const row of config.rows) {
    if (row.label !== '')
      labelled += 1;
  }
  return labelled;
}

/**
 * Destructures a structural parameter's row into a binding outside the callable.
 *
 * A destructuring assignment is an assignment, so the classification that reads assignments
 * reaches it, and the target is a pattern rather than an identifier. Kept because that was
 * measured rather than assumed: the target policy answers no for every non-identifier, and
 * this is the shape that makes the answer right.
 *
 * @param config - Configuration whose row escapes through a pattern.
 *
 * @example
 * ```ts
 * destructureIntoModuleBinding({ rows: [], row: { label: '', }, },);
 * ```
 */
export function destructureIntoModuleBinding(config: Config,): void {
  ({ row: held, } = config);
}

/**
 * Destructures a structural parameter's first row into a binding outside the callable.
 *
 * @param config - Configuration whose first row escapes through an array pattern.
 *
 * @example
 * ```ts
 * destructureElementIntoModuleBinding({ rows: [], row: { label: '', }, },);
 * ```
 */
export function destructureElementIntoModuleBinding(config: Config,): void {
  [held,] = config.rows;
}

/**
 * Destructures a structural parameter into a binding the callable declares.
 *
 * Reported, and it should not be. The target policy answers no for every non-identifier,
 * which is right for a property and an element and wrong for a pattern whose every leaf is
 * a local. Withholding costs only precision, so this stays recorded rather than fixed
 * inside a change about soundness, and the assertion below pins what it currently does so
 * the fix has something to flip. Tracked as its own task.
 *
 * @param config - Configuration whose row reaches a local through a pattern.
 *
 * @returns label reached through the destructured local.
 *
 * @example
 * ```ts
 * destructureIntoOwnLocal({ rows: [], row: { label: '', }, },);
 * ```
 */
export function destructureIntoOwnLocal(config: Config,): string {
  /**
   * Local the pattern fills, which no caller can reach after this returns.
   */
  let localRow: Row | undefined;
  ({ row: localRow, } = config);
  return localRow?.label ?? '';
}

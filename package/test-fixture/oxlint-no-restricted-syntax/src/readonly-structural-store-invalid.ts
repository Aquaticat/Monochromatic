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
 * Collection retaining rows past every call.
 */
const pushTarget: Row[] = [];

/**
 * Collection retaining counts past every call, which no caller can be written through.
 */
const countTarget: number[] = [];

/**
 * Binding outside every callable body, holding whichever closure was stored into it last.
 *
 * Declared `const` on purpose. What escapes is the property assignment, not a rebinding of
 * the holder itself, so the store path has to answer for a target it can never see reassigned.
 */
const callbackHolder: {
  produce?: () => Row;
  measure?: () => number;
  container?: { produce: () => Row; };
} = {};

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
 * Stores a primitive read off a returned piece of caller state.
 *
 * The control the retention path needed and did not have. `parameterIndexes` gates every
 * leaf on whether it can carry mutable state, which is why the object-literal control
 * beside it stays silent, and the deferred retention does not go through that resolver at
 * all. Measured without a gate of its own: this recorded `opaque=[0]` with store
 * provenance for retaining a `string`.
 *
 * `storeHeldFresh` could not catch it. That one stays empty because its callee returns
 * nothing the caller owns, not because anything recognised a primitive, so the two
 * controls fail for different reasons and neither substitutes for the other.
 *
 * @param config - Configuration whose label is copied out.
 *
 * @example
 * ```ts
 * storePrimitiveProjection({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storePrimitiveProjection(config: Config,): void {
  heldLabel = firstRow(config,)
    .label;
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

/**
 * Stores a closure that hands the caller's own row to whoever holds the closure.
 *
 * Falsified before the fix existed: the rule offered `ReadonlyDeep<Config>`, the applied
 * annotation type-checked clean, and a holder invoking the stored closure changed the
 * caller's row. Nothing in the assignment names `config`, so the origin walk over the stored
 * expression came back empty, and the closure body went unscanned because a stored closure
 * counts as inactive.
 *
 * @param config - Configuration whose row the stored closure can hand out.
 *
 * @example
 * ```ts
 * storeCapturingClosure({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeCapturingClosure(config: Config,): void {
  callbackHolder.produce = (): Row => config.row;
}

/**
 * Stores a closure that writes through the caller's row before handing it back.
 *
 * Self-limiting once the annotation is applied, because the write inside the closure stops
 * type-checking, which is why the reading shape is the one that falsifies. It belongs here
 * anyway: what the store hands over does not depend on what the closure does with it, and
 * an implementation recording only writes would treat these two shapes differently.
 *
 * @param config - Configuration whose row the stored closure writes through.
 *
 * @example
 * ```ts
 * storeCapturingClosureWriting({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeCapturingClosureWriting(config: Config,): void {
  callbackHolder.produce = (): Row => {
    config.row
      .label = 'written';
    return config.row;
  };
}

/**
 * Stores a closure that only measures the caller's row and hands back a number.
 *
 * Withheld, and it need not be. The capture grants the holder no way to reach the row: the
 * closure reads a `string`, returns its length, and hands nothing outward. `packagedCallableOrigins`
 * names every binding a packaged body mentions whatever position it appears in, so `config`
 * contributes here exactly as it does in the shapes that do hand something over.
 *
 * Recorded rather than fixed, because withholding costs precision and the alternative costs
 * soundness if the finer body summary is wrong. Task #64 holds the question, and the
 * assertion pinning this shape is what a narrowing fix has to flip.
 *
 * @param config - Configuration whose row the stored closure only reads.
 *
 * @example
 * ```ts
 * storeReadingClosure({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeReadingClosure(config: Config,): void {
  callbackHolder.measure = (): number => config.row
    .label
    .length;
}

/**
 * Stores the same capturing closure behind parentheses and an assertion.
 *
 * The normalization control. A closure wrapped this way is the same closure, and the store
 * path has to reach through both wrappers to see it. Without that, the shape reads as an
 * ordinary expression, the origin walk over it comes back empty exactly as it does for a
 * bare closure, and the offer returns.
 *
 * Two wrappers rather than one, because a single hop is satisfied by unwrapping once, and
 * what the code does is loop until nothing more comes off.
 *
 * @param config - Configuration whose row the wrapped stored closure hands out.
 *
 * @example
 * ```ts
 * storeWrappedCapturingClosure({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeWrappedCapturingClosure(config: Config,): void {
  callbackHolder.produce = (((): Row => config.row) as () => Row);
}

/**
 * Hands a structural parameter to a callable that stores a closure capturing it.
 *
 * The control for whether the store-site record reaches callers. A caller sees no write and
 * no store of its own, so the only thing that can withhold its offer is the callee's slot
 * arriving through the call edge.
 *
 * @param config - Configuration handed to the storing callable.
 *
 * @example
 * ```ts
 * passToCapturingStore({ rows: [], row: { label: '', }, },);
 * ```
 */
export function passToCapturingStore(config: Config,): void {
  storeCapturingClosure(config,);
}

/**
 * Writes through a closure the callable declares, invokes and never hands anywhere.
 *
 * The control that must not move. A closure assigned to a binding the callable owns is not a
 * store, `targetIsCallableLocal` answers that, and the write reaches `config` through the
 * ordinary active-body scan rather than through anything the store path records. Should this
 * shape start reporting store provenance, the target policy has stopped distinguishing a
 * binding the callable owns from one it does not.
 *
 * @param config - Configuration the locally invoked closure writes through.
 *
 * @example
 * ```ts
 * invokeLocalClosureWriting({ rows: [], row: { label: '', }, },);
 * ```
 */
export function invokeLocalClosureWriting(config: Config,): void {
  /**
   * Closure this callable owns, which dies when the call returns.
   */
  const local = (): void => {
    config.row
      .label = 'written';
  };
  local();
}

/**
 * Writes through a closure the callable assigns to a local it declared separately.
 *
 * The same closure as `invokeLocalClosureWriting` reached through an assignment rather than
 * an initializer, and it measures differently: no effect at all, where the declaration form
 * records the write. The store path is not the cause, since `targetIsCallableLocal` answers
 * for both, so the difference sits in which closures the activity scan selects.
 *
 * Self-limiting, not unsound. `config` is written directly in this file, so the offered
 * annotation stops type-checking and the falsification bar is never reached. Pinned here
 * because the two forms should not disagree, and tracked separately.
 *
 * @param config - Configuration the locally invoked closure writes through.
 *
 * @example
 * ```ts
 * invokeAssignedLocalClosureWriting({ rows: [], row: { label: '', }, },);
 * ```
 */
export function invokeAssignedLocalClosureWriting(config: Config,): void {
  /**
   * Closure this callable owns, filled after it was declared.
   */
  let local: (() => void) | undefined;
  local = (): void => {
    config.row
      .label = 'written';
  };
  local();
}

/**
 * Retains whatever callable it is handed, without ever invoking it.
 *
 * @param callback - Callable retained past this call.
 *
 * @example
 * ```ts
 * retainCallable((): Row => ({ label: '', }),);
 * ```
 */
export function retainCallable(callback: () => Row,): void {
  callbackHolder.produce = callback;
}

/**
 * Hands a bare capturing closure to a callee that retains it.
 *
 * Falsified before the capture channel existed. Nothing here writes and nothing here stores,
 * so the only thing that can withhold the offer is what the closure captured travelling to
 * the callee's uncertain formal. The rule offered `ReadonlyDeep<Config>`, applying it
 * type-checked clean, and the holder invoking the retained closure changed the caller's row.
 *
 * @param retained - Configuration whose row the handed closure hands out.
 *
 * @example
 * ```ts
 * handCaptureToRetainer({ rows: [], row: { label: '', }, },);
 * ```
 */
export function handCaptureToRetainer(retained: Config,): void {
  retainCallable((): Row => retained.row,);
}

/**
 * Hands the same capture by name rather than inline.
 *
 * The alias control, and the reason the channel is driven by resolved declarations rather
 * than by argument syntax. A syntax test sees an identifier here and stops; the resolver
 * follows the local to the function expression it was bound to.
 *
 * @param namedRetained - Configuration whose row the named closure hands out.
 *
 * @example
 * ```ts
 * handNamedCaptureToRetainer({ rows: [], row: { label: '', }, },);
 * ```
 */
export function handNamedCaptureToRetainer(namedRetained: Config,): void {
  /**
   * Closure this callable allocates and hands over by name.
   */
  const producer = (): Row => namedRetained.row;
  retainCallable(producer,);
}

/**
 * Hands a closure that captures nothing to the same retaining callee.
 *
 * The control that keeps this an attribution rather than a rule against handing callables to
 * retaining callees. This closure allocates its own row, so there is nothing captured to
 * travel, and the parameter keeps its offer.
 *
 * @param untouched - Configuration the handed closure never names.
 *
 * @returns count read in place off the untouched configuration.
 *
 * @example
 * ```ts
 * handFreshCaptureToRetainer({ rows: [], row: { label: '', }, },);
 * ```
 */
export function handFreshCaptureToRetainer(untouched: Config,): number {
  retainCallable((): Row => ({ label: 'fresh', }),);
  return untouched.rows
    .length;
}

/**
 * Invokes a handed callable and keeps nothing.
 *
 * The precision control. This callee is certain about its formal, so a caller handing it a
 * capturing closure keeps its offer, which is what stops the channel from withholding on
 * every callable ever handed to an owned callee.
 *
 * @param invoked - Callable invoked once and discarded.
 *
 * @returns label read through the invoked callable.
 *
 * @example
 * ```ts
 * readThroughCallable((): Row => ({ label: '', }),);
 * ```
 */
export function readThroughCallable(invoked: () => Row,): string {
  return invoked().label;
}

/**
 * Hands a capturing closure to a callee that only invokes it.
 *
 * @param inspected - Configuration whose row the handed closure reads.
 *
 * @returns label read through the handed closure.
 *
 * @example
 * ```ts
 * handCaptureToReader({ rows: [], row: { label: '', }, },);
 * ```
 */
export function handCaptureToReader(inspected: Config,): string {
  return readThroughCallable((): Row => inspected.row,);
}

/**
 * Forwards a handed callable to something this analysis cannot resolve.
 *
 * The callee that decides the admission gate. It stores nothing, so it carries no retention
 * provenance, and it hands the callable to a boundary that could keep it and invoke it later.
 * A gate reading retention alone would let a caller of this keep its offer.
 *
 * @param relayed - Callable handed onward to an unresolved boundary.
 *
 * @example
 * ```ts
 * relayCallable((): Row => ({ label: '', }),);
 * ```
 */
export function relayCallable(relayed: () => Row,): void {
  queueMicrotask(relayed,);
}

/**
 * Hands a capturing closure to a callee that forwards it somewhere unresolved.
 *
 * The shape that decides between two gates, and the reason the gate is the callee's
 * uncertainty rather than the reason for it. Absent retention provenance means call-caused or
 * unknown, never proven non-retaining: whatever `relayCallable` forwarded to may keep the
 * closure and invoke it whenever it likes.
 *
 * Measured with a retention-only gate in place: this recorded nothing and kept its offer,
 * while every other shape in this file stayed correct, so nothing else here can stand in for
 * it.
 *
 * @param forwarded - Configuration whose row the forwarded closure hands out.
 *
 * @example
 * ```ts
 * handCaptureToRelay({ rows: [], row: { label: '', }, },);
 * ```
 */
export function handCaptureToRelay(forwarded: Config,): void {
  relayCallable((): Row => forwarded.row,);
}

/**
 * Stores a capturing closure the callable bound to a local first.
 *
 * Falsified before the store path resolved callables rather than testing their syntax. The
 * gate saw an identifier and stopped, and `parameterIndexes` found nothing either, because a
 * local bound to a function expression carries no parameter origin for the same reason the
 * inline form needed a fix at all.
 *
 * `holder.on = handler` is what real code writes far more often than the inline store, so
 * this shape rather than the inline one is what decides whether the store path reaches
 * ordinary source.
 *
 * @param aliased - Configuration whose row the named closure hands out.
 *
 * @example
 * ```ts
 * storeNamedCapturingClosure({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeNamedCapturingClosure(aliased: Config,): void {
  /**
   * Closure this callable allocates and then stores by name.
   */
  const producer = (): Row => aliased.row;
  callbackHolder.produce = producer;
}

/**
 * Stores a named closure that captures nothing.
 *
 * The control. Resolving the identifier must attribute what the closure captured rather than
 * report every named callable ever stored, so this one allocates its own row and keeps its
 * offer.
 *
 * @param unnamed - Configuration the stored closure never names.
 *
 * @returns count read in place off the untouched configuration.
 *
 * @example
 * ```ts
 * storeNamedFreshClosure({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeNamedFreshClosure(unnamed: Config,): number {
  /**
   * Closure this callable allocates, naming nothing the caller owns.
   */
  const producer = (): Row => ({ label: 'fresh', });
  callbackHolder.produce = producer;
  return unnamed.rows
    .length;
}

/**
 * Hands back a closure that can produce the caller's own row on demand.
 *
 * Falsified. Returning parameter-reachable state is permitted by
 * `doc/decision/prefer-readonly-result-provenance.md` on one stated condition, that callers
 * keep tracking the value through recorded returned origins, and a function expression has no
 * provenance successors, so this recorded no returned origin and no caller could substitute
 * through it. The precondition fails rather than the policy applying.
 *
 * Withheld through opacity rather than through a returned origin. A returned origin asserts a
 * caller can reach these parameters through this result, and what this hands back is the
 * capability to reach them by invoking it.
 *
 * @param produced - Configuration whose row the returned closure hands out.
 *
 * @returns closure carrying caller state.
 *
 * @example
 * ```ts
 * returnCapturingClosure({ rows: [], row: { label: '', }, },);
 * ```
 */
export function returnCapturingClosure(produced: Config,): () => Row {
  return (): Row => produced.row;
}

/**
 * Hands back a closure that allocates its own row.
 *
 * The control. Withholding must attribute what a returned callable captured rather than
 * refuse every callable ever returned, so this one names nothing the caller owns and keeps
 * its offer.
 *
 * @param unreturned - Configuration the returned closure never names.
 *
 * @returns closure carrying nothing the caller owns.
 *
 * @example
 * ```ts
 * returnFreshClosure({ rows: [], row: { label: '', }, },);
 * ```
 */
export function returnFreshClosure(unreturned: Config,): () => Row {
  void unreturned.rows
    .length;
  return (): Row => ({ label: 'fresh', });
}

/**
 * Hands back a piece of caller state directly, which the accepted decision permits.
 *
 * The policy control, and the reason this change is about a precondition rather than about
 * returns. This return is tracked: callers substitute through the recorded returned origin, so
 * the decision's condition holds and the offer stands.
 *
 * @param direct - Configuration whose row is handed back.
 *
 * @returns caller's own row.
 *
 * @example
 * ```ts
 * returnRowDirectly({ rows: [], row: { label: '', }, },);
 * ```
 */
export function returnRowDirectly(direct: Config,): Row {
  return direct.row;
}

/**
 * Stores a closure reaching caller state only by calling a sibling local.
 *
 * Falsified before the capture walk followed calls. The stored arrow names only `read`, and a
 * local bound to a function expression carries no parameter origin, so the lexical scan came
 * back empty and the parameter was offered.
 *
 * @param relayedThrough - Configuration whose row the sibling closure hands out.
 *
 * @example
 * ```ts
 * storeClosureCallingSibling({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeClosureCallingSibling(relayedThrough: Config,): void {
  /**
   * Sibling closure the stored one calls, which is where the capture actually sits.
   */
  const read = (): Row => relayedThrough.row;
  callbackHolder.produce = (): Row => read();
}

/**
 * Hands a callee a closure reaching caller state only through a sibling call.
 *
 * The argument-path form of the same walk. Without it, following calls at the store site alone
 * would look correct while the identical capture handed to a retaining callee stayed invisible.
 *
 * @param relayedArgument - Configuration whose row the sibling closure hands out.
 *
 * @example
 * ```ts
 * handSiblingCaptureToRetainer({ rows: [], row: { label: '', }, },);
 * ```
 */
export function handSiblingCaptureToRetainer(relayedArgument: Config,): void {
  /**
   * Sibling closure the handed one calls.
   */
  const read = (): Row => relayedArgument.row;
  retainCallable((): Row => read(),);
}

/**
 * Returns a closure reaching caller state only through a sibling call.
 *
 * The returned-path form, for the same reason.
 *
 * @param relayedReturn - Configuration whose row the sibling closure hands out.
 *
 * @returns closure carrying caller state through a sibling.
 *
 * @example
 * ```ts
 * returnClosureCallingSibling({ rows: [], row: { label: '', }, },);
 * ```
 */
export function returnClosureCallingSibling(relayedReturn: Config,): () => Row {
  /**
   * Sibling closure the returned one calls.
   */
  const read = (): Row => relayedReturn.row;
  return (): Row => read();
}

/**
 * Stores a closure calling a sibling that names nothing the caller owns.
 *
 * The control. Following calls must attribute what the callee reaches rather than report every
 * closure that calls anything, so this sibling allocates its own row and the offer stands.
 *
 * @param relayedFresh - Configuration the sibling closure never names.
 *
 * @returns count read in place off the untouched configuration.
 *
 * @example
 * ```ts
 * storeClosureCallingFreshSibling({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeClosureCallingFreshSibling(relayedFresh: Config,): number {
  /**
   * Sibling closure naming nothing the caller owns.
   */
  const read = (): Row => ({ label: 'fresh', });
  callbackHolder.produce = (): Row => read();
  return relayedFresh.rows
    .length;
}

/**
 * Stores a closure whose sibling calls back into it.
 *
 * The termination control. A mutually recursive pair must be folded in once each rather than
 * chased forever, and the offer must still be withheld because the capture is real.
 *
 * @param recursed - Configuration whose row the recursive pair hands out.
 *
 * @example
 * ```ts
 * storeMutuallyRecursiveClosures({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeMutuallyRecursiveClosures(recursed: Config,): void {
  /**
   * First half of the pair, which the second calls.
   */
  function first(): Row {
    return second();
  }
  /**
   * Second half of the pair, which calls back into the first and holds the capture.
   */
  function second(): Row {
    return recursed.rows
      .length > 0
      ? first()
      : recursed.row;
  }
  callbackHolder.produce = (): Row => first();
}

/**
 * Closure naming nothing the caller owns, for the conditional store to choose between.
 */
const freshProducer = (): Row => ({ label: 'fresh', });

/**
 * Stores whichever of two closures a condition selects.
 *
 * Falsified. Testing the written syntax saw a conditional rather than a callable and stopped,
 * so neither branch was examined and the parameter was offered.
 *
 * @param chosen - Configuration whose row one branch hands out.
 *
 * @param condition - Which branch is stored.
 *
 * @example
 * ```ts
 * storeConditionalClosure({ rows: [], row: { label: '', }, }, true,);
 * ```
 */
export function storeConditionalClosure(chosen: Config, condition: boolean,): void {
  callbackHolder.produce = condition ? ((): Row => chosen.row) : freshProducer;
}

/**
 * Stores whichever of two closures a nullish coalescence selects.
 *
 * Both operands of `??` and `||` can be the value, unlike `&&`, whose left operand is discarded
 * whenever the right is produced. Pinned because the operator table is easy to get backwards.
 *
 * @param coalesced - Configuration whose row the fallback branch hands out.
 *
 * @param preferred - Closure used when present.
 *
 * @example
 * ```ts
 * storeCoalescedClosure({ rows: [], row: { label: '', }, }, undefined,);
 * ```
 */
export function storeCoalescedClosure(
  coalesced: Config,
  preferred: (() => Row) | undefined,
): void {
  callbackHolder.produce = preferred ?? ((): Row => coalesced.row);
}

/**
 * Stores a container held in a local, whose property holds a capturing closure.
 *
 * Falsified. The written form of this store is an identifier, and the origin walk descends an
 * object literal only where one is written, so following the local to the literal is what makes
 * the packaged closure visible.
 *
 * @param contained - Configuration whose row the packaged closure hands out.
 *
 * @example
 * ```ts
 * storeAliasedContainer({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeAliasedContainer(contained: Config,): void {
  /**
   * Container this callable allocates and then hands over by name.
   */
  const box = { produce: (): Row => contained.row, };
  callbackHolder.container = box;
}

/**
 * Stores a conditional whose branches both name nothing the caller owns.
 *
 * The control. Following both branches must attribute what they capture rather than report
 * every conditional store, so this one keeps its offer.
 *
 * @param neither - Configuration neither branch names.
 *
 * @param condition - Which branch is stored.
 *
 * @returns count read in place off the untouched configuration.
 *
 * @example
 * ```ts
 * storeConditionalFresh({ rows: [], row: { label: '', }, }, true,);
 * ```
 */
export function storeConditionalFresh(neither: Config, condition: boolean,): number {
  callbackHolder.produce = condition ? freshProducer : ((): Row => ({ label: 'other', }));
  return neither.rows
    .length;
}

/**
 * Stores a coalescence whose capturing closure sits on the left.
 *
 * The operand control, and the only shape here that decides it. `storeCoalescedClosure` puts the
 * capture on the right, so treating nullish coalescence as right-operand-only passes it and
 * every other assertion: measured with that mutation in place, the whole suite stayed green.
 *
 * The capture is unreachable to the origin walk as well, which is what leaves this walk as the
 * only path to it. `producer` is bound to a conditional holding an arrow, and an arrow has no
 * provenance successors, so the binding carries no origin for the origin walk to find.
 *
 * @param leftBiased - Configuration whose row the left operand hands out.
 *
 * @param absent - Whether the left operand is left empty.
 *
 * @example
 * ```ts
 * storeLeftBiasedClosure({ rows: [], row: { label: '', }, }, false,);
 * ```
 */
export function storeLeftBiasedClosure(leftBiased: Config, absent: boolean,): void {
  /**
   * Left operand, holding the capture whenever it holds anything.
   */
  const producer: (() => Row) | undefined = absent
    ? undefined
    : ((): Row => leftBiased.row);
  callbackHolder.produce = producer ?? freshProducer;
}

/**
 * Keeps whatever row it is constructed with, so a construction retains its argument.
 */
class RowKeeper {
  /**
   * Row this instance keeps.
   */
  readonly #kept: Row;

  /**
   * Keeps the row handed to the constructor.
   *
   * @param kept - Row retained by this instance.
   */
  constructor(kept: Row,) {
    this.#kept = kept;
  }

  /**
   * Hands back the kept row.
   *
   * @returns row this instance kept.
   */
  read = (): Row => this.#kept;
}

/**
 * Hands a row to a constructor that keeps it.
 *
 * Falsified. A construction is neither a call edge nor a store nor a return, and
 * `NewExpression` appeared nowhere in this analysis, so nothing recorded that the constructed
 * object retains what it was given.
 *
 * @param handedToNew - Configuration whose row the constructed holder keeps.
 *
 * @example
 * ```ts
 * handRowToConstructor({ rows: [], row: { label: '', }, },);
 * ```
 */
export function handRowToConstructor(handedToNew: Config,): void {
  callbackHolder.produce = new RowKeeper(handedToNew.row,)
    .read;
}

/**
 * Constructs with a primitive read off the parameter.
 *
 * The leaf control. A construction records only what its arguments can carry, so handing over a
 * `string` retains nothing a caller can be written through, and the offer stands.
 *
 * @param primitiveToNew - Configuration whose label is handed to a construction.
 *
 * @returns message carrying the label.
 *
 * @example
 * ```ts
 * handLabelToConstructor({ rows: [], row: { label: '', }, },);
 * ```
 */
export function handLabelToConstructor(primitiveToNew: Config,): Error {
  return new Error(primitiveToNew.row.label,);
}

/**
 * Yields the caller's row to whoever drives the iterator.
 *
 * Falsified. A yield hands the value to a driver that outlives it by construction, and nothing
 * about a yielded value reaches the enclosing callable's returned set, so the tracking that
 * makes a return benign is not available.
 *
 * @param yieldedOut - Configuration whose row the generator yields.
 *
 * @returns iterator handing out the caller's row.
 *
 * @example
 * ```ts
 * yieldRowOutward({ rows: [], row: { label: '', }, },);
 * ```
 */
export function yieldRowOutward(yieldedOut: Config,): Iterator<Row> {
  /**
   * Generator handing out the caller's row.
   */
  function* rows(): Generator<Row> {
    yield yieldedOut.row;
  }
  return rows();
}

/**
 * Yields a count read off the parameter.
 *
 * The yield control, for the same reason as the construction control.
 *
 * @param yieldedCount - Configuration whose row count is yielded.
 *
 * @returns iterator handing out a count.
 *
 * @example
 * ```ts
 * yieldCountOutward({ rows: [], row: { label: '', }, },);
 * ```
 */
export function yieldCountOutward(yieldedCount: Config,): Iterator<number> {
  /**
   * Generator handing out a count.
   */
  function* counts(): Generator<number> {
    yield yieldedCount.rows
      .length;
  }
  return counts();
}

/**
 * Hands back caller state from an async callable.
 *
 * The accepted decision permits this, on the condition that callers keep tracking the value.
 * The condition was failing: the returned origin was recorded here and lost at every caller,
 * because an await was not a transparent step in the walk that finds a write's target.
 *
 * @param asyncReturned - Configuration whose row is handed back.
 *
 * @returns caller's own row.
 *
 * @example
 * ```ts
 * returnRowAsync({ rows: [], row: { label: '', }, },);
 * ```
 */
export async function returnRowAsync(asyncReturned: Config,): Promise<Row> {
  return asyncReturned.row;
}

/**
 * Writes through an awaited piece of caller state.
 *
 * The caller half, and the one that decides whether the fix worked. Its synchronous twin
 * recorded `mutated=[0]` all along while this recorded nothing.
 *
 * @param awaitedThrough - Configuration this callable writes through.
 *
 * @example
 * ```ts
 * writeThroughAwaitedRow({ rows: [], row: { label: '', }, },);
 * ```
 */
export async function writeThroughAwaitedRow(awaitedThrough: Config,): Promise<void> {
  (await returnRowAsync(awaitedThrough,)).label = 'written';
}

/**
 * Hands back a piece of the caller's own structure.
 *
 * @param handedBack - Structure whose row is handed back.
 *
 * @returns caller's own row.
 *
 * @example
 * ```ts
 * rowOf({ rows: [], row: { label: '', }, },);
 * ```
 */
export function rowOf(handedBack: Config,): Row {
  return handedBack.row;
}

/**
 * Keeps whatever row it is handed.
 *
 * @param keptRow - Row retained past this call.
 *
 * @example
 * ```ts
 * keepRow({ label: '', },);
 * ```
 */
export function keepRow(keptRow: Row,): void {
  held = keptRow;
}

/**
 * Retains a returned row through a collection call.
 *
 * Falsified. A call result handed as an argument carries caller state the origin walk cannot
 * see, because a callee's summary does not exist while its callers are walked.
 *
 * @param pushedResult - Configuration whose returned row the collection keeps.
 *
 * @example
 * ```ts
 * retainResultThroughPush({ rows: [], row: { label: '', }, },);
 * ```
 */
export function retainResultThroughPush(pushedResult: Config,): void {
  pushTarget.push(rowOf(pushedResult,),);
}

/**
 * Hands a returned row to an owned callee that keeps it.
 *
 * The owned half of the same shape, since the unresolved and owned receivers fail for the same
 * reason and a fixture covering one proves nothing about the other.
 *
 * @param nestedResult - Configuration whose returned row the outer call keeps.
 *
 * @example
 * ```ts
 * handResultToRetainer({ rows: [], row: { label: '', }, },);
 * ```
 */
export function handResultToRetainer(nestedResult: Config,): void {
  keepRow(rowOf(nestedResult,),);
}

/**
 * Hands a count to a collection call.
 *
 * The leaf control. An argument that cannot carry mutable state records nothing, which is what
 * keeps this from withholding on every call that is handed a projection.
 *
 * @param countedArgument - Configuration whose row count is handed over.
 *
 * @example
 * ```ts
 * handCountToCollection({ rows: [], row: { label: '', }, },);
 * ```
 */
export function handCountToCollection(countedArgument: Config,): void {
  countTarget.push(countedArgument.rows
    .length,);
}

/**
 * Writes through a returned row bound by a destructuring pattern.
 *
 * Falsified. The registration returned false for any non-identifier name, so a pattern
 * registered nothing.
 *
 * @param patternBound - Configuration this callable writes through.
 *
 * @example
 * ```ts
 * writeThroughPatternBinding({ rows: [], row: { label: '', }, },);
 * ```
 */
export function writeThroughPatternBinding(patternBound: Config,): void {
  /**
   * Row reached through a pattern rather than a plain binding.
   */
  const { inner, } = { inner: rowOf(patternBound,), };
  inner.label = 'written';
}

/**
 * Writes through a returned row bound by a logical assignment.
 *
 * Falsified. The binding scan collected plain assignment alone.
 *
 * @param logicalBound - Configuration this callable writes through.
 *
 * @example
 * ```ts
 * writeThroughLogicalBinding({ rows: [], row: { label: '', }, },);
 * ```
 */
export function writeThroughLogicalBinding(logicalBound: Config,): void {
  /**
   * Row filled by a logical assignment.
   */
  let filled: Row | undefined;
  filled ??= rowOf(logicalBound,);
  filled.label = 'written';
}

/**
 * Writes through a returned row bound by a parameter default.
 *
 * Falsified. The binding scan collected local declarations and not this callable's own
 * parameters.
 *
 * @param defaultBound - Configuration this callable writes through.
 *
 * @param defaulted - Row defaulting to the returned one.
 *
 * @example
 * ```ts
 * writeThroughDefaultBinding({ rows: [], row: { label: '', }, },);
 * ```
 */
export function writeThroughDefaultBinding(
  defaultBound: Config,
  defaulted: Row = rowOf(defaultBound,),
): void {
  defaulted.label = 'written';
}

/**
 * Writes through a returned row reached by a conditional target.
 *
 * Falsified. The normalisation walk strips access layers and identity-keeping wrappers, and a
 * conditional is neither: it is a place a value came from rather than a layer over it.
 *
 * @param conditionalTarget - Configuration this callable writes through.
 *
 * @param pick - Which branch is written.
 *
 * @example
 * ```ts
 * writeThroughConditionalTarget({ rows: [], row: { label: '', }, }, true,);
 * ```
 */
export function writeThroughConditionalTarget(
  conditionalTarget: Config,
  pick: boolean,
): void {
  (pick ? rowOf(conditionalTarget,) : rowOf(conditionalTarget,)).label = 'written';
}

/**
 * Hands back a returned row through an element of an authored array.
 *
 * Falsified. The return branch asked the expression alone where every write and store site
 * consults the binding record, and a call underlies a member of the literal rather than the
 * element access or the literal itself.
 *
 * @param projectedOut - Configuration whose row is projected out.
 *
 * @returns caller's own row reached through a literal.
 *
 * @example
 * ```ts
 * projectResultOutward({ rows: [], row: { label: '', }, },);
 * ```
 */
export function projectResultOutward(projectedOut: Config,): Row {
  return [rowOf(projectedOut,),][0] as Row;
}

/**
 * Declares a sibling that writes, and reaches it only from a closure nothing here runs.
 *
 * The shape that showed activation discovery was not gated on ancestry. The scan visited every
 * node in the body, so the call inside the stored closure activated `writeIt`, and its write was
 * then attributed to this callable, which never reaches it. Measured before the gate:
 * `mutated=[0]`.
 *
 * Still withheld afterwards, and that is the point. The stored closure genuinely captures the
 * configuration, so the capture walk withholds the offer while the mutation claim disappears. A
 * fix that lost the withholding along with the false fact would be a regression dressed as a
 * correction.
 *
 * @param neverReached - Configuration this callable never writes through.
 *
 * @returns count read in place.
 *
 * @example
 * ```ts
 * storeClosureReachingWriter({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeClosureReachingWriter(neverReached: Config,): number {
  /**
   * Sibling that would write if this callable ever reached it.
   */
  function writeIt(): void {
    neverReached.row
      .label = 'written';
  }
  callbackHolder.produce = (): Row => {
    writeIt();
    return { label: 'fresh', };
  };
  return neverReached.rows
    .length;
}

/**
 * Declares a sibling that returns caller state, reached only from a stored closure.
 *
 * The returned-origin half of the same defect, and the form that decides it. A sibling bound to a
 * `const` arrow does not reproduce it, because overload resolution answers with the arrow, while
 * a function declaration does. Measured before the gate: `returned=[0]`, an origin this callable
 * never returns.
 *
 * @param neverReturned - Configuration this callable never hands back.
 *
 * @returns count read in place.
 *
 * @example
 * ```ts
 * storeClosureReachingReturner({ rows: [], row: { label: '', }, },);
 * ```
 */
export function storeClosureReachingReturner(neverReturned: Config,): number {
  /**
   * Sibling that would hand back caller state if this callable ever reached it.
   */
  function readIt(): Row {
    return neverReturned.row;
  }
  callbackHolder.produce = (): Row => readIt();
  return neverReturned.rows
    .length;
}

/**
 * Invokes a sibling that writes, from the body itself.
 *
 * The control. Activation gated on ancestry must still activate a sibling the callable actually
 * calls, or the gate would silence every ordinary nested helper.
 *
 * @param actuallyReached - Configuration this callable does write through.
 *
 * @example
 * ```ts
 * invokeWritingSibling({ rows: [], row: { label: '', }, },);
 * ```
 */
export function invokeWritingSibling(actuallyReached: Config,): void {
  /**
   * Sibling this callable calls directly.
   */
  function writeIt(): void {
    actuallyReached.row
      .label = 'written';
  }
  writeIt();
}

/**
 * Constructs a collection from a deeply readonly array of primitives.
 *
 * Nothing can be written through the argument, so the construction gains nothing however the
 * constructor keeps it. This is the shape that cost the construction channel the one offer it
 * moved across the workspace, because the leaf test answers yes for any array, an array being an
 * object, while the classifier answers the question exactly.
 *
 * @param readonlyKeys - Deeply readonly keys handed to a construction.
 *
 * @returns count of keys the construction received.
 *
 * @example
 * ```ts
 * constructFromReadonlyKeys(['one',],);
 * ```
 */
export function constructFromReadonlyKeys(readonlyKeys: readonly string[],): number {
  return new Set(readonlyKeys,).size;
}

/**
 * Constructs a collection from rows the caller can be written through.
 *
 * The control. A collection of rows retains the rows, and each row is writable, so this must keep
 * withholding. Without it the gate would read as a rule against constructing from any array.
 *
 * @param mutableRows - Rows handed to a construction.
 *
 * @returns count of rows the construction received.
 *
 * @example
 * ```ts
 * constructFromMutableRows([],);
 * ```
 */
export function constructFromMutableRows(mutableRows: readonly Row[],): number {
  return new Set(mutableRows,).size;
}

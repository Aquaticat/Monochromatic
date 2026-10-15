/**
 Disposable original source, member, request, and selection capabilities for built instruction consumers. @module
 */
import assert from 'node:assert/strict';
import { createGoverningSource, governingParser, type FixtureGoverningSource } from './native-governing-fixture.ts';
import type { FixtureInstructionBinding, FixtureInstructionDeclaration, FixtureInstructionModule } from './native-instruction-contract.ts';

/**
 Require the original native constructor before supplying independently owned fixture inputs.

 @param value - unknown built namespace

 @returns assertion exposing the original instruction consumer

 @throws Error for an absent original constructor export
 */
function assertInstructionModule(value: unknown): asserts value is FixtureInstructionModule {
  if (value === null || typeof value !== 'object' || !('createJudgmentInstructions' in value) || typeof value.createJudgmentInstructions !== 'function') throw new Error('Built native instruction constructor is unavailable');
}

/** Original native entry is consumed after its owned artifact is rebuilt. */
const loaded: unknown = await import(new URL('../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/judgment-instructions.mjs', import.meta.url).href);
assertInstructionModule(loaded);
/** Runtime export admission retains the built constructor independently of source declarations. */
export const createFixtureInstructions: FixtureInstructionModule['createJudgmentInstructions'] = loaded.createJudgmentInstructions;

/** Original fixture policy contains distinct heading, tagged adopter, and quoted-target subjects. */
export const INSTRUCTION_POLICY = '# Fixture scope\n\nAAA: Adopt the following quoted instruction.\n\n> Preserve original fixture material.\n';

/**
 Construct disposable capabilities with observable original callbacks and mutable retirement controls.

 @param contents - exact original source bytes

 @param memberCount - original prepared-group size

 @returns fixture owner and independent input capabilities

 @example createInstructionFixture({ memberCount: 2 });
 */
export function createInstructionFixture({ contents = [INSTRUCTION_POLICY], memberCount = 1 }: Readonly<{ contents?: readonly string[]; memberCount?: number }> = {}) {
  /** Each callback records only operation names, never private original content. */
  const events: string[] = [];
  /** Original source list remains replaceable only through fixture-owned state. */
  const state: { sources: readonly FixtureGoverningSource[]; active: boolean; failure?: Error; issueFailure?: Error; hostPolicy: unknown } = {
    sources: Object.freeze(contents.map(createGoverningSource)), active: false, hostPolicy: {},
  };
  /** Exact declarations allow canonical selector identity and publication-order assertions. */
  const declarations: FixtureInstructionDeclaration[] = [];
  /** Each issued batch retains the exact ordered claims passed by the built owner. */
  const batches: (readonly object[])[] = [];
  /** Prepared member handles remain independently owned original objects. */
  const members = Array.from({ length: memberCount }, function originalMember() { return Object.freeze({}); });
  /** Declared names are immutable inputs to original member selection. */
  const declaredNames = Object.freeze(members.map(function declaredMember(_member, index) { return Object.freeze({ id: `member-${index}`, name: 'fixture' }); }));
  /** Prepared-member lookup retains identifiers separately from opaque binding handles. */
  const byMember = new Map(members.map(function namedMember(member, index): [string, object] { return [`member-${index}`, member]; }));
  /** Private binding records support fixture-local member retirement. */
  const bindings = new WeakMap<object, Readonly<{ binding: FixtureInstructionBinding }>>(members.map(function boundMember(member, index) { return [member, { binding: Object.freeze({ identity: Object.freeze({}), projection: Object.freeze({ memberOrdinal: index }) }) }]; }));
  /** Receipt identity can change independently from equal request bytes. */
  const receipt = { request: Object.freeze({ body: 'fixture request' }) };
  /** Fail original lifetime checks with the exact fixture failure object. */
  function ready(): void {
    events.push('ready');
    if (state.failure) throw state.failure;
  }
  /**
   Preserve original synchronous segment state and callback identity.
   @param operation - original selection operation
   @returns original operation result
   */
  function bindingSegment<Result>(operation: () => Result): Result {
    events.push(`enter:${operation.name}`);
    const previous = state.active;
    state.active = true;
    try { return operation(); }
    finally { state.active = previous; events.push(`exit:${operation.name}`); }
  }
  /** Observe selection's original active-segment decision. */
  function isBindingSegmentActive(): boolean { events.push('active'); return state.active; }
  /** Read the exact retained original source list. */
  function readJudgmentSources() { events.push('sources'); return { hostGoverningPolicy: state.hostPolicy, governingSources: state.sources }; }
  /**
   Preserve declarations without substituting built claim construction.
   @param input - original predicate and opaque handle
   @returns original declaration handle for independent identity assertions
   */
  function declare(input: FixtureInstructionDeclaration): object { declarations.push(input); events.push(`declare:${input.definitionId}`); return input.bindingHandle; }
  /** Preserve original question-selection callback timing. */
  function knownSelection() { events.push('selection'); return { declare }; }
  /**
   Retain original batch order without invoking any remote assessment.
   @param claims - original complete claim sequence
   @returns original immutable fixture batch
   */
  function issue(claims: readonly object[]): object {
    events.push('issue');
    if (state.issueFailure) throw state.issueFailure;
    const batch = Object.freeze([...claims]);
    batches.push(batch);
    return batch;
  }
  /** Captured original capabilities can also construct a second independent judgment. */
  const input = { ready, bindingSegment, isBindingSegmentActive, readJudgmentSources, declaredNames, byMember, bindings, knownSelection, parsePolicy: governingParser.parse, receipt, issue };
  /** Built instruction implementation owns all tested selectors and private maps. */
  const instructions = createFixtureInstructions(input);
  assert.equal(events.length, 0);
  return { instructions, input, events, state, members, byMember, bindings, receipt, declarations, batches };
}

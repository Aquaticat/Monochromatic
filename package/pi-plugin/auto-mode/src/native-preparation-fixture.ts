/** Disposable preparation fixtures supply original sources, member records, and a real native budget. @module */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createBudgetFixture } from './native-judgment-budget-fixture.ts';
import { preparationModule, type PreparationFixtureRecord, type FixturePreparation } from './native-preparation-module-fixture.ts';
import type { ExecutionFixtureMember } from './native-execution-fixture.ts';

//region Each fixture owns independent native capabilities and exact failure observations.
/** Fault controls retain original source identity while exposing each callback ordinal. */
type PreparationControls = {
  sources: Readonly<Record<string, unknown>>;
  sealedSources: Readonly<Record<string, unknown>>;
  sealRequest: object;
  readonly failures: Map<string, Error>;
  readonly counts: Map<string, number>;
  onStep?: (point: string) => void;
};

/** Original consumer state remains inspectable without importing source declarations. */
type PreparationFixture = ReturnType<typeof createBudgetFixture> & Readonly<{
  owner: FixturePreparation;
  state: PreparationControls;
  input: Readonly<Record<string, unknown>>;
  members: readonly ExecutionFixtureMember[];
  byMember: Map<string, object>;
  bindings: WeakMap<object, PreparationFixtureRecord>;
  observer: { beginJudgmentSources: unknown; sealJudgmentSources: (response: object) => object };
  receipt: Readonly<{ request: Readonly<{ body: object }> }>;
  response: object;
  handle: object;
  events: string[];
}>;

/**
 Create independently frozen original members in declared native order.

 @returns complete prepared group whose identities are controlled by the consumer

 @example preparationMembers();
 */
export function preparationMembers(): readonly ExecutionFixtureMember[] {
  return Object.freeze([
    Object.freeze({ id: 'first', name: 'read', input: Object.freeze({ path: 'first.txt' }) }),
    Object.freeze({ id: 'second', name: 'read', input: Object.freeze({ path: 'second.txt' }) }),
  ]);
}

/**
 Bind actual selection construction and budget to disposable original source and dependency capabilities.

 @param catalog - optional invalid catalog text for original selection admission tests

 @returns original preparation consumer and independent fault controls

 @example createPreparationFixture();
 */
export function createPreparationFixture({ catalog }: Readonly<{ catalog?: string }> = {}): PreparationFixture {
  /** The native budget retains original deadline and cancellation behavior. */
  const budgetFixture = createBudgetFixture();
  /** Fixed predicates avoid semantic or provider calls while retaining real selection construction. */
  const catalogText = catalog ?? JSON.stringify({ first: { type: 'noul', instructions: 'Fixed predicate', criteria: { true: 'holds', false: 'does not hold' } } });
  /** Every prepared value is independently frozen before native admission. */
  const members = preparationMembers();
  /** Opaque dependency identity is preserved through publication and finalization. */
  const handle = Object.freeze({});
  /** Original response identity must reach source sealing unchanged. */
  const response = Object.freeze({ original: 'response' });
  /** The original request body remains distinct from its enclosing receipt. */
  const receipt = Object.freeze({ request: Object.freeze({ body: Object.freeze({ original: 'request' }) }) });
  /** Initial source projection belongs to original construction. */
  const sources = Object.freeze({ mandatoryPolicy: Object.freeze({ content: 'initial policy' }), governingSources: Object.freeze([]) });
  /** Sealed policy and source identities must replace only the matching original collection. */
  const sealedSources = Object.freeze({ mandatoryPolicy: Object.freeze({ content: 'sealed policy' }), governingSources: Object.freeze([{ original: true }]) });
  /** Mutable fault controls remain private to this consumer invocation. */
  const state: PreparationControls = { sources, sealedSources, sealRequest: receipt, failures: new Map(), counts: new Map() };
  /** Boundary names include ordinals to expose repeated active and budget checks. */
  const events: string[] = [];
  /** Complete root identifier membership starts unpublished. */
  const byMember = new Map<string, object>();
  /** Published records are shared with native instruction and execution consumers. */
  const bindings = new WeakMap<object, PreparationFixtureRecord>();
  /**
   Observe exact callback order before injecting selected failures or reentry.

   @param point - original capability whose occurrence is observed

   @throws Error when the consumer selected this boundary failure
   */
  function visit(point: string): void {
    /** Original callback ordinal distinguishes early checks from publication-adjacent checks. */
    const count = (state.counts.get(point) ?? 0) + 1;
    state.counts.set(point, count);
    /** Exact occurrence is retained independently of the original failure object. */
    const occurrence = `${point}:${String(count)}`;
    events.push(occurrence);
    state.onStep?.(occurrence);
    /** Exact fault identity must survive preparation failure retention. */
    const failure = state.failures.get(occurrence) ?? state.failures.get(point);
    if (failure !== undefined) throw failure;
  }
  /** Native source sealing is selected by truthiness of its original presence marker. */
  const observer = {
    beginJudgmentSources: true as unknown,
    sealJudgmentSources: function sealJudgmentSources(original: object) {
      visit('seal');
      assert.equal(original, response);
      return { request: state.sealRequest, sources: state.sealedSources };
    },
  };
  /** Original preparation capabilities are supplied independently of source implementation types. */
  const input = {
    active: function active() { visit('active'); budgetFixture.budget.checkpoint(); },
    budget: {
      ...budgetFixture.budget,
      checkpoint: function checkpoint() { visit('checkpoint'); return budgetFixture.budget.checkpoint(); },
    },
    declaredNames: Object.freeze(members.map(function identity(member) { return Object.freeze({ id: member.id, name: member.name }); })),
    observer,
    response,
    receipt,
    readJudgmentSources: function readJudgmentSources() { visit('sources'); return state.sources; },
    publishJudgmentSources: function publishJudgmentSources(current: Readonly<Record<string, unknown>>) { visit('publishSources'); state.sources = current; },
    facade: {
      prepare: function prepare({ signal }: Readonly<{ signal: AbortSignal }>) { visit('prepareDependencies'); assert.equal(signal, budgetFixture.controller.signal); return handle; },
      finalize: function finalize(current: object) { visit('finalizeDependencies'); assert.equal(current, handle); },
    },
    signal: budgetFixture.controller.signal,
    parentJSON: '[{"type":"toolCall","id":"first"},{"type":"toolCall","id":"second"}]',
    catalogText,
    catalogSHA256: createHash('sha256').update(catalogText).digest('hex'),
    resolveBinding: function resolveBinding(original: object) {
      visit('resolveBinding');
      /** Claims may resolve only original published root-member records. */
      const record = bindings.get(original);
      assert.ok(record !== undefined);
      return record.binding;
    },
    bindings,
    byMember,
  };
  /** Actual preparation remains lazy until its original operation is invoked. */
  const owner = preparationModule.createJudgmentPreparation(input);
  return { ...budgetFixture, owner, state, input, members, byMember, bindings, observer, receipt, response, handle, events };
}
//endregion

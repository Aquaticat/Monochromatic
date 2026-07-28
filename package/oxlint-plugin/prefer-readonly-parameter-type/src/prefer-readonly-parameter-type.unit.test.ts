import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { resolve, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import spawn from 'nano-spawn';

import {
  fixtureConfigPath,
  fixtureSourceRoot,
  type OxlintRuleDiagnostic as OxlintDiagnostic,
  OXLINT_PLUGIN_TEST_ROOT as ROOT,
  resolveFixtureTarget,
  runOxlintFixture,
} from '@monochromatic-dev/oxlint-plugin-test-support/ts';

/** Fixture source root. */
const FIXTURES = fixtureSourceRoot({
  fixturePackageName: 'oxlint-no-restricted-syntax',
},);

/** Fixture config enabling only semantic readonly-effect rule. */
const READONLY_FIXTURE_CONFIG = fixtureConfigPath({
  fixturePackageName: 'oxlint-no-restricted-syntax',
  fileName: '.oxlintrc.readonly.fixture.json',
},);

/** Disposable in-project TypeScript source. */
type GeneratedSource = {
  readonly filePath: string;
  readonly [Symbol.dispose]: () => void;
};

/**
 * Runs semantic readonly-effect rule against dedicated fixture source.
 *
 * @param fixturePath - Relative fixture path under source root.
 *
 * @returns readonly-rule diagnostics.
 */
async function lintReadonly(fixturePath: string,): Promise<readonly OxlintDiagnostic[]> {
  return runOxlintFixture({
    codePrefix: 'prefer-readonly-parameter-type(',
    configFlag: '-c',
    fixtureConfig: READONLY_FIXTURE_CONFIG,
    target: resolveFixtureTarget({
      fixtureSourceRoot: FIXTURES,
      fixturePath,
    },),
    threads: 1,
  },);
}

/**
 * Runs semantic rule after Oxlint creates high-count fixed allocator pool.
 *
 * @param fixturePath - Relative fixture path under source root.
 *
 * @returns readonly-rule diagnostics.
 */
async function lintReadonlyWithHighWorkerCount(
  fixturePath: string,
): Promise<readonly OxlintDiagnostic[]> {
  return runOxlintFixture({
    codePrefix: 'prefer-readonly-parameter-type(',
    configFlag: '-c',
    fixtureConfig: READONLY_FIXTURE_CONFIG,
    target: resolveFixtureTarget({
      fixtureSourceRoot: FIXTURES,
      fixturePath,
    },),
    threads: 16,
  },);
}

/**
 * Applies readonly semantic fixes to disposable source inside fixture project.
 *
 * @param source - Source text to lint and optionally suggest-fix.
 *
 * @param fixSuggestions - Whether suggestion channel is enabled.
 *
 * @returns resulting source text.
 */
async function fixReadonlyGeneratedSource({
  source,
  fixSuggestions,
}: {
  readonly source: string;
  readonly fixSuggestions: boolean;
},): Promise<string> {
  /** Disposable in-project directory discoverable by fixture tsconfig. */
  const dirPath = mkdtempSync(resolve(FIXTURES, 'readonly-fix-',),);
  /** Disposable source path inside configured project. */
  const filePath = resolve(dirPath, 'stale-contract.ts',);
  writeFileSync(filePath, source,);
  using fixture: GeneratedSource = {
    filePath,
    [Symbol.dispose]: function cleanup(): void {
      rmSync(dirPath, { recursive: true, force: true, },);
    },
  };
  /** Fix flags preserving suggestion opt-in seam. */
  const fixFlags = fixSuggestions
    ? ['--fix', '--fix-suggestions',]
    : ['--fix',];
  try {
    await spawn(
      'oxlint',
      [
        '--threads',
        '1',
        ...fixFlags,
        '--format',
        'json',
        '-c',
        READONLY_FIXTURE_CONFIG,
        fixture.filePath,
      ],
      { cwd: ROOT, },
    );
  }
  catch (error: unknown) {
    if ((!((typeof error) === 'object')) || (error === null) || (!('stdout' in error)))
      throw error;
  }
  return readFileSync(fixture.filePath, 'utf8',);
}

await describe({
name: 'prefer-readonly-parameter-types diagnostics',
concurrency: 1,
children: [
  it({
    name: 'accepts primitive reads from deeply readonly input without callable boundaries',
    fn: async () => {
      expect(await lintReadonly('readonly-valid.ts',),).toEqual([],);
    },
  },),
  it({
    name: 'starts semantic child before high-worker fixed allocator reservations',
    fn: async () => {
      expect(await lintReadonlyWithHighWorkerCount('readonly-valid.ts',),).toEqual([],);
    },
  },),
  it({
    name: 'rejects former catalog and contract exemptions',
    fn: async () => {
      const diagnostics = await lintReadonly('readonly-catalog-free-invalid.ts',);
      expect(diagnostics.length,).toBe(16,);
      const messages = diagnostics.map(function diagnosticMessage(diagnostic,): string {
        return diagnostic.message;
      },);
      expect(messages.some(function catalogRemediationRemoved(message,): boolean {
        return message.includes('audited-call catalogue',);
      },),).toBe(false,);
      expect(messages.filter(function contractsCannotDischarge(message,): boolean {
        return message.includes(
          'An @mutates block alone documents known effects but cannot make an unresolved implementation safe.',
        );
      },).length,).toBe(9,);
    },
  },),
  it({
    name: 'admits exact contracted host capability only after ordinary inference fails',
    fn: async () => {
      expect(await lintReadonly('readonly-host-capability-valid.ts',),).toEqual([],);
    },
  },),
  it({
    name: 'requires host contract and rejects same-named marker lookalike',
    fn: async () => {
      const diagnostics = await lintReadonly('readonly-host-capability-invalid.ts',);
      expect(diagnostics.length,).toBe(2,);
      expect(diagnostics.some(function missingContract(diagnostic,): boolean {
        return diagnostic.message.includes(
          'uses ForeignHostCapability for unresolved runtime behavior but lacks corresponding @mutates contract',
        );
      },),).toBe(true,);
      expect(diagnostics.some(function shadowedAliasRemainsOpaque(diagnostic,): boolean {
        return diagnostic.message.startsWith(
          'The function input named "controller" is used as the object for these method calls: controller.abort [',
        );
      },),).toBe(true,);
    },
  },),
  it({
    name: 'reports inert ForeignBorrowed markers over deeply readonly types',
    fn: async () => {
      const diagnostics = await lintReadonly('readonly-redundant-marker-invalid.ts',);
      expect(diagnostics.length,).toBe(1,);
      expect(diagnostics[0]?.message
        .startsWith(
          'Parameter "state" carries a ForeignBorrowed marker that no longer affects any classification',
        ),).toBe(true,);
    },
  },),
  it({
    name: 'rejects static plain-data claims without runtime isolation',
    fn: async () => {
      const diagnostics = await lintReadonly('readonly-static-plain-data-invalid.ts',);
      /* Three, down from four, because `enumeratePlainRecord` returns
       * `Object.entries(record).length` and that reader is now derived. Its own doc calls
       * it an enumeration "without a hook-class effect", so recognizing it is the fixture
       * author's stated intent rather than a weakening. No offer appeared with the report
       * removed, which is the check that matters: this file emits none. */
      expect(diagnostics.length,).toBe(3,);
      expect(diagnostics.every(function unresolvedBoundary(diagnostic,): boolean {
        return diagnostic.message.includes('cannot inspect enough of those calls',);
      },),).toBe(true,);
    },
  },),
  it({
    name: 'keeps hook-capable inputs and descriptor mutation fail-closed',
    fn: async () => {
      const diagnostics = await lintReadonly('readonly-plain-data-invalid.ts',);
      /* Still three, and that is the point of this case rather than an absence of change.
       * Deriving the Object readers did not touch it, because both survivors are outside
       * what that derivation admits: `Object.freeze` is not a reader at all, and
       * `enumerateReadonlyMapEntries` enumerates a `ReadonlyMap`, whose properties are
       * methods rather than data. The audit that removed the plain-data catalog left an
       * operand like that fail-closed, and the reader authority's structural data-only
       * gate keeps it that way. */
      expect(diagnostics.length,).toBe(3,);
      const messages = diagnostics.map(function diagnosticMessage(diagnostic,): string {
        return diagnostic.message;
      },);
      expect(messages.some(function unknownCoercionStaysClosed(message,): boolean {
        return message.startsWith(
          'The function input named "value" is used by these calls: String [',
        );
      },),).toBe(true,);
      expect(messages.some(function frozenPlainDataStaysMutation(message,): boolean {
        return message.startsWith(
          'The function input named "value" is used by these calls: Object.freeze [',
        );
      },),).toBe(true,);
      expect(messages.some(function nonPlainEnumerationStaysClosed(message,): boolean {
        return message.startsWith(
          'The function input named "entriesSource" is used by these calls: Object.entries [',
        );
      },),).toBe(true,);
    },
  },),
  it({
    name: 'keeps owned call paths separate from propagated foreign provenance',
    fn: async () => {
      const diagnostics = await lintReadonly('readonly-foreign-provenance-invalid.ts',);
      expect(diagnostics.length,).toBe(5,);
      const messages = diagnostics.map(function diagnosticMessage(diagnostic,): string {
        return diagnostic.message;
      },);
      expect(messages.filter(function ownedChildDiagnostic(message,): boolean {
        return message.startsWith('Parameter "child" should be readonly',);
      },).length,).toBe(2,);
      expect(messages.some(function boundaryRemainsOwned(message,): boolean {
        return message.startsWith('Parameter "tree" should be readonly',);
      },),).toBe(true,);
      expect(messages.some(function replacementRemainsOpaque(message,): boolean {
        return message.startsWith(
          'The function input named "replacement" is used by these calls: values.with [',
        );
      },),).toBe(true,);
      expect(messages.some(function mixedResultRemainsOwned(message,): boolean {
        return message.startsWith('Parameter "child" should be readonly',);
      },),).toBe(true,);
    },
  },),
  it({
    name: 'keeps state reachable through a member result out of every discharge',
    fn: async () => {
      const diagnostics = await lintReadonly('readonly-member-channel-invalid.ts',);
      const messages = diagnostics.map(function diagnosticMessage(diagnostic,): string {
        return diagnostic.message;
      },);
      expect(messages.length,).toBe(7,);
      /* A channel entry for an iterator member discharges exactly when the iterator
       * yields primitives, and these two are the whole of what it buys on its own.
       * Both loops iterate something whose element type carries no receiver state, so
       * the verified channel is the only outstanding claim and nothing is reported. */
      expect(messages.some(function primitiveKeyIterationStaysSilent(
        message,
      ): boolean {
        return message.includes('entries.keys',);
      },),).toBe(false,);
      expect(messages.some(function indexIterationStaysSilent(message,): boolean {
        return message.includes('values.keys',);
      },),).toBe(false,);
      /* And the two it does not buy, which is why the entries are not the whole
       * answer. `values` hands back what the receiver holds, and `entries` hands back
       * a tuple, an object however primitive its positions are. Both keep reporting,
       * and both would clear only under a relation describing a container whose
       * elements are receiver state. */
      expect(messages.some(function heldValueIterationStaysOpaque(
        message,
      ): boolean {
        return message.includes('entries.values',);
      },),).toBe(true,);
      expect(messages.some(function primitivePairIterationStaysOpaque(
        message,
      ): boolean {
        return message.includes('entries.entries',);
      },),).toBe(true,);
      /* A generic instantiation is not evidence the call built the value. `reduce`
       * returning the accumulator it was handed has result type `string[]` over
       * `string[][]`, a type reference whose only argument is primitive, which the
       * exposure test alone reads as a fresh container of primitives. */
      expect(messages.some(function accumulatorStaysOpaque(message,): boolean {
        return message.startsWith(
          'The function input named "rows" is used as the object for these method calls: rows.reduce [',
        );
      },),).toBe(true,);
      /* An answered receiver claim must not carry the argument analysis with it.
       * `push` answers its receiver completely, a mutation and nothing unresolved,
       * while `replacement` stays reachable through the array afterwards. Widening
       * the discharge to return early puts this diagnostic out. */
      expect(messages.some(function retainedArgumentStaysOpaque(message,): boolean {
        return message.startsWith(
          'The function input named "replacement" is used by these calls: values.push [',
        );
      },),).toBe(true,);
      /* `join` returns a `string`, so the result condition alone would discharge it
       * while it coerces every element. Dropping the verified-channel condition puts
       * this diagnostic out. */
      expect(messages.some(function coercionStaysOpaque(message,): boolean {
        return message.startsWith(
          'The function input named "values" is used as the object for these method calls: values.join [',
        );
      },),).toBe(true,);
      /* `ReadonlyMap.has` reaches no user code and returns a boolean, so the
       * receiver claim is answered and nothing is left to report. Removing that
       * discharge puts a third diagnostic back. */
      expect(messages.some(function statelessResultStaysSilent(message,): boolean {
        return message.includes('entries.has',);
      },),).toBe(false,);
      /* `find` answers what user code runs, its observer being owned, but returns
       * `Labelled | undefined`. A union carries no type arguments, so a species
       * gate reading only those discharged the call and handed back a clean
       * read-only suggestion for an array whose element the body rewrites. */
      expect(messages.some(function observerResultStaysOpaque(message,): boolean {
        return message.startsWith(
          'The function input named "values" is used as the object for these method calls: values.find [',
        );
      },),).toBe(true,);
      /* `at` no longer reports, and that is the hole this rule was carrying rather than
       * a discharge granted on trust. `interiorEscapeEffect` writes through the element
       * `values.at(0)` hands back, and result provenance now tracks that element as
       * receiver state, so the write is recorded against `values` directly. The opacity
       * report existed precisely because nothing tracked the alias; with the alias
       * tracked it is redundant, and `effect-summaries.unit.test.ts` asserts the
       * mutation that replaced it. Removing the escape check in
       * `receiverClaimAnswerable` puts this message back. */
      expect(messages.some(function accessorResultReported(message,): boolean {
        return message.includes('values.at [',);
      },),).toBe(false,);
      /* No collection parameter may be offered as read-only while its elements are
       * rewritten through a result, which is what `values[0].label` mutation already
       * suppresses. The one offer here is on `kept`, an observer parameter whose own
       * elements nothing rewrites, and which cannot be annotated read-only anyway
       * because `reduce` requires the accumulator's own type back. */
      expect(messages.filter(function readonlyOffers(message,): boolean {
        return message.includes('should be readonly',);
      },),).toEqual([
        'Parameter "kept" should be readonly: mutable Array has ReadonlyArray projection.',
      ],);
      /* The indexed control must stay silent: the alias records a mutation of the
       * parameter, so there is nothing to offer and nothing unresolved. Both
       * functions rewrite the same caller-owned row, and for one build they
       * disagreed. */
      expect(messages.some(function indexedControlStaysSilent(message,): boolean {
        return message.includes('indexedElementControlEffect',);
      },),).toBe(false,);
    },
  },),
  it({
    name: 'attributes a member result to its receiver while every sink stays unmodelled',
    fn: async () => {
      /* Where result provenance has reached, measured rather than intended.
       *
       * The resolver now follows a verified member result to its receiver, so an
       * escaping result is attributed: `escapingLookupEffect` reports the
       * `JSON.stringify` its looked-up value reaches, where before it reported the
       * lookup and never named the escape at all.
       *
       * The count has not moved, and that is the design rather than a shortfall.
       * Discharging a receiver's opacity is sound only once every sink a tracked
       * result can reach is attributed or reported, and returns, property stores,
       * container insertions and closure captures are not yet.
       * `doc/decision/prefer-readonly-result-provenance.md` records that ordering. */
      const diagnostics = await lintReadonly('readonly-result-provenance-invalid.ts',);
      const messages = diagnostics.map(function diagnosticMessage(diagnostic,): string {
        return diagnostic.message;
      },);
      /* Five reports and one offer. The count went to seven while the packaged-callable
       * gap was open, since that gap produced offers rather than reports, and back to
       * five once both halves of it landed. Caller-side property matching then added the
       * sixth, which is the offer: `narrowingPrecisionCostEffect` hands `second` to a
       * property its callee only reads, so nothing writes it. */
      expect(messages.length,).toBe(6,);
      /* No offer on a computed-access receiver, which was an unsound suggestion until
       * `memberCallReceiver` gave every consumer one definition of "the receiver".
       * `computedStructureEffect` calls `values['push']('appended')`, and the
       * collection handling, the opaque boundary and the result relation each tested
       * for a property-access callee, so the call fell through all three and nothing
       * recorded the mutation. Applying the resulting offer failed with
       * `error TS7015: Element implicitly has an 'any' type because index expression
       * is not of type 'number'`. Reverting that module restores the offer here. */
      expect(messages.filter(function offersComputedReceiver(message,): boolean {
        return message.startsWith('Parameter "values" should be readonly',);
      },),).toEqual([],);
      /* The computed lookup is visible, and now discharged: its report has moved to the
       * computed `set` that retains a caller-owned value, which is the argument claim
       * rather than the receiver claim. It reported nothing whatsoever before
       * `memberCallReceiver`, summary measured `mutated=[] opaque=[]`. */
      expect(messages.filter(function reportsComputedStore(message,): boolean {
        return message.includes(`facts['set']`,);
      },).length,).toBe(1,);
      /**
       * Counts messages naming one call as the unresolved receiver operation.
       *
       * @param call - Authored member call text.
       *
       * @returns how many diagnostics name it.
       */
      function namingCall(call: string,): number {
        return messages.filter(function namesCall(message,): boolean {
          return message.includes(`method calls: ${call} [`,);
        },).length;
      }
      /* Two `Map.get` receivers left, down from five, and which two is the whole point.
       * A lookup whose result is used only in attributed positions is discharged: the
       * mutation is recorded against the receiver's parameter and the opacity report
       * that stood in for the untracked alias is gone.
       *
       * What remains reports for a reason the tracking does not remove.
       * `returnedLookupEffect` hands its result out of the callable, and until callers
       * substitute through `returnedParameterIndexes` that is a use nothing follows.
       * `boundLookupMutationEffect` keeps a report on its `facts.set`, an argument claim
       * about storing a caller-owned value, not a receiver claim. */
      expect(namingCall('facts.get',),).toBe(1,);
      /* The chained mutation keeps its report for a different reason worth separating:
       * `facts.get(key)?.add('recorded')` discharges the lookup, and the reported call
       * is the `add`, whose own result is the receiver it was called on. That is a
       * distinct relation from "a value the receiver held", nothing in the result
       * authority proves it, and it fails closed rather than being assumed. */
      expect(messages.filter(function reportsChainedAdd(message,): boolean {
        return message.includes('facts.get(key,).add',);
      },).length,).toBe(1,);
      /* Discharged, each verified by a mutation assertion in
       * `effect-summaries.unit.test.ts` rather than by the absence of a message here:
       * the destructured row, the union-valued lookup, and the array element. */
      expect(namingCall('rows.get',),).toBe(0,);
      expect(namingCall('records.get',),).toBe(0,);
      expect(namingCall('values.at',),).toBe(0,);
      /* The one that moved. `escapingLookupEffect` hands its looked-up value to
       * `JSON.stringify`, and the report now names that call rather than the lookup,
       * which is only possible because the value carries `facts` as an origin for the
       * argument analysis to find. Removing the call case from
       * `provenanceSuccessors` puts this back to naming `facts.get`. */
      expect(messages.filter(function namesEscape(message,): boolean {
        return message.includes('JSON.stringify',);
      },).length,).toBe(1,);
      /* No lookup receiver is offered read-only yet, not even `readOnlyLookupEffect`'s,
       * which only reads: that awaits the discharge, not the attribution. `rows` belongs
       * here too, since a discharged `at` result was the second route to the
       * contract-name defect. `row` is deliberately absent from this filter: the offers
       * this fixture still emits name a parameter called `row`, and they are pinned as a
       * set immediately below rather than folded into a claim about lookup receivers. */
      expect(messages.filter(function offersLookupReceiver(message,): boolean {
        return message.includes('"facts" should be readonly',)
          || message.includes('"records" should be readonly',)
          || message.includes('"rows" should be readonly',);
      },),).toEqual([],);
      /* Every offer in the fixture, and there is one. Four defects surfaced here as an
       * offer and each is gone: `row` through a contract-omitted property with no lookup
       * involved, `rows` through a discharged `at` result, and
       * `methodReturnPackagedEffect` and `arrowReturnPackagedEffect` through a callable
       * they package for the callee to call. `effect-summaries.unit.test.ts` carries the
       * written-parameter assertions that keep this list from being vacuous, since a
       * fixture nothing linted would satisfy an empty one too.
       *
       * The surviving offer is a recovery rather than a defect. `second` reaches
       * `mutateOnlyNamedRow` through the `unnamed` property, whose only use in that body
       * is reading `unnamed.label`, so no write reaches `second` at all. It appeared when
       * the call edge stopped repeating an argument's whole origin set on every property
       * slot the callee reads. Reverting `effect-argument-properties.ts` empties this
       * list again, and `narrowingPrecisionCostEffect` goes back to reporting both
       * parameters written in `effect-summaries.unit.test.ts`. */
      expect(messages.filter(function offersAnyParameter(message,): boolean {
        return message.includes('should be readonly',);
      },),).toEqual([
        'Parameter "second" should be readonly: property label is writable.',
      ],);
    },
  },),
  it({
    name: 'still offers a written parameter for two measured call-edge shapes',
    fn: async () => {
      /* A ledger, not an approval. Every offer counted here except three names a
       * parameter some callee writes, and each is tracked as its own task with the
       * machinery it needs. Pinning them keeps the count from drifting quietly in either
       * direction: a fix has to lower it deliberately, and a regression raises it.
       *
       * Sound and staying: `first`, which `mutateSecond` only reads; `value`, which
       * `store` only stores; and one `row`, which `Reader.use` only reads.
       *
       * Unsound, by parameter and cause:
       * `row` in `setterPairEffect`, whose callee assigns through a setter that writes the
       * assigned value.
       * `row` in `polymorphicEffect`, where static resolution finds a reading base method
       * and the reachable override writes.
       *
       * Two shapes from the same review do not reproduce and have no offer here: a mixed
       * method-and-direct effect, which the packaged-callable scan covers, and a getter
       * body writing a captured parameter, which the caller's own direct-write scan
       * catches because the accessor body sits in the caller's scope. */
      const diagnostics = await lintReadonly('readonly-call-edge-invalid.ts',);
      const messages = diagnostics.map(function diagnosticMessage(diagnostic,): string {
        return diagnostic.message;
      },);
      /**
       * Counts offers naming one parameter.
       *
       * @param parameterName - Authored parameter name.
       *
       * @returns how many offers name it.
       */
      function offersFor(parameterName: string,): number {
        return messages.filter(function offersParameter(message,): boolean {
          return message.startsWith(`Parameter "${parameterName}" should be readonly`,);
        },).length;
      }
      /* Four, down from five, and `row` twice rather than three times, because
       * `polymorphicEffect` stopped offering. Its call resolves against the declared receiver
       * type to `Reader.use`, which only reads, while `Writer.use` overrides it and writes. A
       * call to an instance method a subclass may override is now unresolved, so both its
       * receiver and its row take opacity instead. Reverting
       * `effect-overridable-method.ts` restores the offer. */
      expect(messages.filter(function isOffer(message,): boolean {
        return message.includes('should be readonly',);
      },).length,).toBe(4,);
      expect(offersFor('row',),).toBe(2,);
      expect(offersFor('first',),).toBe(1,);
      expect(offersFor('value',),).toBe(1,);
      /* The seven shapes already fixed, kept as the controls that stop this case from
       * passing on a fixture the rule never reached. An explicit `this` parameter shifting
       * every later formal index. A parameter named only by a shorthand inside an accessor
       * body. A rest formal collecting a later actual, and one spread actual covering two
       * formals, both breaking the relation between argument position and formal index. A
       * default aliasing an earlier formal, from both sides. A write reached from a
       * parameter initializer rather than a body. Reverting any of them raises the counts
       * above, and reverting the default-alias work also restores a `primary` offer. */
      expect(offersFor('handler',),).toBe(0,);
      expect(offersFor('primary',),).toBe(0,);
    },
  },),
  it({
    name: 'credits a reassigned alias with every parameter it can hold',
    fn: async () => {
      const diagnostics = await lintReadonly('readonly-binding-origin-invalid.ts',);
      const messages = diagnostics.map(function diagnosticMessage(diagnostic,): string {
        return diagnostic.message;
      },);
      /* The whole expected set, pinned rather than probed by absence. Every other
       * claim in this case is that some parameter is *not* offered, which a fixture
       * nothing linted would satisfy too, so `readAliasEffect` is the control that
       * proves the file reached the rule. Measured with `registerBindingOrigin`
       * reverted to overwriting origins and the package rebuilt: this fixture emits
       * three messages instead of one, adding offers for `second` and `shadowed`.
       * The `second` offer is the unsound one, whose annotation fails to compile. */
      expect(messages,).toEqual([
        'Parameter "values" should be readonly: mutable Array has ReadonlyArray projection.',
      ],);
      /* Neither candidate may be offered, because either can be what the alias holds
       * when the mutation runs. Overwriting credits the mutation to whichever branch
       * registered last and offers the other parameter, whose annotation then fails
       * to compile: `Property 'push' does not exist on type 'readonly Labelled[]'`. */
      expect(messages.filter(function offersEitherCandidate(message,): boolean {
        return message.startsWith('Parameter "first" should be readonly',)
          || message.startsWith('Parameter "second" should be readonly',);
      },),).toEqual([],);
      /* Accumulating origins must not slide into crediting every parameter. The
       * control aliases one parameter and one fresh array, so the fresh array
       * contributes no origin and `flag` is never implicated by either function. */
      expect(messages.filter(function offersUnrelatedParameter(message,): boolean {
        return message.includes('"only"',)
          || message.includes('"flag"',);
      },),).toEqual([],);
      /* The accepted cost of being flow-insensitive, pinned so it stays a decision
       * rather than drift. `shadowed` is displaced before the mutation runs and can
       * never be what the alias holds, yet it is credited and loses an offer it
       * deserves. Withholding an offer is the safe direction; the overwrite this
       * replaced made one that did not compile. */
      expect(messages.filter(function offersDisplacedParameter(message,): boolean {
        return message.includes('"shadowed"',);
      },),).toEqual([],);
    },
  },),
  it({
    name: 'reports readonly preference, stale contracts, and unresolved effects',
    fn: async () => {
      const diagnostics = await lintReadonly('readonly-invalid.ts',);
      expect(diagnostics.length,).toBe(11,);
      const messages = diagnostics.map(function diagnosticMessage(diagnostic,): string {
        return diagnostic.message;
      },);
      expect(messages.some(function shouldReadonly(message,): boolean {
        return message.includes('should be readonly',);
      },),).toBe(true,);
      /* Inherited documented uncertainty no longer demands per-level
       * contracts; the boundary contract is the audit. */
      expect(messages.some(function inheritedUncertainty(message,): boolean {
        return message.includes('but lacks its own @mutates contract',);
      },),).toBe(false,);
      expect(messages.some(function staleContract(message,): boolean {
        return message.includes('stale @mutates contract',);
      },),).toBe(true,);
      expect(messages.some(function opacityPreemptsReadonlyShape(message,): boolean {
        return message.includes('claims readonly semantics dishonestly',);
      },),).toBe(false,);
      /* Five, up from four, because `destructuredOpaqueEffect` joined them. Its report used to
       * name both bindings of its one destructured parameter and now names `state` alone,
       * which is the assertion immediately below. */
      expect(messages.filter(function contractedOpacity(message,): boolean {
        return message.startsWith(
          'The function input named "state" is used by these calls: JSON.stringify [',
        );
      },).length,).toBe(5,);
      /** Plain-language uncertainty diagnostic for unsafe JSON serialization. */
      const opaqueMessage = messages.find(function unsafeJson(message,): boolean {
        return message.startsWith(
          'The function input named "state" is used by these calls: JSON.stringify [',
        );
      },);
      if (opaqueMessage === undefined)
        throw new Error('Expected JSON.stringify uncertainty diagnostic.',);
      /* Boundaries carry origin locations and strict proof-preserving remediation. */
      expect(opaqueMessage.includes(
        'src/readonly-invalid.ts:',
      ),).toBe(true,);
      expect(opaqueMessage.includes(
        '\n\nThis rule cannot inspect enough of those calls to know what they might change. They could change the input itself, change an object stored inside it, call a function stored inside it, or arrange for one of those changes to happen later.'
          + '\n\nResolve the call by one of these proof-preserving changes:'
          + '\n1. Include the exact repository-owned implementation in the nearest tsconfig.json so the rule can inspect it.'
          + '\n2. Pass only primitive values or a separately verified isolated snapshot that shares no caller-owned identity or capability.'
          + '\n3. Remove or replace the call so no caller-owned input reaches unresolved code.'
          + '\n4. After source and source-map inference are exhausted, mark exact runtime-owned host input as ForeignHostCapability and document its possible effects with @mutates.'
          + '\n\nAn @mutates block alone documents known effects but cannot make an unresolved implementation safe.',
      ),).toBe(true,);
      /* `destructuredOpaqueEffect({ state, label })` calls `JSON.stringify({ state, label })`,
       * and `label` is a `string`. A primitive cannot carry the state an unresolved call might
       * change, so naming it in the report told the reader to look at something that could not
       * be the problem. It was named because both bindings shared one parameter index, which
       * `ST9` makes the ordinary shape rather than an unusual one: the report could only name
       * every binding of the parameter or none.
       *
       * Now the opacity is recorded against `state`'s own slot and the report says so.
       * `effect-affected-bindings.ts` is what turns that slot fact into a name, and removing it
       * puts `label` back. */
      expect(messages.some(function namesPrimitiveSibling(message,): boolean {
        return message.startsWith(
          'The function inputs named "state" and "label" are used by these calls: JSON.stringify [',
        );
      },),).toBe(false,);
      /** Method-specific diagnostic explaining state changes without assignment. */
      const methodMessage = messages.find(function unknownMethod(message,): boolean {
        return message.startsWith(
          'The function input named "service" is used as the object for these method calls: service.write [',
        );
      },);
      if (methodMessage === undefined)
        throw new Error('Expected unknown method diagnostic.',);
      expect(methodMessage.includes(
        'A method can change data stored inside its object or in the system that object controls, even when this code never assigns a new value to the input.',
      ),).toBe(true,);
      /** Opaque call remains rejected despite unrelated authored contract. */
      const incompleteContractMessage = messages.find(function unrelatedLinkContract(message,): boolean {
        return message.startsWith(
          'The function input named "state" is used by these calls: opaqueExternalMutation [',
        );
      },);
      if (incompleteContractMessage === undefined)
        throw new Error('Expected incomplete-contract uncertainty diagnostic.',);
      expect(incompleteContractMessage.includes(
        'An @mutates block alone documents known effects but cannot make an unresolved implementation safe.',
      ),).toBe(true,);
      /** Global String remains an ordinary unresolved bodyless host call. */
      const stringMessage = messages.find(function stringCoercion(message,): boolean {
        return message.startsWith(
          'The function input named "error" is used by these calls: String [',
        );
      },);
      if (stringMessage === undefined)
        throw new Error('Expected global String object coercion diagnostic.',);
      expect(stringMessage.includes(
        'An @mutates block alone documents known effects but cannot make an unresolved implementation safe.',
      ),).toBe(true,);
      expect(messages.some(function incompleteStringContract(message,): boolean {
        return message.startsWith(
          'The function input named "incomplete" is used by these calls: String [',
        );
      },),).toBe(true,);
    },
  },),
  it({
    name: 'does not identify same-named external callable as global String',
    fn: async () => {
      const diagnostics = await lintReadonly('readonly-string-lookalike-invalid.ts',);
      expect(diagnostics.length,).toBe(1,);
      expect(diagnostics[0]?.message.startsWith(
        'The function input named "value" is used by these calls: String [',
      ),).toBe(true,);
      expect(diagnostics[0]?.message.includes(
        'passed to global String',
      ),).toBe(false,);
    },
  },),
  it({
    name: 'reports overload contracts whose union differs from implementation effects',
    fn: async () => {
      const diagnostics = await lintReadonly('readonly-overload-invalid.ts',);
      expect(diagnostics.length,).toBe(1,);
      expect(diagnostics[0]?.message,).toBe(
        'Mutation contracts disagree across callable signatures.',
      );
    },
  },),
  it({
    name: 'suggests readonly arrays only through explicit suggestion fixes',
    fn: async () => {
      /** Source with deeply projectable primitive array parameter. */
      const source = `/**\n * Reads values.\n *\n * @param values - Values read without mutation.\n */\nexport function countValues(values: string[],): number {\n  return values.length;\n}\n`;
      const ordinarilyFixed = await fixReadonlyGeneratedSource({
        source,
        fixSuggestions: false,
      },);
      expect(ordinarilyFixed.includes('values: string[]',),).toBe(true,);
      const suggestionFixed = await fixReadonlyGeneratedSource({
        source,
        fixSuggestions: true,
      },);
      expect(suggestionFixed.includes('values: readonly string[]',),).toBe(true,);
    },
  },),
  it({
    name: 'suggests standard ReadonlyArray owner for readonly reachable types',
    fn: async () => {
      /** Source with standard mutable Array type reference. */
      const source = '/** Reads array. @param values - Values. */\nexport function read(values: Array<string>,): number { return values.length; }\n';
      const ordinarilyFixed = await fixReadonlyGeneratedSource({
        source,
        fixSuggestions: false,
      },);
      expect(ordinarilyFixed.includes('Array<string>',),).toBe(true,);
      const suggestionFixed = await fixReadonlyGeneratedSource({
        source,
        fixSuggestions: true,
      },);
      expect(suggestionFixed.includes('ReadonlyArray<string>',),).toBe(true,);
    },
  },),
  it({
    name: 'suggests imported type-fest ReadonlyDeep for structural data only explicitly',
    fn: async () => {
      /** Source with mutable nested data and aliased type-fest import. */
      const source = `import type { ReadonlyDeep as DeepReadonly, } from 'type-fest';

/**
 * Reads nested state.
 *
 * @param state - Nested state read without mutation.
 */
export function readNested(state: { nested: { value: string; }; },): string {
  return state.nested.value;
}
`;
      const ordinarilyFixed = await fixReadonlyGeneratedSource({
        source,
        fixSuggestions: false,
      },);
      expect(ordinarilyFixed.includes('state: { nested:',),).toBe(true,);
      const suggestionFixed = await fixReadonlyGeneratedSource({
        source,
        fixSuggestions: true,
      },);
      expect(suggestionFixed.includes('state: DeepReadonly<{ nested:',),).toBe(true,);
    },
  },),
  it({
    name: 'keeps stale contracts under ordinary fix and removes them through suggestions',
    fn: async () => {
      /** Source with one semantically stale mutation block. */
      const source = `/**\n * Reads signal.\n *\n * @param controller - Capability read only.\n *\n * @mutates controller - Claims absent transition.\n */\nexport function readSignal(controller: AbortController,): AbortSignal {\n  return controller.signal;\n}\n`;
      const ordinarilyFixed = await fixReadonlyGeneratedSource({
        source,
        fixSuggestions: false,
      },);
      expect(ordinarilyFixed.includes('@mutates controller',),).toBe(true,);
      const suggestionFixed = await fixReadonlyGeneratedSource({
        source,
        fixSuggestions: true,
      },);
      expect(suggestionFixed.includes('@mutates controller',),).toBe(false,);
    },
  },),
],
},);

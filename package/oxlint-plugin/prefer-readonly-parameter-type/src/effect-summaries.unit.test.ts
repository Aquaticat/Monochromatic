import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import { fileURLToPath, } from 'node:url';

import spawn from 'nano-spawn';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { isFunctionLikeDeclaration, } from 'typescript/unstable/ast/is';

import {
  asParameterIndex,
  buildEffectSummaryIndex,
  clearEffectSummaryCache,
  clearFinalEffectIndexCache,
  closeSemanticBridge,
  effectSummaryCacheStats,
  finalEffectIndexCacheStats,
  NO_EFFECT_SUMMARY,
  openSemanticFile,
  SemanticBridgeError,
} from '../dist/final/node/index.mjs';

/** Effect summary semantic fixture. */
const FIXTURE_PATH = fileURLToPath(new URL(
  '../../../test-fixture/oxlint-no-restricted-syntax/src/valid/typescript-sync-adapter.ts',
  import.meta.url,
),);

/** Second configured source used to verify cross-file final-index reuse. */
const HELPER_PATH = fileURLToPath(new URL(
  '../../../test-fixture/oxlint-no-restricted-syntax/src/valid/semantic-effects-helper.ts',
  import.meta.url,
),);

/** Fixture whose functions reach caller state through member call results. */
const RESULT_PROVENANCE_PATH = fileURLToPath(new URL(
  '../../../test-fixture/oxlint-no-restricted-syntax/src/readonly-result-provenance-invalid.ts',
  import.meta.url,
),);

/** Current result-provenance fixture text. */
const RESULT_PROVENANCE_SOURCE = readFileSync(
  RESULT_PROVENANCE_PATH,
  'utf8',
);

/** Fixture storing a member result beyond the callable that produced it. */
const ASSIGNMENT_STORE_PATH = fileURLToPath(new URL(
  '../../../test-fixture/oxlint-no-restricted-syntax/src/readonly-assignment-store-invalid.ts',
  import.meta.url,
),);

/** Current assignment-store fixture text. */
const ASSIGNMENT_STORE_SOURCE = readFileSync(
  ASSIGNMENT_STORE_PATH,
  'utf8',
);

/** Fixture placing alias hops between a member result and its escaping position. */
const ALIAS_HOP_PATH = fileURLToPath(new URL(
  '../../../test-fixture/oxlint-no-restricted-syntax/src/readonly-alias-hop-invalid.ts',
  import.meta.url,
),);

/** Current alias-hop fixture text. */
const ALIAS_HOP_SOURCE = readFileSync(
  ALIAS_HOP_PATH,
  'utf8',
);

/** Fixture storing structural parameter state beyond the callable that read it. */
const STRUCTURAL_STORE_PATH = fileURLToPath(new URL(
  '../../../test-fixture/oxlint-no-restricted-syntax/src/readonly-structural-store-invalid.ts',
  import.meta.url,
),);

/** Current structural-store fixture text. */
const STRUCTURAL_STORE_SOURCE = readFileSync(
  STRUCTURAL_STORE_PATH,
  'utf8',
);

/** Fixture writing caller state through a callee's returned parameter. */
const RETURN_SUBSTITUTION_PATH = fileURLToPath(new URL(
  '../../../test-fixture/oxlint-no-restricted-syntax/src/readonly-return-substitution-invalid.ts',
  import.meta.url,
),);

/** Current return-substitution fixture text. */
const RETURN_SUBSTITUTION_SOURCE = readFileSync(
  RETURN_SUBSTITUTION_PATH,
  'utf8',
);

/** Statusline source proving audited object-property callback invocation. */
const STATUSLINE_USAGE_PATH = fileURLToPath(new URL(
  '../../../pi-plugin/statusline/src/usage-warning.ts',
  import.meta.url,
),);

/** Current statusline usage source text. */
const STATUSLINE_USAGE_SOURCE = readFileSync(
  STATUSLINE_USAGE_PATH,
  'utf8',
);

/** Built package entry exercised by independent process probe. */
const BUILT_ENTRY_URL = new URL(
  '../dist/final/node/index.mjs',
  import.meta.url,
).href;

/** Current effect fixture text. */
const SOURCE = readFileSync(
  FIXTURE_PATH,
  'utf8',
);

/** Disposable persistent cache directory. */
type DisposableCacheDirectory = {
  readonly path: string;
  readonly [Symbol.dispose]: () => void;
};

/**
 * Creates disposable persistent cache root.
 *
 * @returns cache directory removed after test scope.
 */
function disposableCacheDirectory(): DisposableCacheDirectory {
  const path = mkdtempSync(join(tmpdir(), 'readonly-effect-cache-',),);
  return {
    path,
    [Symbol.dispose](): void {
      rmSync(path, { recursive: true, force: true, },);
    },
  };
}

await describe({
  name: buildEffectSummaryIndex.name,
  concurrency: 1,
  children: [
    it({
      name: 'records audited object-property callback invocation as resolved while an unresolved reader stays reported',
      fn: async () => {
        const session = openSemanticFile({
          fileName: STATUSLINE_USAGE_PATH,
          sourceText: STATUSLINE_USAGE_SOURCE,
          hasBOM: false,
        },);
        const index = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
        },);
        const nameNode = session.nodeAtOffset(
          STATUSLINE_USAGE_SOURCE.indexOf('function formatUsageWarningStatus',)
            + 'function '.length,
        );
        const declaration = nameNode.parent;
        if (!isFunctionLikeDeclaration(declaration,))
          throw new Error('Expected statusline usage function declaration.',);
        const summary = index.get(declaration,);
        if (summary === NO_EFFECT_SUMMARY)
          throw new Error('Expected statusline usage effect summary.',);
        /** Invocation indexes retained before bridge cleanup. */
        const invoked = [...summary.invokedParameterIndexes,];
        /** Unresolved indexes retained before bridge cleanup. */
        const opaque = [...summary.opaqueParameterIndexes,];
        closeSemanticBridge();
        /* Style-callback invocation now proves inside the analyzed workspace
         * callee instead of an audited caller-side catalog marking. */
        expect(invoked,).toEqual([],);
        /* Unresolved reachability, and honest. `parseRateLimitSnapshots` reaches
         * `Object.entries` in `rate-limit-parse-helpers.ts`, which nothing derives, and
         * this callable packages its own parameter into that call. The claim used to
         * read `[]` because the owned call edge walked the argument literal with only
         * the property names the callee's `@mutates` blocks listed, so an authored
         * comment decided which caller-owned values inherited the callee's opacity.
         * Removing that filter is what makes this report appear, and the accompanying
         * offers it withdrew are the ones measured in
         * `doc/decision/prefer-readonly-contract-name-narrowing.md`. Deriving the
         * `Object` readers is what would return this to `[]` on proof rather than on
         * an omitted name. */
        expect(opaque,).toEqual([0,],);
      },
    },),
    it({
      name: 'attributes a mutation reached through a verified member result to its receiver',
      fn: async () => {
        /* The diagnostic-level tests cannot see this. A parameter mutated through a
         * call result also still carries that call's receiver opacity, and opacity
         * dominates the message, so the fixture emits the same count whether
         * attribution works or not. Only the summary distinguishes them. */
        const session = openSemanticFile({
          fileName: RESULT_PROVENANCE_PATH,
          sourceText: RESULT_PROVENANCE_SOURCE,
          hasBOM: false,
        },);
        const index = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
        },);
        /**
         * Reads the written parameter indexes of one fixture function.
         *
         * Reads `referentMutatedParameterIndexes`, the set the readonly offer is gated
         * on, rather than `mutatedParameterIndexes`, which is its union with the invoked
         * set. Measured: the two agree for every function this case names, so the switch
         * changed no expectation here. It matters because they do not always agree, and
         * a case reading `referentMutated=[]` while the union reads `[0]` is a parameter
         * that will be offered readonly the moment its opacity is discharged.
         *
         * @param functionName - Exported fixture function to inspect.
         *
         * @returns written parameter indexes in ascending order.
         */
        function mutatedIndexes(functionName: string,): readonly number[] {
          const nameNode = session.nodeAtOffset(
            RESULT_PROVENANCE_SOURCE.indexOf(`function ${functionName}`,)
              + 'function '.length,
          );
          const declaration = nameNode.parent;
          if (!isFunctionLikeDeclaration(declaration,))
            throw new Error(`Expected a declaration for ${functionName}.`,);
          const summary = index.get(declaration,);
          if (summary === NO_EFFECT_SUMMARY)
            throw new Error(`Expected an effect summary for ${functionName}.`,);
          /* Explicit numeric compare, since the default sort is lexicographic and
           * would order parameter 10 before parameter 2. */
          return [...summary.referentMutatedParameterIndexes,]
            .toSorted(function byIndex(left: number, right: number,): number {
              return left - right;
            },);
        }
        /**
         * Reads the returned parameter origins of one fixture function.
         *
         * @param functionName - Exported fixture function to inspect.
         *
         * @returns returned parameter indexes in ascending order.
         */
        function returnedIndexes(functionName: string,): readonly number[] {
          const nameNode = session.nodeAtOffset(
            RESULT_PROVENANCE_SOURCE.indexOf(`function ${functionName}`,)
              + 'function '.length,
          );
          const declaration = nameNode.parent;
          if (!isFunctionLikeDeclaration(declaration,))
            throw new Error(`Expected a declaration for ${functionName}.`,);
          const summary = index.get(declaration,);
          if (summary === NO_EFFECT_SUMMARY)
            throw new Error(`Expected an effect summary for ${functionName}.`,);
          return [...summary.returnedParameterIndexes,]
            .toSorted(function byIndex(left: number, right: number,): number {
              return left - right;
            },);
        }
        /** Mutation through a bound lookup result. */
        const bound = mutatedIndexes('boundLookupMutationEffect',);
        /** Mutation through a lookup result with no binding at all. */
        const chained = mutatedIndexes('chainedLookupMutationEffect',);
        /** Property write through an element obtained by `at`. */
        const element = mutatedIndexes('chainedElementWriteEffect',);
        /** Mutation through a lookup narrowed by a runtime-erased assertion. */
        const asserted = mutatedIndexes('assertedLookupMutationEffect',);
        /** Mutation through a lookup whose value type is a union of object types. */
        const unionValued = mutatedIndexes('unionValueLookupEffect',);
        /** Restructuring reached through a computed member call. */
        const computedStructure = mutatedIndexes('computedStructureEffect',);
        /** Mutation through a computed lookup, invisible before one receiver rule. */
        const computedLookup = mutatedIndexes('computedLookupMutationEffect',);
        /** Function that only reads what it looks up. */
        const readOnly = mutatedIndexes('readOnlyLookupEffect',);
        closeSemanticBridge();
        /* Each names parameter 0, the collection the result came from. Dropping the
         * call branch from `provenanceSuccessors` empties all three while leaving
         * every diagnostic count in the sibling fixture test unchanged, which is why
         * this assertion exists rather than a message-level one. */
        expect(bound,).toEqual([0,],);
        expect(chained,).toEqual([0,],);
        expect(element,).toEqual([0,],);
        /* `as` erases at runtime, so the asserted value is the lookup's own. Dropping
         * assertion expressions from `transparentOperand` empties this one. */
        expect(asserted,).toEqual([0,],);
        /* The union-valued receiver. Its held position is `Labelled | Tagged` as one
         * type object while the result flattens to both plus absence, so comparing
         * only flattened result constituents against the unflattened held type found
         * nothing. Measured: flattening one side only empties this while leaving every
         * other case here passing. */
        expect(unionValued,).toEqual([0,],);
        /* The destructured extraction, asserted here because its diagnostic is gone:
           the lookup discharged once every use of the row was attributed, so only the
           summary shows the mutation that replaced the report. */
        expect(mutatedIndexes('destructuredLookupMutationEffect',),).toEqual([0,],);
        /* Computed member access records the same facts as property access, because
         * which of the two the author wrote has no runtime bearing on what receives
         * the call. Both were entirely unrecorded before `memberCallReceiver`, and
         * `computedStructureEffect` was offered `readonly` while pushing to its
         * parameter. */
        expect(computedStructure,).toEqual([0,],);
        expect(computedLookup,).toEqual([0,],);
        /* And the control stays empty, so the resolver is not crediting every lookup
         * with a mutation it never performed. */
        expect(readOnly,).toEqual([],);
        /* Returning parameter-reachable state is recorded as a returned origin rather
         * than as an effect, per the accepted policy: the caller already holds the
         * parameter, so handing back a piece of it grants nothing new. The fact exists
         * so a caller can keep tracking the value, which is what makes the policy
         * sound; no discharge may rest on it until callers substitute through it. */
        expect(returnedIndexes('returnedLookupEffect',),).toEqual([0,],);
        /* A function returning nothing parameter-derived records nothing, so the fact
         * is not simply "every callable returns something". */
        expect(returnedIndexes('readOnlyLookupEffect',),).toEqual([],);
      },
    },),
    it({
      name: 'keeps receiver opacity for a member result stored beyond the callable, and discharges a local transfer',
      fn: async () => {
        /* The store cases were offered `readonly` before `assignmentStoreEscapes`. Every
         * caller of `useEscapes` hands it `valueConsumer` of the node, that ascends the
         * right operand of an assignment, and so the branch written to classify a store
         * could never receive one: `sink.value = rows.at(0,)` arrived as the assignment
         * expression, whose parent is an `ExpressionStatement`, and was discarded as
         * consumed in place. Measured by rebuilding at the prior commit, where all four
         * cases below are offered.
         *
         * The controls carry the other half. Classifying every assignment as a store
         * would report `assignToLocal` too, and a local transfer keeps the value inside
         * the body where the holder set is responsible for it. */
        const session = openSemanticFile({
          fileName: ASSIGNMENT_STORE_PATH,
          sourceText: ASSIGNMENT_STORE_SOURCE,
          hasBOM: false,
        },);
        const index = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
        },);
        /**
         * Reads the opaque parameter indexes of one fixture function.
         *
         * @param functionName - Exported fixture function to inspect.
         *
         * @returns opaque parameter indexes in ascending order.
         */
        function opaqueIndexes(functionName: string,): readonly number[] {
          /**
           * Name node of the requested fixture declaration.
           */
          const nameNode = session.nodeAtOffset(
            ASSIGNMENT_STORE_SOURCE.indexOf(`function ${functionName}`,)
              + 'function '.length,
          );
          /**
           * Declaration owning that name.
           */
          const declaration = nameNode.parent;
          if (!isFunctionLikeDeclaration(declaration,))
            throw new Error(`Expected a declaration for ${functionName}.`,);
          /**
           * Effect summary for that declaration.
           */
          const summary = index.get(declaration,);
          if (summary === NO_EFFECT_SUMMARY)
            throw new Error(`Expected an effect summary for ${functionName}.`,);
          return [...summary.opaqueParameterIndexes,]
            .toSorted(function byIndex(left: number, right: number,): number {
              return left - right;
            },);
        }
        /** Store into a caller-owned property. */
        const property = opaqueIndexes('storeIntoProperty',);
        /** Store into a caller-owned element position. */
        const element = opaqueIndexes('storeIntoElement',);
        /** Assignment to a plain local, which stays inside the callable. */
        const local = opaqueIndexes('assignToLocal',);
        /** Result consumed in place, never bound. */
        const inPlace = opaqueIndexes('readInPlace',);
        /** Store into a binding declared outside every callable body. */
        const moduleBinding = opaqueIndexes('storeIntoModuleBinding',);
        closeSemanticBridge();
        /* The receiver keeps its opacity, because nothing follows the stored element. */
        expect(property,).toEqual([0,],);
        expect(element,).toEqual([0,],);
        /* The module target is the one this classification most needed to cover, and it
         * threw instead. `targetIsCallableLocal` walks the target's declaration toward the
         * body, a module binding's ascent runs past the source file, and that file's
         * `parent` is `undefined` while `Node` types it as present. The demand index caught
         * the throw and omitted the callable, so this read `NO_EFFECT_SUMMARY` rather than
         * any verdict. Restoring the self-reference-only guard reproduces that. */
        expect(moduleBinding,).toEqual([0,],);
        /* And the controls stay discharged. Removing the locality test from
         * `targetIsCallableLocal`, so that every assignment target counts as a store,
         * turns `local` into `[0]` while leaving both cases above passing. */
        expect(local,).toEqual([],);
        expect(inPlace,).toEqual([],);
      },
    },),
    it({
      name: 'records what the escape test currently sees for a structural store, before that changes',
      fn: async () => {
        /* A characterization, not a specification. Seven of these callables hand a piece
         * of a caller-owned structure to a binding that outlives the call, and one of them
         * is caught. That one is caught incidentally: only a verified member call carries
         * receiver opacity, and discharging receiver opacity is the sole trigger for the
         * escape test, so an index read, a property read, an alias hop, a logical
         * assignment, an iteration binding and a nested store never reach it.
         *
         * On the structural path this is a false offer rather than an imprecision. The
         * rule's own `--fix-suggestions --fix` writes `ReadonlyDeep<Config>` onto them,
         * the annotated file type-checks clean under TypeScript 7.0.2, and driving it
         * changes the caller's own `config.row.label` through the escaped reference.
         * Measured in `doc/planning/prefer-readonly-return-substitution.md`, section
         * "A third false offer, on a store into a module binding".
         *
         * The five reads carry the other half, and they are why this is pinned before the
         * classification widens. Reporting an assignment because its target is not
         * declared inside the body would take `assignIntoParameter` with it, since a
         * parameter's declaration sits beside the body rather than inside it, and would
         * take `countIntoModuleBinding` too, since a primitive stored beyond the callable
         * grants nothing. */
        const session = openSemanticFile({
          fileName: STRUCTURAL_STORE_PATH,
          sourceText: STRUCTURAL_STORE_SOURCE,
          hasBOM: false,
        },);
        const index = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
        },);
        /**
         * Reads the opaque parameter indexes of one structural-store fixture function.
         *
         * @param functionName - Exported fixture function to inspect.
         *
         * @returns opaque parameter indexes in ascending order.
         */
        function structuralOpaque(functionName: string,): readonly number[] {
          /**
           * Name node of the requested fixture declaration.
           */
          const nameNode = session.nodeAtOffset(
            STRUCTURAL_STORE_SOURCE.indexOf(`function ${functionName}`,)
              + 'function '.length,
          );
          /**
           * Declaration owning that name.
           */
          const declaration = nameNode.parent;
          if (!isFunctionLikeDeclaration(declaration,))
            throw new Error(`Expected a declaration for ${functionName}.`,);
          /**
           * Effect summary for that declaration.
           */
          const summary = index.get(declaration,);
          if (summary === NO_EFFECT_SUMMARY)
            throw new Error(`Expected an effect summary for ${functionName}.`,);
          return [...summary.opaqueParameterIndexes,]
            .toSorted(function byIndex(left: number, right: number,): number {
              return left - right;
            },);
        }
        /** Indexed element stored into a module binding. */
        const storedElement = structuralOpaque('storeElementIntoModuleBinding',);
        /** Member result stored into a module binding. */
        const storedMember = structuralOpaque('storeMemberIntoModuleBinding',);
        /** Plain property stored into a module binding. */
        const storedProperty = structuralOpaque('storePropertyIntoModuleBinding',);
        /** Property stored after an alias hop. */
        const storedAlias = structuralOpaque('storeAliasedIntoModuleBinding',);
        /** Property stored through a logical assignment. */
        const storedLogical = structuralOpaque('storeThroughLogicalAssignment',);
        /** Iteration binding stored into a module binding. */
        const storedIteration = structuralOpaque('storeIterationBinding',);
        /** Property stored into a local of the enclosing callable. */
        const storedEnclosing = structuralOpaque('storeIntoEnclosingLocal',);
        /** Property assigned to another parameter. */
        const intoParameter = structuralOpaque('assignIntoParameter',);
        /** Property assigned to a local the callable declares. */
        const intoOwnLocal = structuralOpaque('assignIntoOwnLocal',);
        /** Primitive accumulated into a module binding. */
        const intoCount = structuralOpaque('countIntoModuleBinding',);
        /** Structure read in place without binding. */
        const readInPlaceOnly = structuralOpaque('readStructureInPlace',);
        /** Rows iterated while reading only primitives. */
        const iterated = structuralOpaque('iterateStructureRows',);
        closeSemanticBridge();
        /* The one shape a discharge decision happens to cover. */
        expect(storedMember,).toEqual([0,],);
        /* Every other store, currently silent, and each one a false offer. Flipping these
         * to `[0,]` is what the classification has to achieve. */
        expect(storedElement,).toEqual([],);
        expect(storedProperty,).toEqual([],);
        expect(storedAlias,).toEqual([],);
        expect(storedLogical,).toEqual([],);
        expect(storedIteration,).toEqual([],);
        expect(storedEnclosing,).toEqual([],);
        /* The controls, which must still read empty after that flip. */
        expect(intoParameter,).toEqual([],);
        expect(intoOwnLocal,).toEqual([],);
        expect(intoCount,).toEqual([],);
        expect(readInPlaceOnly,).toEqual([],);
        expect(iterated,).toEqual([],);
      },
    },),
    it({
      name: 'attributes a write reaching caller state through a callee returned parameter, at any depth',
      fn: async () => {
        /* `directReturned` recorded which parameters a result can carry from the day the
         * accepted decision asked for it, and nothing consumed the fact, so every case
         * here was offered `readonly Row[]`. The offer was false rather than imprecise:
         * applying it to `growThroughReturn` type-checked under TypeScript 7.0.2 and
         * running it grew the caller's array. Measured in
         * `doc/planning/prefer-readonly-return-substitution.md`, section "A second false
         * offer, on the array path".
         *
         * The fresh control is the half that keeps this honest. A callee allocating its
         * own array shares no identity with its argument, so attributing a write through
         * that result would withhold an offer that is true. It is written without `map`
         * deliberately: a caller-supplied callback opens an opaque boundary of its own,
         * and a control withheld for the wrong reason discriminates nothing. */
        const session = openSemanticFile({
          fileName: RETURN_SUBSTITUTION_PATH,
          sourceText: RETURN_SUBSTITUTION_SOURCE,
          hasBOM: false,
        },);
        const index = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
        },);
        /**
         * Reads one fixture function's summary.
         *
         * @param functionName - Exported or local fixture function to inspect.
         *
         * @returns effect summary for that declaration.
         */
        function summaryOf(functionName: string,) {
          /**
           * Name node of the requested fixture declaration.
           */
          const nameNode = session.nodeAtOffset(
            RETURN_SUBSTITUTION_SOURCE.indexOf(`function ${functionName}`,)
              + 'function '.length,
          );
          /**
           * Declaration owning that name.
           */
          const declaration = nameNode.parent;
          if (!isFunctionLikeDeclaration(declaration,))
            throw new Error(`Expected a declaration for ${functionName}.`,);
          /**
           * Effect summary for that declaration.
           */
          const summary = index.get(declaration,);
          if (summary === NO_EFFECT_SUMMARY)
            throw new Error(`Expected an effect summary for ${functionName}.`,);
          return summary;
        }
        /**
         * Reads the written parameter indexes of one fixture function.
         *
         * Reads `referentMutatedParameterIndexes` rather than the union with the invoked
         * set, because the readonly offer is gated on that set alone.
         *
         * @param functionName - Fixture function to inspect.
         *
         * @returns written parameter indexes in ascending order.
         */
        function writtenIndexes(functionName: string,): readonly number[] {
          return [...summaryOf(functionName,)
            .referentMutatedParameterIndexes,]
            .toSorted(function byIndex(left: number, right: number,): number {
              return left - right;
            },);
        }
        /** One returning callable between the write and the caller's array. */
        const oneHop = writtenIndexes('growThroughReturn',);
        /** Two returning callables, which only the fixed point can follow. */
        const twoHops = writtenIndexes('growThroughTwoReturns',);
        /** A freshly allocated array the caller does not own. */
        const fresh = writtenIndexes('growFresh',);
        /** The same write with no returning callable between. */
        const direct = writtenIndexes('growDirectly',);
        /** A read through a returning callable, which changes nothing. */
        const read = writtenIndexes('measureThroughReturn',);
        /** A property write through a returned element, which substitution misses today. */
        const propertyWrite = writtenIndexes('writePropertyThroughReturn',);
        /** Returned parameters of the single-hop callable. */
        const handedBack = [...summaryOf('handBack',)
          .returnedParameterIndexes,];
        /** Returned parameters of the callable that returns another's result. */
        const handedBackTwice = [...summaryOf('handBackTwice',)
          .returnedParameterIndexes,];
        /** Returned parameters of the callable allocating its own array. */
        const allocated = [...summaryOf('buildFresh',)
          .returnedParameterIndexes,];
        /** Whether the fresh control carries unresolved reachability instead. */
        const freshOpaque = [...summaryOf('growFresh',)
          .opaqueParameterIndexes,];
        closeSemanticBridge();
        /* The write attributes to the caller's parameter however many returning
         * callables sit between, and the direct case still behaves as it always did. */
        expect(oneHop,).toEqual([0,],);
        expect(twoHops,).toEqual([0,],);
        expect(direct,).toEqual([0,],);
        /* And nothing is attributed through a result the callee allocated.
         *
         * Three mutations, each measured rather than predicted, because the first
         * prediction written here was wrong. Removing the deferred recording in
         * `effect-collection-member-effect.ts` turns `oneHop` and `twoHops` into `[]`
         * while `direct` keeps passing. Removing the deferred recording in the return
         * branch of `direct-effect-summary.ts` turns `twoHops` and `handedBackTwice` into
         * `[]` while `oneHop` keeps passing, which is the transitivity discriminator.
         * Projecting `directReturned` instead of `returned` in `effect-public-summary.ts`
         * turns `handedBackTwice` into `[]` and moves NOTHING else: the substitution reads
         * the propagated set directly, so the projection only decides what callers of the
         * summary API see. */
        expect(fresh,).toEqual([],);
        expect(read,).toEqual([],);
        /* The fresh control must be silent rather than withheld some other way, or it
         * cannot show that substitution declined to attribute. */
        expect(freshOpaque,).toEqual([],);
        expect(handedBack,).toEqual([0,],);
        expect(handedBackTwice,).toEqual([0,],);
        expect(allocated,).toEqual([],);
        /* A boundary, pinned rather than a behaviour defended. The deferred recording
         * sits in the collection-member path, so a property write through a returned
         * element is not reached. Asserting the current empty set means closing that gap
         * fails this line rather than changing behaviour silently, which is the point of
         * writing it down. Whoever closes it should change this to `[0,]` and move the
         * case out of the boundary comment in the fixture. */
        expect(propertyWrite,).toEqual([],);
      },
    },),
    it({
      name: 'keeps receiver opacity across alias hops, and still discharges an alias that only reads',
      fn: async () => {
        /* Every escaping case here was offered `readonly` before the holder set followed
         * aliases: `resultHolderSymbolIds` collected only the identifier the call directly
         * initializes, so `alias` never joined the set and its escaping use was never
         * scanned. The consequence was not confined to precision. Over a structural
         * parameter the rule projects with `ReadonlyDeep`, which does constrain elements,
         * and the offer that followed type-checks clean under TypeScript 7.0.2 while the
         * annotated callable rewrites the caller's state at runtime. Measured end to end
         * in `doc/planning/prefer-readonly-return-substitution.md`, section "A false offer
         * on the structural path".
         *
         * The controls carry the other half, and they are the reason this is not simply a
         * wider net. Enlarging the holder set without skipping declaration and
         * assignment-target occurrences classifies a destructured binding's own name as an
         * escape, because its parent is a `BindingElement` that no attributed position
         * matches, and classifies an assignment target the same way. Either mistake
         * reports every alias in the workspace. */
        const session = openSemanticFile({
          fileName: ALIAS_HOP_PATH,
          sourceText: ALIAS_HOP_SOURCE,
          hasBOM: false,
        },);
        const index = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
        },);
        /**
         * Reads the opaque parameter indexes of one fixture function.
         *
         * @param functionName - Exported fixture function to inspect.
         *
         * @returns opaque parameter indexes in ascending order.
         */
        function opaqueIndexes(functionName: string,): readonly number[] {
          /**
           * Name node of the requested fixture declaration.
           */
          const nameNode = session.nodeAtOffset(
            ALIAS_HOP_SOURCE.indexOf(`function ${functionName}`,)
              + 'function '.length,
          );
          /**
           * Declaration owning that name.
           */
          const declaration = nameNode.parent;
          if (!isFunctionLikeDeclaration(declaration,))
            throw new Error(`Expected a declaration for ${functionName}.`,);
          /**
           * Effect summary for that declaration.
           */
          const summary = index.get(declaration,);
          if (summary === NO_EFFECT_SUMMARY)
            throw new Error(`Expected an effect summary for ${functionName}.`,);
          return [...summary.opaqueParameterIndexes,]
            .toSorted(function byIndex(left: number, right: number,): number {
              return left - right;
            },);
        }
        /** Return reached through one alias hop. */
        const returned = opaqueIndexes('returnAfterAliasHop',);
        /** Module-binding store reached through one alias hop. */
        const stored = opaqueIndexes('storeAfterAliasHop',);
        /** Nested state extracted by destructuring, then returned. */
        const destructured = opaqueIndexes('destructureThenReturn',);
        /** Primitive extracted by destructuring, which can hold no caller state. */
        const primitive = opaqueIndexes('destructurePrimitiveThenReturn',);
        /** Nested state extracted by destructuring, then read in place. */
        const destructuredRead = opaqueIndexes('destructureReadInPlace',);
        /** Alias read in place, never leaving the callable. */
        const readAlias = opaqueIndexes('aliasReadInPlace',);
        /** Alias established by assignment, then read in place. */
        const assignedAlias = opaqueIndexes('assignAliasReadInPlace',);
        closeSemanticBridge();
        /* The receiver keeps its opacity wherever the aliased result can leave. */
        expect(returned,).toEqual([0,],);
        expect(stored,).toEqual([0,],);
        expect(destructured,).toEqual([0,],);
        /* And the controls stay discharged, each one measured against the mutation it
         * exists to catch rather than assumed to catch one. Dropping the mutable-state
         * filter from `recordLeaf` turns `primitive` into `[0]` and moves nothing else.
         * Dropping `occurrenceEstablishesBinding` turns `assignedAlias` and
         * `destructuredRead` into `[0]` and moves nothing else, because the two escaping
         * destructuring and assignment cases already keep opacity and cannot go higher. */
        expect(primitive,).toEqual([],);
        expect(destructuredRead,).toEqual([],);
        expect(readAlias,).toEqual([],);
        expect(assignedAlias,).toEqual([],);
      },
    },),
    it({
      name: 'records every write through one destructured object parameter, whatever its contract names or siblings do',
      fn: async () => {
        /* Invisible at the diagnostic level in the direction that matters. The defect
         * produced an *offer*, so its signature is a missing message, and a fixture
         * nothing linted would look identical. The summary states the fact directly. */
        const session = openSemanticFile({
          fileName: RESULT_PROVENANCE_PATH,
          sourceText: RESULT_PROVENANCE_SOURCE,
          hasBOM: false,
        },);
        const index = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
        },);
        /**
         * Reads the written parameter indexes of one fixture function.
         *
         * Reads `referentMutatedParameterIndexes` rather than
         * `mutatedParameterIndexes`, because the second is the union with the invoked
         * set while the readonly offer is gated on the first alone. Measuring the union
         * here would have reported a write for `methodReturnPackagedEffect`, which is
         * offered readonly.
         *
         * @param functionName - Fixture function to inspect.
         *
         * @returns written parameter indexes in ascending order.
         */
        function writtenIndexes(functionName: string,): readonly number[] {
          const nameNode = session.nodeAtOffset(
            RESULT_PROVENANCE_SOURCE.indexOf(`function ${functionName}`,)
              + 'function '.length,
          );
          const declaration = nameNode.parent;
          if (!isFunctionLikeDeclaration(declaration,))
            throw new Error(`Expected a declaration for ${functionName}.`,);
          const summary = index.get(declaration,);
          if (summary === NO_EFFECT_SUMMARY)
            throw new Error(`Expected an effect summary for ${functionName}.`,);
          /* Explicit numeric compare, since the default sort is lexicographic and
           * would order parameter 10 before parameter 2. */
          return [...summary.referentMutatedParameterIndexes,]
            .toSorted(function byIndex(left: number, right: number,): number {
              return left - right;
            },);
        }
        /** Parameter placed in a literal property the callee contract omits. */
        const omittedProperty = writtenIndexes('directRestrictedRowEffect',);
        /** Element obtained by `at` and placed in an omitted property. */
        const omittedLookup = writtenIndexes('contractRestrictedRowEffect',);
        /** Stored set obtained by `get` and placed in an omitted property. */
        const omittedStored = writtenIndexes('contractRestrictedLiteralEffect',);
        /** Whole container handed over as a direct argument. */
        const directArgument = writtenIndexes('directArgumentRestrictedEffect',);
        /** Literal whose every mutated property the contract names. */
        const fullyNamed = writtenIndexes('fullContractLiteralEffect',);
        /** Literal handed to a callee taking an identifier parameter. */
        const identifierParameter = writtenIndexes('identifierParameterLiteralEffect',);
        /** Two parameters where the callee writes only one. */
        const precisionCost = writtenIndexes('narrowingPrecisionCostEffect',);
        /** Callee invoking one property and writing another. */
        const invokedBeside = writtenIndexes('invokedExclusionDirectEffect',);
        /** Direct write beside a parameter forwarded next to a callback. */
        const invokedMiddle = writtenIndexes('middleInvokedExclusionEffect',);
        /** The same write one call further out. */
        const invokedOuter = writtenIndexes('outerInvokedExclusionEffect',);
        /** Parameter packaged behind an object-literal getter. */
        const accessorPackaged = writtenIndexes('accessorPackagedEffect',);
        /** Parameter packaged through a spread of a local object. */
        const spreadPackaged = writtenIndexes('spreadPackagedEffect',);
        /** Parameter reached by accessors nested one literal deeper. */
        const nestedAccessor = writtenIndexes('nestedAccessorPackagedEffect',);
        /** Parameter behind a method the callee calls for a row it writes. */
        const methodReturn = writtenIndexes('methodReturnPackagedEffect',);
        /** The same shape with an arrow held in an ordinary property. */
        const arrowReturn = writtenIndexes('arrowReturnPackagedEffect',);
        /** Function that only reads what it looks up, as a negative control. */
        const readOnly = writtenIndexes('readOnlyLookupEffect',);
        closeSemanticBridge();
        /* The defect, and the three shapes it took. Restoring the contract-name filter
         * in `effect-owned-call-edge.ts` empties all three, and the first is the one
         * that needs no collection member call at all: a parameter placed straight into
         * an object literal, mutated by the callee through a property its `@mutates`
         * blocks omit. Measured before the fix, `directRestrictedRowEffect` reported
         * `mutated=[]` and the rule emitted `Parameter "row" should be readonly:
         * property label is writable` while the callee wrote `row.label`. */
        expect(omittedProperty,).toEqual([0,],);
        expect(omittedLookup,).toEqual([0,],);
        expect(omittedStored,).toEqual([0,],);
        /* The three neighbours that were already correct, kept so the assertions above
         * are known to isolate the contract-name filter rather than callee routing,
         * literal arguments, or destructuring in general. Each measured `mutated=[0]`
         * with the filter still in place. */
        expect(directArgument,).toEqual([0,],);
        expect(fullyNamed,).toEqual([0,],);
        expect(identifierParameter,).toEqual([0,],);
        /* The precision the slot model exists to recover, now measured rather than
         * predicted. The callee writes `named` and only reads `unnamed`, and the caller
         * hands `first` to the one and `second` to the other, so only `first` is written.
         *
         * This read `[0, 1]` for as long as the call edge repeated an argument's whole
         * origin set on every property slot the callee reads. It reads `[0]` because
         * `effect-argument-properties.ts` now resolves each property slot against the
         * caller's authored literal, and the sibling assertion in
         * `prefer-readonly-parameter-type.unit.test.ts` records the offer for `second`
         * that follows from it. Reverting that module restores `[0, 1]` and withdraws the
         * offer, which is the safe direction and was the state before. */
        expect(precisionCost,).toEqual([0,],);
        /* The same collapse seen from the other side, and the reason widening the walk
         * above was not conservative on its own. Mutation propagation used to subtract
         * the callee's invoked set by index, so a callee taking `{ run, target }` that
         * called `run` and wrote `target` cancelled its own write.
         *
         * These three state the facts; they do not detect that defect, and measuring said
         * so. Restoring `excludedIndexes: calleeSummary.invoked` in
         * `effect-fixed-point-propagation.ts` leaves all three reading `[0]` here while
         * the fixture gains two diagnostics, so the sibling case in
         * `prefer-readonly-parameter-type.unit.test.ts` is what catches it, through its
         * count and its assertion that the fixture offers nothing. The reason is the
         * defect's own order sensitivity: whichever propagation pass ran first decided
         * the answer, and this index is built over one file in an order that happens to
         * keep the write. That sensitivity is itself the argument for having removed the
         * subtraction rather than resequencing the passes. */
        expect(invokedBeside,).toEqual([0,],);
        expect(invokedMiddle,).toEqual([0,],);
        expect(invokedOuter,).toEqual([0,],);
        /* The third form the argument walk could not see. A property assignment, a
         * shorthand and a spread all expose a value the walk reads; an accessor computes
         * one by running its body when the callee reads the property, so a parameter it
         * returns reached the callee while contributing no origin. Deleting the accessor
         * branch from `parameterIndexes` empties the first of these and offers `row`
         * readonly again, and the spread beside it is the neighbour proving the walk was
         * not simply blind to everything that is not a plain property. */
        expect(accessorPackaged,).toEqual([0,],);
        expect(spreadPackaged,).toEqual([0,],);
        expect(nestedAccessor,).toEqual([0,],);
        /* Closed, and it took both halves. The callee side had to attribute the write:
         * `callThroughMethodResult` writes `get().label`, and calling a callable the
         * caller supplied may return caller-owned state, so `provenanceSuccessors` now
         * contributes an identifier callee. The caller side had to carry the origin to
         * the edge, which is the method and function-valued-property routing in
         * `parameterIndexes`. Reverting either one alone puts both of these back to `[]`
         * and offers `row` readonly again, which is how they were measured: with only the
         * caller half the callee still recorded `referentMutated=[]`, and with only the
         * callee half the origin never reached the edge. */
        expect(methodReturn,).toEqual([0,],);
        expect(arrowReturn,).toEqual([0,],);
        /* The control that keeps every assertion here from passing vacuously: none of
         * these changes may credit a parameter that is only read. */
        expect(readOnly,).toEqual([],);
      },
    },),
    it({
      name: 'propagates direct, cross-file, and immediate callback mutation',
      fn: async () => {
        const session = openSemanticFile({
          fileName: FIXTURE_PATH,
          sourceText: SOURCE,
          hasBOM: false,
        },);
        const index = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
        },);
        const effects = [
          'directSemanticEffect',
          'mutatePackagedState',
          'packagedSemanticEffect',
          'crossFileSemanticEffect',
          'callbackSemanticEffect',
          'directCallbackEffect',
          'asyncIteratorEffect',
          'wholeParameterContractEffect',
          'arrayCallbackSemanticEffect',
          'reduceElementParameterEffect',
          'forEachWholeArrayEffect',
          'readonlyMapCallbackEffect',
          'referencedObserverEffect',
          'mutableArrayObservationEffect',
          'mutableArrayStructureEffect',
          'mutableSetStructureEffect',
          'mutableSortObserverEffect',
          'mutableDefaultSortEffect',
          'aliasedCallbackSemanticEffect',
          'noSemanticEffect',
          'observationalIntrinsicEffect',
          'arrayBrandObservationEffect',
          'primitiveArraySortObservationEffect',
          'textEncoderObservationEffect',
          'objectArraySortCallbackEffect',
          'plainArrayDefaultSortObservationEffect',
          'hookedArrayDefaultSortOpaqueEffect',
          'objectArrayUndefinedSortOpaqueEffect',
          'plainArrayOptionalSortObservationEffect',
          'observationalValueEffects',
          'pathObservationEffect',
          'dateObservationEffect',
          'fileUrlObservationEffect',
          'direntObservationEffect',
          'aliasSemanticEffect',
          'assignedAliasSemanticEffect',
          'reboundParameterSemanticEffect',
          'destructuredAliasSemanticEffect',
          'destructuredParameterSemanticEffect',
          'opaqueSemanticEffect',
          'primitiveOpaqueArgumentEffect',
          'packagedPrimitiveOpaqueArgumentEffect',
          'transitiveOpaqueSemanticEffect',
          'unusedClosureSemanticEffect',
          'calledClosureSemanticEffect',
          'returnedClosureSemanticEffect',
          'passedClosureSemanticEffect',
          'aliasedPassedClosureSemanticEffect',
          'unusedFunctionExpressionSemanticEffect',
          'returnedContainerClosureSemanticEffect',
          'passedContainerClosureSemanticEffect',
          'deadParentClosureSemanticEffect',
          'storedClosureSemanticEffect',
        ].map(function summaryFor(functionName,) {
          const nameNode = session.nodeAtOffset(SOURCE.indexOf(functionName,),);
          const declaration = nameNode.parent;
          if (!isFunctionLikeDeclaration(declaration,))
            throw new Error(`Expected function declaration for ${functionName}.`,);
          const summary = index.get(declaration,);
          if (summary === NO_EFFECT_SUMMARY)
            throw new Error(`Expected effect summary for ${functionName}.`,);
          return {
            functionName,
            mutated: [...summary.mutatedParameterIndexes,],
            opaque: [...summary.opaqueParameterIndexes,],
          };
        },);
        /** Transitive opaque callable declaration. */
        const transitiveNameNode = session.nodeAtOffset(
          SOURCE.indexOf('transitiveOpaqueSemanticEffect',),
        );
        /** Parent function declaration for transitive opaque callable. */
        const transitiveDeclaration = transitiveNameNode.parent;
        if (!isFunctionLikeDeclaration(transitiveDeclaration,))
          throw new Error('Expected transitive opaque function declaration.',);
        /** Transitive opaque callable summary retaining originating boundary. */
        const transitiveSummary = index.get(transitiveDeclaration,);
        if (transitiveSummary === NO_EFFECT_SUMMARY)
          throw new Error('Expected transitive opaque summary.',);
        /** Opaque boundary names propagated to wrapper parameter. */
        const transitiveProvenance = [
          ...transitiveSummary.opaqueProvenanceByParameter.get(asParameterIndex(0,),) ?? [],
        ];
        /** Mutation contracts leave unresolved implementations opaque. */
        const contractedOpaqueEffects = [
          'documentedUncertainSemanticEffect',
          'transitiveDocumentedUncertainSemanticEffect',
        ].map(function documentedSummary(functionName,) {
          const nameNode = session.nodeAtOffset(SOURCE.indexOf(functionName,),);
          const declaration = nameNode.parent;
          if (!isFunctionLikeDeclaration(declaration,))
            throw new Error(`Expected function declaration for ${functionName}.`,);
          const summary = index.get(declaration,);
          if (summary === NO_EFFECT_SUMMARY)
            throw new Error(`Expected effect summary for ${functionName}.`,);
          return {
            functionName,
            affected: [...summary.mutatedParameterIndexes,],
            referentMutated: [...summary.referentMutatedParameterIndexes,],
            opaque: [...summary.opaqueParameterIndexes,],
            provenance: [...summary.opaqueProvenanceByParameter.get(asParameterIndex(0,),) ?? [],],
          };
        },);
        closeSemanticBridge();
        expect(effects,).toEqual([
          {
            functionName: 'directSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'mutatePackagedState',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'packagedSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'crossFileSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'callbackSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'directCallbackEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'asyncIteratorEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'wholeParameterContractEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'arrayCallbackSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'reduceElementParameterEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'forEachWholeArrayEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'readonlyMapCallbackEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'referencedObserverEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'mutableArrayObservationEffect',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'mutableArrayStructureEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'mutableSetStructureEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'mutableSortObserverEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'mutableDefaultSortEffect',
            mutated: [0,],
            opaque: [0,],
          },
          {
            functionName: 'aliasedCallbackSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'noSemanticEffect',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'observationalIntrinsicEffect',
            mutated: [],
            opaque: [0,],
          },
          {
            functionName: 'arrayBrandObservationEffect',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'primitiveArraySortObservationEffect',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'textEncoderObservationEffect',
            mutated: [],
            opaque: [0,],
          },
          {
            functionName: 'objectArraySortCallbackEffect',
            mutated: [],
            opaque: [0,],
          },
          {
            functionName: 'plainArrayDefaultSortObservationEffect',
            mutated: [],
            opaque: [0,],
          },
          {
            functionName: 'hookedArrayDefaultSortOpaqueEffect',
            mutated: [],
            opaque: [0,],
          },
          {
            functionName: 'objectArrayUndefinedSortOpaqueEffect',
            mutated: [],
            opaque: [0,],
          },
          {
            functionName: 'plainArrayOptionalSortObservationEffect',
            mutated: [],
            opaque: [0,],
          },
          {
            functionName: 'observationalValueEffects',
            mutated: [],
            opaque: [0,],
          },
          {
            functionName: 'pathObservationEffect',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'dateObservationEffect',
            mutated: [],
            opaque: [0,],
          },
          {
            functionName: 'fileUrlObservationEffect',
            mutated: [],
            opaque: [0,],
          },
          {
            functionName: 'direntObservationEffect',
            mutated: [],
            opaque: [0,],
          },
          {
            functionName: 'aliasSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'assignedAliasSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'reboundParameterSemanticEffect',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'destructuredAliasSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'destructuredParameterSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'opaqueSemanticEffect',
            mutated: [],
            opaque: [0,],
          },
          {
            functionName: 'primitiveOpaqueArgumentEffect',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'packagedPrimitiveOpaqueArgumentEffect',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'transitiveOpaqueSemanticEffect',
            mutated: [],
            opaque: [0,],
          },
          {
            functionName: 'unusedClosureSemanticEffect',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'calledClosureSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'returnedClosureSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'passedClosureSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'aliasedPassedClosureSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'unusedFunctionExpressionSemanticEffect',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'returnedContainerClosureSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            /* Opaque as well as mutated, and honest. The literal handed to
             * `Promise.resolve` holds a method that writes `closureState`, so an
             * unresolved callee receives a capability over caller-owned state. The claim
             * read `[]` until `parameterIndexes` began scanning packaged callables for
             * the origins they carry, which is what the identifier-callee attribution
             * needs to reach an edge at all. */
            functionName: 'passedContainerClosureSemanticEffect',
            mutated: [0,],
            opaque: [0,],
          },
          {
            functionName: 'deadParentClosureSemanticEffect',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'storedClosureSemanticEffect',
            mutated: [0,],
            opaque: [0,],
          },
        ],);
        /* Provenance facts carry origin-call locations so surfaced
         * diagnostics name where each remediation applies. */
        expect(transitiveProvenance.length,).toBe(1,);
        expect(transitiveProvenance[0]?.startsWith('JSON.stringify [',),).toBe(true,);
        expect(contractedOpaqueEffects.map(function withoutProvenance({
          provenance,
          ...rest
        },) {
          return {
            ...rest,
            provenanceShape: provenance.map(function factShape(fact,): boolean {
              return fact.startsWith('JSON.stringify [',) && fact.endsWith(']',);
            },),
          };
        },),).toEqual([
          {
            functionName: 'documentedUncertainSemanticEffect',
            affected: [],
            referentMutated: [],
            opaque: [0,],
            provenanceShape: [true,],
          },
          {
            functionName: 'transitiveDocumentedUncertainSemanticEffect',
            affected: [],
            referentMutated: [],
            opaque: [0,],
            provenanceShape: [true,],
          },
        ],);
      },
    },),
    it({
      name: 'keeps deferred callback invocation separate from forwarded argument uncertainty',
      fn: async () => {
        using projectRoot = disposableCacheDirectory();
        /** Disposable configured source path. */
        const inputPath = join(projectRoot.path, 'input.ts',);
        /** Source forwarding payload to deferred callback. */
        const inputSource = [
          'export function schedule(callback: (payload: { value: string }) => void, payload: { value: string }): void {',
          '  setTimeout(callback, 0, payload);',
          '}',
          '',
        ].join('\n',);
        writeFileSync(
          join(projectRoot.path, 'tsconfig.json',),
          `${JSON.stringify({ compilerOptions: { strict: true, lib: ['ESNext', 'DOM',], }, files: ['input.ts',], },)}\n`,
        );
        writeFileSync(inputPath, inputSource,);
        const session = openSemanticFile({
          fileName: inputPath,
          sourceText: inputSource,
          hasBOM: false,
        },);
        const index = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
        },);
        /** Scheduled function declaration. */
        const declaration = session.nodeAtOffset(inputSource.indexOf('schedule',),)
          .parent;
        if (!isFunctionLikeDeclaration(declaration,))
          throw new Error('Expected scheduled function declaration.',);
        /** Deferred callback effect summary. */
        const summary = index.get(declaration,);
        if (summary === NO_EFFECT_SUMMARY)
          throw new Error('Expected deferred callback effect summary.',);
        expect([...summary.invokedParameterIndexes,],).toEqual([],);
        expect([...summary.mutatedParameterIndexes,],).toEqual([],);
        expect([...summary.referentMutatedParameterIndexes,],).toEqual([],);
        expect([...summary.opaqueParameterIndexes,],).toEqual([0, 1,],);
        expect(summary.callbackRelations,).toEqual([],);
        closeSemanticBridge();
      },
    },),
    it({
      name: 'rejects shallow frozen copy retaining caller-owned nested identity',
      fn: async () => {
        using projectRoot = disposableCacheDirectory();
        /** Disposable configured source path. */
        const inputPath = join(projectRoot.path, 'input.ts',);
        /** Source freezing a fresh shallow copy instead of caller-owned input. */
        const inputSource = [
          'export function freezeCopy(options: { nested: { value: string } }): void {',
          '  Object.freeze({ nested: options.nested });',
          '}',
          '',
        ].join('\n',);
        writeFileSync(
          join(projectRoot.path, 'tsconfig.json',),
          `${JSON.stringify({ compilerOptions: { strict: true, lib: ['ESNext',], }, files: ['input.ts',], },)}\n`,
        );
        writeFileSync(inputPath, inputSource,);
        const session = openSemanticFile({
          fileName: inputPath,
          sourceText: inputSource,
          hasBOM: false,
        },);
        const index = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
        },);
        /** Fresh-copy function declaration. */
        const declaration = session.nodeAtOffset(inputSource.indexOf('freezeCopy',),)
          .parent;
        if (!isFunctionLikeDeclaration(declaration,))
          throw new Error('Expected fresh-copy function declaration.',);
        /** Fresh-copy effect summary. */
        const summary = index.get(declaration,);
        if (summary === NO_EFFECT_SUMMARY)
          throw new Error('Expected fresh-copy effect summary.',);
        expect({
          mutated: [...summary.mutatedParameterIndexes,],
          referentMutated: [...summary.referentMutatedParameterIndexes,],
          invoked: [...summary.invokedParameterIndexes,],
          opaque: [...summary.opaqueParameterIndexes,],
          callbackRelations: summary.callbackRelations,
        },).toEqual({
          mutated: [],
          referentMutated: [],
          invoked: [],
          opaque: [0,],
          callbackRelations: [],
        },);
        closeSemanticBridge();
      },
    },),
    it({
      name: 'infers direct imported package effects from shipped implementation',
      fn: async () => {
        using projectRoot = disposableCacheDirectory();
        /** Disposable package root under ordinary Node resolution boundary. */
        const packageRoot = join(projectRoot.path, 'node_modules', 'effect-probe',);
        mkdirSync(packageRoot, { recursive: true, },);
        writeFileSync(
          join(projectRoot.path, 'package.json',),
          '{"name":"effect-consumer","private":true,"type":"module"}\n',
        );
        writeFileSync(
          join(projectRoot.path, 'tsconfig.json',),
          '{"compilerOptions":{"strict":true,"module":"NodeNext","moduleResolution":"NodeNext"},"include":["input.ts"]}\n',
        );
        writeFileSync(
          join(projectRoot.path, 'pnpm-lock.yaml',),
          "lockfileVersion: '9.0'\npackages:\n  effect-probe@1.2.3: {}\n",
        );
        writeFileSync(
          join(packageRoot, 'package.json',),
          '{"name":"effect-probe","version":"1.2.3","type":"module","types":"./index.d.ts","exports":{".":{"node":"./node.js","import":"./index.js"},"./barrel":{"types":"./barrel.d.ts","node":"./barrel.js"},"./typed":{"types":"./typed.d.ts","import":"./typed.ts"},"./missing":{"types":"./missing.d.ts","import":"./missing.js"}}}\n',
        );
        writeFileSync(
          join(packageRoot, 'index.d.ts',),
          'export declare function observe(value: { text: string; }): string;\nexport declare function observe(value: { text: string; }, fallback: string): string;\nexport declare function mutate(value: { text: string; }): string;\nexport declare const toolkit: { mutate(value: { text: string; }): string; };\nexport declare class Toolkit { static mutate(value: { text: string; }): string; mutate(value: { text: string; }): string; }\nexport declare function visit(value: { text: string; }, callback: (value: { text: string; }) => void): void;\n',
        );
        writeFileSync(
          join(packageRoot, 'node.js',),
          "export { mutate, observe, Toolkit, toolkit, visit, } from './internal.js';\n//# sourceMappingURL=node.js.map\n",
        );
        writeFileSync(
          join(packageRoot, 'node.js.map',),
          '{"version":3,"file":"node.js","sources":["source.js"],"names":[],"mappings":""}\n',
        );
        writeFileSync(
          join(packageRoot, 'index.js',),
          "export { observe, Toolkit, toolkit, visit, } from './internal.js';\nexport function mutate(value) { return value.text; }\n",
        );
        writeFileSync(
          join(packageRoot, 'source.js',),
          "export { mutate, observe, Toolkit, toolkit, visit, } from './internal.js';\n",
        );
        writeFileSync(
          join(packageRoot, 'internal.js',),
          "export function observe(value) { return value.text; }\nexport function mutate(value) { value.text = 'changed'; return value.text; }\nexport const toolkit = { mutate(value) { value.text = 'object'; return value.text; } };\nexport class Toolkit { static mutate(value) { value.text = 'static'; return value.text; } mutate(value) { value.text = 'instance'; return value.text; } }\nexport function visit(value, callback) { callback(value); }\n",
        );
        writeFileSync(
          join(packageRoot, 'barrel.d.ts',),
          'export declare function barrelMutate(value: { text: string; }): string;\n',
        );
        writeFileSync(
          join(packageRoot, 'barrel.js',),
          "import { barrelMutate, } from './barrel-internal.js';\nexport { barrelMutate, };\n",
        );
        writeFileSync(
          join(packageRoot, 'barrel-internal.d.ts',),
          'export declare function barrelMutate(value: { text: string; }): string;\n',
        );
        writeFileSync(
          join(packageRoot, 'barrel-internal.js',),
          "export function barrelMutate(value) { value.text = 'barrel'; return value.text; }\n",
        );
        writeFileSync(
          join(packageRoot, 'typed.d.ts',),
          'export declare function typedMutate(value: { text: string; }): string;\n',
        );
        writeFileSync(
          join(packageRoot, 'typed.ts',),
          "export function typedMutate(value: { text: string; }): string { value.text = 'typed'; return value.text; }\n",
        );
        writeFileSync(
          join(packageRoot, 'missing.d.ts',),
          'export declare function missing(value: { text: string; }): string;\n',
        );
        /** Consumer wrappers covering re-exported JS, overloads, shipped TS, and missing implementation. */
        const inputSource = "import { mutate, observe, Toolkit, toolkit, visit, } from 'effect-probe';\nimport { barrelMutate, } from 'effect-probe/barrel';\nimport { missing, } from 'effect-probe/missing';\nimport { typedMutate, } from 'effect-probe/typed';\nexport function observed(value: { text: string; }): string { return observe(value); }\nexport function mutated(value: { text: string; }): string { return mutate(value); }\nexport function barrelMutated(value: { text: string; }): string { return barrelMutate(value); }\nexport function objectMutated(value: { text: string; }): string { return toolkit.mutate(value); }\nconst toolkitInstance = new Toolkit();\nexport function staticMutated(value: { text: string; }): string { return Toolkit.mutate(value); }\nexport function instanceMutated(value: { text: string; }): string { return toolkitInstance.mutate(value); }\nexport function typedMutated(value: { text: string; }): string { return typedMutate(value); }\nexport function visited(value: { text: string; }, callback: (value: { text: string; }) => void): void { visit(value, callback); }\nexport function unresolved(value: { text: string; }): string { return missing(value); }\n";
        /** Consumer source path. */
        const inputPath = join(projectRoot.path, 'input.ts',);
        writeFileSync(inputPath, inputSource,);
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
        const session = openSemanticFile({
          fileName: inputPath,
          sourceText: inputSource,
          hasBOM: false,
        },);
        const index = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
        },);
        const effects = [
          'observed',
          'mutated',
          'barrelMutated',
          'objectMutated',
          'staticMutated',
          'instanceMutated',
          'typedMutated',
          'unresolved',
        ].map(function wrapperEffect(functionName,) {
          const nameNode = session.nodeAtOffset(inputSource.indexOf(functionName,),);
          const declaration = nameNode.parent;
          if (!isFunctionLikeDeclaration(declaration,))
            throw new Error(`Expected package wrapper ${functionName}.`,);
          const summary = index.get(declaration,);
          if (summary === NO_EFFECT_SUMMARY)
            throw new Error(`Expected package wrapper summary ${functionName}.`,);
          return {
            functionName,
            mutated: [...summary.referentMutatedParameterIndexes,],
            opaque: [...summary.opaqueParameterIndexes,],
          };
        },);
        expect(effects,).toEqual([
          {
            functionName: 'observed',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'mutated',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'barrelMutated',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'objectMutated',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'staticMutated',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'instanceMutated',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'typedMutated',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'unresolved',
            mutated: [],
            opaque: [0,],
          },
        ],);
        /** Wrapper declaration for unresolved external callback relation. */
        const visitedName = session.nodeAtOffset(inputSource.indexOf('visited',),);
        /** Function declaration receiving callback and forwarded value. */
        const visitedDeclaration = visitedName.parent;
        if (!isFunctionLikeDeclaration(visitedDeclaration,))
          throw new Error('Expected visited package wrapper.',);
        /** Summary retaining callback invocation and fail-closed source relation. */
        const visitedSummary = index.get(visitedDeclaration,);
        if (visitedSummary === NO_EFFECT_SUMMARY)
          throw new Error('Expected visited package wrapper summary.',);
        expect({
          referentMutated: [...visitedSummary.referentMutatedParameterIndexes,],
          invoked: [...visitedSummary.invokedParameterIndexes,],
          opaque: [...visitedSummary.opaqueParameterIndexes,],
        },).toEqual({
          referentMutated: [],
          invoked: [1,],
          opaque: [0,],
        },);
        closeSemanticBridge();
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
      },
    },),
    it({
      name: 'fails closed when effect analysis budget is exhausted',
      fn: async () => {
        using projectRoot = disposableCacheDirectory();
        /** Single-source project used to exhaust budget before analysis. */
        const inputPath = join(projectRoot.path, 'input.ts',);
        /** Stable source whose summary must never be assumed after exhaustion. */
        const inputSource = 'export function inspect(value: { text: string; },): string { return value.text; }\n';
        writeFileSync(
          join(projectRoot.path, 'tsconfig.json',),
          '{"compilerOptions":{"strict":true},"include":["input.ts"]}\n',
        );
        writeFileSync(inputPath, inputSource,);
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
        const session = openSemanticFile({
          fileName: inputPath,
          sourceText: inputSource,
          hasBOM: false,
        },);
        let caught: unknown;
        try {
          buildEffectSummaryIndex({
            project: session.project,
            activeSourceFile: session.sourceFile,
            cacheRootOverride: join(projectRoot.path, '.effect-cache',),
            analysisBudgetMilliseconds: 0,
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(SemanticBridgeError,);
        expect((caught as SemanticBridgeError).reason,).toBe('analysis-incomplete',);
        closeSemanticBridge();
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
      },
    },),
    it({
      name: 'scans only sources reached through owned calls and callbacks',
      fn: async () => {
        using projectRoot = disposableCacheDirectory();
        /** Disposable persistent cache separated from fixture source files. */
        const cacheRoot = join(projectRoot.path, '.effect-cache',);
        /** Active caller source whose effect closure is demanded. */
        const inputPath = join(projectRoot.path, 'input.ts',);
        /** Higher-order helper reached by active caller. */
        const helperPath = join(projectRoot.path, 'helper.ts',);
        /** Owned callback reached only through call-edge callback identity. */
        const callbackPath = join(projectRoot.path, 'callback.ts',);
        /** Configured source outside demanded effect closure. */
        const unrelatedPath = join(projectRoot.path, 'unrelated.ts',);
        /** Active source forwarding caller-owned state to imported callback. */
        const inputSource = "import { mutate, } from './callback.js';\nimport { invoke, mutateDirect, } from './helper.js';\nexport function demanded(value: { text: string; },): void { mutateDirect(value); invoke(mutate, value); }\n";
        writeFileSync(
          join(projectRoot.path, 'tsconfig.json',),
          '{"compilerOptions":{"strict":true},"include":["*.ts"]}\n',
        );
        writeFileSync(inputPath, inputSource,);
        writeFileSync(
          helperPath,
          "export function invoke(callback: (value: { text: string; }) => void, value: { text: string; },): void { callback(value); }\nexport function mutateDirect(value: { text: string; },): void { value.text = 'direct'; }\n",
        );
        writeFileSync(
          callbackPath,
          "export function mutate(value: { text: string; },): void { value.text = 'changed'; }\n",
        );
        writeFileSync(
          unrelatedPath,
          'export function unrelated(value: { text: string; },): string { return value.text; }\n',
        );
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
        const session = openSemanticFile({
          fileName: inputPath,
          sourceText: inputSource,
          hasBOM: false,
        },);
        const index = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
          cacheRootOverride: cacheRoot,
        },);
        /** Active caller declaration receiving transitive callback effect. */
        const declaration = session.nodeAtOffset(inputSource.indexOf('demanded',),)
          .parent;
        if (!isFunctionLikeDeclaration(declaration,))
          throw new Error('Expected demanded caller declaration.',);
        /** Summary proving callback source participated in fixed point. */
        const summary = index.get(declaration,);
        if (summary === NO_EFFECT_SUMMARY)
          throw new Error('Expected demanded caller effect summary.',);
        /** Cold counters exposing exact demanded callable set. */
        const stats = effectSummaryCacheStats();
        expect([...summary.referentMutatedParameterIndexes,],).toEqual([0,],);
        expect(stats.directSummaryBuildCount,).toBe(5,);
        expect(stats.persistentCacheWriteCount,).toBe(3,);
        closeSemanticBridge();
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
      },
    },),
    it({
      name: 'does not infer foreign ownership while an unscanned owned inbound call may exist',
      fn: async () => {
        using projectRoot = disposableCacheDirectory();
        /** Marker source directory preserving exact semantic identity suffix. */
        const markerRoot = join(
          projectRoot.path,
          'ownership-marker',
          'foreign-borrowed',
          'src',
        );
        /** Active foreign-boundary source. */
        const foreignPath = join(projectRoot.path, 'foreign.ts',);
        /** Shared helper receiving both foreign and owned values. */
        const helperPath = join(projectRoot.path, 'helper.ts',);
        /** Unreached ordinary caller disproving helper-wide foreign ownership. */
        const ownedPath = join(projectRoot.path, 'owned.ts',);
        /** Active source carrying explicit marker into shared helper. */
        const foreignSource = "import type { ForeignBorrowed, } from './ownership-marker/foreign-borrowed/src/index.js';\nimport { read, } from './helper.js';\nexport function readForeign(value: ForeignBorrowed<{ text: string; }>,): string { return read(value); }\n";
        mkdirSync(markerRoot, { recursive: true, },);
        writeFileSync(
          join(projectRoot.path, 'tsconfig.json',),
          '{"compilerOptions":{"strict":true},"include":["**/*.ts"]}\n',
        );
        writeFileSync(
          join(markerRoot, 'index.ts',),
          'declare const FOREIGN_BORROWED_MARKER: unique symbol;\nexport type ForeignBorrowed<Value> = Value & { readonly [FOREIGN_BORROWED_MARKER]?: true; };\n',
        );
        writeFileSync(foreignPath, foreignSource,);
        writeFileSync(
          helperPath,
          'export function read(value: { text: string; },): string { return value.text; }\n',
        );
        writeFileSync(
          ownedPath,
          "import { read, } from './helper.js';\nexport function readOwned(value: { text: string; },): string { return read(value); }\n",
        );
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
        const session = openSemanticFile({
          fileName: foreignPath,
          sourceText: foreignSource,
          hasBOM: false,
        },);
        const index = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
          cacheRootOverride: join(projectRoot.path, '.effect-cache',),
        },);
        /** Active boundary declaration retaining explicit foreign provenance. */
        const foreignDeclaration = session.nodeAtOffset(foreignSource.indexOf('readForeign',),)
          .parent;
        if (!isFunctionLikeDeclaration(foreignDeclaration,))
          throw new Error('Expected active foreign boundary declaration.',);
        /** Active boundary summary after complete inbound fallback. */
        const foreignSummary = index.get(foreignDeclaration,);
        if (foreignSummary === NO_EFFECT_SUMMARY)
          throw new Error('Expected active foreign boundary summary.',);
        expect([...index.proveForeignBorrowed(foreignDeclaration,),],).toEqual([0,],);
        /** Shared helper source decoded by active semantic project. */
        const helperSource = session.project.program.getSourceFile(helperPath,);
        if (helperSource === undefined)
          throw new Error('Expected shared helper source.',);
        /** Shared helper declaration whose every inbound must be considered. */
        const [helperDeclaration,] = helperSource.statements;
        if ((helperDeclaration === undefined)
          || (!isFunctionLikeDeclaration(helperDeclaration,)))
          throw new Error('Expected shared helper declaration.',);
        /** Helper summary must retain ordinary ownership from unreached caller. */
        const helperSummary = index.get(helperDeclaration,);
        if (helperSummary === NO_EFFECT_SUMMARY)
          throw new Error('Expected shared helper summary.',);
        expect([...index.proveForeignBorrowed(helperDeclaration,),],).toEqual([],);
        closeSemanticBridge();
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
      },
    },),
    it({
      name: 'refuses a marker declared in a declaration file',
      fn: async () => {
        using projectRoot = disposableCacheDirectory();
        /** Marker directory matching the identity check's expected shape. */
        const markerRoot = join(
          projectRoot.path,
          'ownership-marker',
          'foreign-borrowed',
          'src',
        );
        /** Boundary source naming the marker it imports. */
        const foreignPath = join(projectRoot.path, 'foreign.ts',);
        /** Boundary whose parameter carries the marker. */
        const foreignSource = "import type { ForeignBorrowed, } from './ownership-marker/foreign-borrowed/src/index.js';\nexport function readForeign(value: ForeignBorrowed<{ text: string; }>,): string { return value.text; }\n";
        mkdirSync(markerRoot, { recursive: true, },);
        writeFileSync(
          join(projectRoot.path, 'tsconfig.json',),
          '{"compilerOptions":{"strict":true},"include":["**/*.ts"]}\n',
        );
        /* Declaration file rather than `index.ts`, which is the whole point: the identity
         * check names one exact `.ts` path, and a marker anywhere else is not this marker.
         * `foreign-borrowed-demand.ts` depends on that. Its scope pre-scan reads source text,
         * so it could only miss a marker whose declaring file is absent from the indexed
         * scope, and the only file that can declare one has no `node_modules` segment and is
         * therefore always indexed. Accepting a declaration file here would break that
         * reasoning and make the pre-scan skip a scope whose parameters are genuinely
         * foreign, which withholds nothing and emits an offer. */
        writeFileSync(
          join(markerRoot, 'index.d.ts',),
          'declare const FOREIGN_BORROWED_MARKER: unique symbol;\nexport type ForeignBorrowed<Value> = Value & { readonly [FOREIGN_BORROWED_MARKER]?: true; };\n',
        );
        writeFileSync(foreignPath, foreignSource,);
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
        const session = openSemanticFile({
          fileName: foreignPath,
          sourceText: foreignSource,
          hasBOM: false,
        },);
        const index = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
          cacheRootOverride: join(projectRoot.path, '.effect-cache',),
        },);
        /** Boundary declaration whose parameter names the marker alias. */
        const foreignDeclaration = session.nodeAtOffset(foreignSource.indexOf('readForeign',),)
          .parent;
        if (!isFunctionLikeDeclaration(foreignDeclaration,))
          throw new Error('Expected active foreign boundary declaration.',);
        expect([...index.proveForeignBorrowed(foreignDeclaration,),],).toEqual([],);
        closeSemanticBridge();
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
      },
    },),
    it({
      name: 'proves the same parameters whichever callable was asked about first',
      fn: async () => {
        using projectRoot = disposableCacheDirectory();
        /** Marker source directory preserving exact semantic identity suffix. */
        const markerRoot = join(
          projectRoot.path,
          'ownership-marker',
          'foreign-borrowed',
          'src',
        );
        /** Active foreign-boundary source. */
        const foreignPath = join(projectRoot.path, 'foreign.ts',);
        /** Shared helper reached from the boundary and from an ordinary caller. */
        const helperPath = join(projectRoot.path, 'helper.ts',);
        /** Ordinary caller keeping the shared helper out of foreign ownership. */
        const ownedPath = join(projectRoot.path, 'owned.ts',);
        /** Active source carrying explicit marker into shared helper. */
        const foreignSource = "import type { ForeignBorrowed, } from './ownership-marker/foreign-borrowed/src/index.js';\nimport { read, } from './helper.js';\nexport function readForeign(value: ForeignBorrowed<{ text: string; }>,): string { return read(value); }\n";
        mkdirSync(markerRoot, { recursive: true, },);
        writeFileSync(
          join(projectRoot.path, 'tsconfig.json',),
          '{"compilerOptions":{"strict":true},"include":["**/*.ts"]}\n',
        );
        writeFileSync(
          join(markerRoot, 'index.ts',),
          'declare const FOREIGN_BORROWED_MARKER: unique symbol;\nexport type ForeignBorrowed<Value> = Value & { readonly [FOREIGN_BORROWED_MARKER]?: true; };\n',
        );
        writeFileSync(foreignPath, foreignSource,);
        writeFileSync(
          helperPath,
          'export function read(value: { text: string; },): string { return value.text; }\n',
        );
        writeFileSync(
          ownedPath,
          "import { read, } from './helper.js';\nexport function readOwned(value: { text: string; },): string { return read(value); }\n",
        );

        /**
         * Proves both callables in one order, from a cold index each time.
         *
         * The helper's backwards closure walks through the boundary and reaches every callable
         * the boundary's own closure would, so asking the helper first is what leaves an answer
         * for the boundary behind. Retaining that answer instead of proving the boundary in its
         * own right is what attempt two did, and the closure's caller summaries carry only the
         * edges the helper's walk discovered, so the retained answer is not the same answer.
         *
         * @param helperFirst - Whether to demand the shared helper before the marked boundary.
         *
         * @returns proven parameter positions for the boundary and for the helper.
         */
        const proveInOrder = (helperFirst: boolean,): {
          readonly foreign: readonly number[];
          readonly helper: readonly number[];
        } => {
          clearEffectSummaryCache();
          clearFinalEffectIndexCache();
          /** Semantic session for one complete cold run. */
          const session = openSemanticFile({
            fileName: foreignPath,
            sourceText: foreignSource,
            hasBOM: false,
          },);
          /** Cold index sharing nothing with the other order. */
          const index = buildEffectSummaryIndex({
            project: session.project,
            activeSourceFile: session.sourceFile,
            cacheRootOverride: join(projectRoot.path, `.effect-cache-${String(helperFirst,)}`,),
          },);
          /** Marked boundary declaration. */
          const foreignDeclaration = session.nodeAtOffset(foreignSource.indexOf('readForeign',),)
            .parent;
          if (!isFunctionLikeDeclaration(foreignDeclaration,))
            throw new Error('Expected active foreign boundary declaration.',);
          /** Shared helper source decoded by active semantic project. */
          const helperSource = session.project.program.getSourceFile(helperPath,);
          if (helperSource === undefined)
            throw new Error('Expected shared helper source.',);
          /** Shared helper declaration reached from both callers. */
          const [helperDeclaration,] = helperSource.statements;
          if ((helperDeclaration === undefined)
            || (!isFunctionLikeDeclaration(helperDeclaration,)))
            throw new Error('Expected shared helper declaration.',);
          /** Answers in the order this run demands them. */
          const answers = helperFirst
            ? {
              helper: [...index.proveForeignBorrowed(helperDeclaration,),],
              foreign: [...index.proveForeignBorrowed(foreignDeclaration,),],
            }
            : {
              foreign: [...index.proveForeignBorrowed(foreignDeclaration,),],
              helper: [...index.proveForeignBorrowed(helperDeclaration,),],
            };
          return answers;
        };

        expect(proveInOrder(true,),).toEqual({
          foreign: [0,],
          helper: [],
        },);
        expect(proveInOrder(false,),).toEqual({
          foreign: [0,],
          helper: [],
        },);
        closeSemanticBridge();
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
      },
    },),
    it({
      name: 'rejects overload provenance when callable alias escapes beside matching call',
      fn: async () => {
        using projectRoot = disposableCacheDirectory();
        /** Marker source directory preserving exact semantic identity suffix. */
        const markerRoot = join(
          projectRoot.path,
          'ownership-marker',
          'foreign-borrowed',
          'src',
        );
        /** Active foreign-boundary source. */
        const foreignPath = join(projectRoot.path, 'foreign.ts',);
        /** Overloaded helper source. */
        const helperPath = join(projectRoot.path, 'helper.ts',);
        /** Separate source escaping helper through value alias. */
        const escapedPath = join(projectRoot.path, 'escaped.ts',);
        /** Active source carrying explicit marker into overloaded helper. */
        const foreignSource = "import type { ForeignBorrowed, } from './ownership-marker/foreign-borrowed/src/index.js';\nimport { read, } from './helper.js';\nexport function readForeign(value: ForeignBorrowed<{ text: string; }>,): string { return read(value); }\n";
        mkdirSync(markerRoot, { recursive: true, },);
        writeFileSync(
          join(projectRoot.path, 'tsconfig.json',),
          '{"compilerOptions":{"strict":true},"include":["**/*.ts"]}\n',
        );
        writeFileSync(
          join(markerRoot, 'index.ts',),
          'declare const FOREIGN_BORROWED_MARKER: unique symbol;\nexport type ForeignBorrowed<Value> = Value & { readonly [FOREIGN_BORROWED_MARKER]?: true; };\n',
        );
        writeFileSync(foreignPath, foreignSource,);
        writeFileSync(
          helperPath,
          "export function read(value: { text: string; },): string;\nexport function read(value: { text: string; readonly extra?: true; },): string;\nexport function read(value: { text: string; readonly extra?: true; },): string { return value.text; }\n",
        );
        writeFileSync(
          escapedPath,
          "import { read, } from './helper.js';\nexport const escapedRead = read;\n",
        );
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
        const session = openSemanticFile({
          fileName: foreignPath,
          sourceText: foreignSource,
          hasBOM: false,
        },);
        const index = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
          cacheRootOverride: join(projectRoot.path, '.effect-cache',),
        },);
        /** Overloaded helper source decoded by active semantic project. */
        const helperSource = session.project.program.getSourceFile(helperPath,);
        if (helperSource === undefined)
          throw new Error('Expected overloaded helper source.',);
        /** Callable implementation sharing overload-family references. */
        const helperImplementation = helperSource.statements.find(function hasBody(statement,): boolean {
          return isFunctionLikeDeclaration(statement,)
            && ('body' in statement)
            && (statement.body !== undefined);
        },);
        if ((helperImplementation === undefined)
          || (!isFunctionLikeDeclaration(helperImplementation,)))
          throw new Error('Expected overloaded helper implementation.',);
        /** Escaped value usage must prevent call-only provenance inference. */
        const helperSummary = index.get(helperImplementation,);
        if (helperSummary === NO_EFFECT_SUMMARY)
          throw new Error('Expected overloaded helper summary.',);
        expect([...index.proveForeignBorrowed(helperImplementation,),],).toEqual([],);
        closeSemanticBridge();
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
      },
    },),
    it({
      name: 'reuses direct scans in process and through persistent cache',
      fn: async () => {
        using cache = disposableCacheDirectory();
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
        const firstSession = openSemanticFile({
          fileName: FIXTURE_PATH,
          sourceText: SOURCE,
          hasBOM: false,
        },);
        buildEffectSummaryIndex({
          project: firstSession.project,
          activeSourceFile: firstSession.sourceFile,
          cacheRootOverride: cache.path,
        },);
        /** Counters after uncached whole-project scan and persistent write. */
        const firstStats = effectSummaryCacheStats();
        expect(firstStats.directSummaryBuildCount > 0,).toBe(true,);
        expect(firstStats.persistentCacheWriteCount > 0,).toBe(true,);
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
        const secondSession = openSemanticFile({
          fileName: FIXTURE_PATH,
          sourceText: SOURCE,
          hasBOM: false,
        },);
        buildEffectSummaryIndex({
          project: secondSession.project,
          activeSourceFile: secondSession.sourceFile,
          cacheRootOverride: cache.path,
        },);
        /** Counters after process cache reset and persistent reuse. */
        const persistentStats = effectSummaryCacheStats();
        expect(persistentStats.directSummaryBuildCount,).toBe(0,);
        expect(persistentStats.persistentSourceCacheHitCount > 0,).toBe(true,);
        const thirdSession = openSemanticFile({
          fileName: FIXTURE_PATH,
          sourceText: SOURCE,
          hasBOM: false,
        },);
        buildEffectSummaryIndex({
          project: thirdSession.project,
          activeSourceFile: thirdSession.sourceFile,
          cacheRootOverride: cache.path,
        },);
        /** Counters after same-process fixed-point index reuse. */
        const processStats = effectSummaryCacheStats();
        /** Fixed-point cache counters after unchanged project query. */
        const finalStats = finalEffectIndexCacheStats();
        expect(processStats.directSummaryBuildCount,).toBe(0,);
        expect(processStats.sourceCacheHitCount,).toBe(persistentStats.sourceCacheHitCount,);
        expect(finalStats.hitCount > 0,).toBe(true,);
        /** Different active source from same unchanged configured project. */
        const helperSession = openSemanticFile({
          fileName: HELPER_PATH,
          sourceText: readFileSync(HELPER_PATH, 'utf8',),
          hasBOM: false,
        },);
        buildEffectSummaryIndex({
          project: helperSession.project,
          activeSourceFile: helperSession.sourceFile,
          cacheRootOverride: cache.path,
        },);
        /** Fixed-point cache counters after changing only active source path. */
        const crossFileStats = finalEffectIndexCacheStats();
        expect(crossFileStats.hitCount > finalStats.hitCount,).toBe(true,);
        closeSemanticBridge();
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
      },
    },),
    it({
      name: 'does not reuse an index that excluded the next active external-classified source',
      fn: async () => {
        using projectRoot = disposableCacheDirectory();
        /** Disposable persistent cache root separated from TypeScript inputs. */
        const cacheRoot = join(projectRoot.path, '.effect-cache',);
        /** Root-owned source used to build first fixed-point index. */
        const rootInputPath = join(projectRoot.path, 'input.ts',);
        /** Installed package directory classified as external by root project. */
        const nestedRoot = join(
          projectRoot.path,
          'node_modules',
          'effect-cache-probe',
        );
        /** Package callable omitted from first root-project effect index. */
        const nestedInputPath = join(nestedRoot, 'index.ts',);
        mkdirSync(nestedRoot, { recursive: true, },);
        writeFileSync(
          join(projectRoot.path, 'tsconfig.json',),
          '{"compilerOptions":{"module":"NodeNext","moduleResolution":"NodeNext","strict":true},"include":["input.ts"]}\n',
        );
        writeFileSync(
          join(nestedRoot, 'package.json',),
          '{"name":"effect-cache-probe","type":"module","exports":"./index.ts"}\n',
        );
        writeFileSync(
          rootInputPath,
          "import { nestedValue, } from 'effect-cache-probe';\nexport const rootValue: string = nestedValue('root');\n",
        );
        writeFileSync(
          nestedInputPath,
          'export function nestedValue(value: string): string { return value; }\n',
        );
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
        const session = openSemanticFile({
          fileName: rootInputPath,
          sourceText: readFileSync(rootInputPath, 'utf8',),
          hasBOM: false,
        },);
        /** Nested source decoded in root program but classified as external. */
        const nestedSource = session.project.program.getSourceFile(nestedInputPath,);
        if (nestedSource === undefined)
          throw new Error('Expected root project to decode nested source.',);
        expect(session.project.program.isSourceFileFromExternalLibrary(nestedSource,),).toBe(true,);
        buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
          cacheRootOverride: cacheRoot,
        },);
        /** Index rebuilt with nested external-classified source as active target. */
        const nestedIndex = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: nestedSource,
          cacheRootOverride: cacheRoot,
        },);
        /** Nested function declaration requiring exact summary lookup. */
        const [nestedDeclaration,] = nestedSource.statements;
        if ((nestedDeclaration === undefined)
          || (!isFunctionLikeDeclaration(nestedDeclaration,)))
          throw new Error('Expected nested function declaration.',);
        expect(nestedIndex.get(nestedDeclaration,),).not.toBe(NO_EFFECT_SUMMARY,);
        closeSemanticBridge();
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
      },
    },),
    it({
      name: 'invalidates final index when active overlay creates a new semantic snapshot',
      fn: async () => {
        using projectRoot = disposableCacheDirectory();
        /** Disposable persistent cache root. */
        const cacheRoot = join(projectRoot.path, '.effect-cache',);
        /** Active source path shared by both semantic snapshots. */
        const inputPath = join(projectRoot.path, 'input.ts',);
        /** Initial observational implementation. */
        const initialSource = 'export function inspect(value: { text: string; },): string { return value.text; }\n';
        /** Changed overlay implementation mutating caller-owned state. */
        const changedSource = 'export function inspect(value: { text: string; },): string { value.text = value.text.trim(); return value.text; }\n';
        writeFileSync(
          join(projectRoot.path, 'tsconfig.json',),
          '{"compilerOptions":{"strict":true},"include":["input.ts"]}\n',
        );
        writeFileSync(inputPath, initialSource,);
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
        const initialSession = openSemanticFile({
          fileName: inputPath,
          sourceText: initialSource,
          hasBOM: false,
        },);
        buildEffectSummaryIndex({
          project: initialSession.project,
          activeSourceFile: initialSession.sourceFile,
          cacheRootOverride: cacheRoot,
        },);
        const changedSession = openSemanticFile({
          fileName: inputPath,
          sourceText: changedSource,
          hasBOM: false,
        },);
        const changedIndex = buildEffectSummaryIndex({
          project: changedSession.project,
          activeSourceFile: changedSession.sourceFile,
          cacheRootOverride: cacheRoot,
        },);
        /** Changed declaration decoded from new immutable snapshot. */
        const [changedDeclaration,] = changedSession.sourceFile.statements;
        if ((changedDeclaration === undefined)
          || (!isFunctionLikeDeclaration(changedDeclaration,)))
          throw new Error('Expected changed overlay declaration.',);
        /** Changed summary must not reuse observational final index. */
        const changedSummary = changedIndex.get(changedDeclaration,);
        if (changedSummary === NO_EFFECT_SUMMARY)
          throw new Error('Expected changed overlay summary.',);
        expect([...changedSummary.mutatedParameterIndexes,],).toEqual([0,],);
        expect(finalEffectIndexCacheStats().writeCount,).toBe(2,);
        closeSemanticBridge();
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
      },
    },),
    it({
      name: 'invalidates unchanged caller summaries when dependency changes across bridge lifecycle',
      fn: async () => {
        using projectRoot = disposableCacheDirectory();
        /** Disposable persistent cache root separated from TypeScript inputs. */
        const cacheRoot = join(projectRoot.path, '.effect-cache',);
        /** Unchanged caller source whose call target changes on disk. */
        const inputPath = join(projectRoot.path, 'input.ts',);
        /** Imported implementation participating in caller effect resolution. */
        const helperPath = join(projectRoot.path, 'helper.ts',);
        writeFileSync(
          join(projectRoot.path, 'tsconfig.json',),
          '{"compilerOptions":{"strict":true},"include":["*.ts"]}\n',
        );
        writeFileSync(
          inputPath,
          "import { inspect, } from './helper.js';\nexport function caller(value: { text: string; },): string { return inspect(value); }\n",
        );
        writeFileSync(
          helperPath,
          'export function inspect(value: { text: string; },): string { return value.text; }\n',
        );
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
        const firstSession = openSemanticFile({
          fileName: inputPath,
          sourceText: readFileSync(inputPath, 'utf8',),
          hasBOM: false,
        },);
        buildEffectSummaryIndex({
          project: firstSession.project,
          activeSourceFile: firstSession.sourceFile,
          cacheRootOverride: cacheRoot,
        },);
        closeSemanticBridge();
        writeFileSync(
          helperPath,
          'export function inspect(value: { text: string; },): string { value.text = value.text.trim(); return value.text; }\n',
        );
        clearEffectSummaryCache();
        const changedSession = openSemanticFile({
          fileName: inputPath,
          sourceText: readFileSync(inputPath, 'utf8',),
          hasBOM: false,
        },);
        buildEffectSummaryIndex({
          project: changedSession.project,
          activeSourceFile: changedSession.sourceFile,
          cacheRootOverride: cacheRoot,
        },);
        /** Counters proving project fingerprint rejected stale caller entry. */
        const changedStats = effectSummaryCacheStats();
        /** Final-index writes proving new semantic lifecycle recomputed project. */
        const changedFinalStats = finalEffectIndexCacheStats();
        expect(changedStats.directSummaryBuildCount > 0,).toBe(true,);
        expect(changedFinalStats.writeCount,).toBe(1,);
        expect(changedStats.persistentSourceCacheHitCount,).toBe(0,);
        closeSemanticBridge();
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
      },
    },),
    it({
      name: 'rejects corrupt nested persistent payloads',
      fn: async () => {
        using projectRoot = disposableCacheDirectory();
        /** Disposable persistent cache root. */
        const cacheRoot = join(projectRoot.path, '.effect-cache',);
        /** Single-source configured project input. */
        const inputPath = join(projectRoot.path, 'input.ts',);
        /** Stable single-source input text. */
        const inputSource = 'export function inspect(value: { text: string; },): string { return value.text; }\n';
        writeFileSync(
          join(projectRoot.path, 'tsconfig.json',),
          '{"compilerOptions":{"strict":true},"include":["input.ts"]}\n',
        );
        writeFileSync(inputPath, inputSource,);
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
        const firstSession = openSemanticFile({
          fileName: inputPath,
          sourceText: inputSource,
          hasBOM: false,
        },);
        buildEffectSummaryIndex({
          project: firstSession.project,
          activeSourceFile: firstSession.sourceFile,
          cacheRootOverride: cacheRoot,
        },);
        closeSemanticBridge();
        /** Relative persistent entry paths discovered after cold write. */
        const cacheEntries: string[] = [];
        for (const entry of readdirSync(cacheRoot, {
          recursive: true,
          encoding: 'utf8',
        },)) {
          if (entry.endsWith('.json',))
            cacheEntries.push(entry,);
        }
        const [cacheEntry,] = cacheEntries;
        if (cacheEntry === undefined)
          throw new Error('Expected persistent summary cache entry.',);
        /** Exact persistent JSON before nested corruption. */
        const cacheText = readFileSync(join(cacheRoot, cacheEntry,), 'utf8',);
        /** Cache JSON with valid envelope and invalid nested parameter count. */
        const corruptText = cacheText.replace(
          '"parameterCount":1',
          '"parameterCount":"invalid"',
        );
        if (corruptText === cacheText)
          throw new Error('Expected serialized parameter count to corrupt.',);
        writeFileSync(
          join(cacheRoot, cacheEntry,),
          corruptText,
        );
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
        const secondSession = openSemanticFile({
          fileName: inputPath,
          sourceText: inputSource,
          hasBOM: false,
        },);
        buildEffectSummaryIndex({
          project: secondSession.project,
          activeSourceFile: secondSession.sourceFile,
          cacheRootOverride: cacheRoot,
        },);
        /** Counters proving malformed nested payload became a miss. */
        const recoveredStats = effectSummaryCacheStats();
        expect(recoveredStats.directSummaryBuildCount > 0,).toBe(true,);
        closeSemanticBridge();
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
      },
    },),
    it({
      name: 'reuses persistent summaries across independent Node processes',
      fn: async () => {
        using project = disposableCacheDirectory();
        /** Persistent cache isolated from concurrently changing fixture projects. */
        const cacheRoot = join(project.path, '.effect-cache',);
        /** Single-source project analyzed identically by both processes. */
        const inputPath = join(project.path, 'input.ts',);
        /** Independent process probe importing only built package API. */
        const probePath = join(project.path, 'persistent-probe.mjs',);
        writeFileSync(
          join(project.path, 'tsconfig.json',),
          '{"compilerOptions":{"strict":true},"include":["input.ts"]}\n',
        );
        writeFileSync(
          inputPath,
          'export function inspect(value: { text: string; }): string { return value.text; }\n',
        );
        /** Probe source printing cache counters for exact fixture analysis. */
        const probeSource = `import { readFileSync } from 'node:fs';\nimport { buildEffectSummaryIndex, closeSemanticBridge, effectSummaryCacheStats, openSemanticFile } from ${JSON.stringify(BUILT_ENTRY_URL)};\nconst [fileName, cacheRoot] = process.argv.slice(2);\nconst sourceText = readFileSync(fileName, 'utf8');\nconst session = openSemanticFile({ fileName, sourceText, hasBOM: false });\nbuildEffectSummaryIndex({ project: session.project, activeSourceFile: session.sourceFile, cacheRootOverride: cacheRoot });\nconsole.log(JSON.stringify(effectSummaryCacheStats()));\ncloseSemanticBridge();\n`;
        writeFileSync(probePath, probeSource,);
        const first = await spawn(
          'node',
          [probePath, inputPath, cacheRoot,],
        );
        const second = await spawn(
          'node',
          [probePath, inputPath, cacheRoot,],
        );
        /** Cold-process counters showing direct analysis and writes. */
        const coldStats = JSON.parse(first.stdout.trim(),) as {
          readonly directSummaryBuildCount: number;
          readonly persistentSourceCacheHitCount: number;
        };
        /** Warm-process counters showing persistent reuse without direct analysis. */
        const warmStats = JSON.parse(second.stdout.trim(),) as {
          readonly directSummaryBuildCount: number;
          readonly persistentSourceCacheHitCount: number;
        };
        expect(coldStats.directSummaryBuildCount > 0,).toBe(true,);
        expect(coldStats.persistentSourceCacheHitCount,).toBe(0,);
        expect(warmStats.directSummaryBuildCount,).toBe(0,);
        expect(warmStats.persistentSourceCacheHitCount > 0,).toBe(true,);
      },
    },),
    it({
      name: 'completes the foreign-borrowed graph when a usage sits at module top level',
      fn: async () => {
        using projectRoot = disposableCacheDirectory();
        /** Marker source directory preserving exact semantic identity suffix. */
        const markerRoot = join(
          projectRoot.path,
          'ownership-marker',
          'foreign-borrowed',
          'src',
        );
        /** Active foreign-boundary source. */
        const foreignPath = join(projectRoot.path, 'foreign.ts',);
        /** Shared helper reached through the marked boundary. */
        const helperPath = join(projectRoot.path, 'helper.ts',);
        /**
         * Active source whose boundary is itself invoked at module top level.
         *
         * The inbound walk for `readForeign` starts at that trailing call and
         * passes no callable before the source file, which is the shape that
         * previously stepped off the root.
         */
        const foreignSource = "import type { ForeignBorrowed, } from './ownership-marker/foreign-borrowed/src/index.js';\nimport { read, } from './helper.js';\nexport function readForeign(value: ForeignBorrowed<{ text: string; }>,): string { return read(value); }\nexport const eager: string = readForeign({ text: 'top level', },);\n";
        mkdirSync(markerRoot, { recursive: true, },);
        writeFileSync(
          join(projectRoot.path, 'tsconfig.json',),
          '{"compilerOptions":{"strict":true},"include":["**/*.ts"]}\n',
        );
        writeFileSync(
          join(markerRoot, 'index.ts',),
          'declare const FOREIGN_BORROWED_MARKER: unique symbol;\nexport type ForeignBorrowed<Value> = Value & { readonly [FOREIGN_BORROWED_MARKER]?: true; };\n',
        );
        writeFileSync(foreignPath, foreignSource,);
        writeFileSync(
          helperPath,
          'export function read(value: { text: string; },): string { return value.text; }\n',
        );
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
        const session = openSemanticFile({
          fileName: foreignPath,
          sourceText: foreignSource,
          hasBOM: false,
        },);
        /** Index build threw before the parent walk guarded the root. */
        const index = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
          cacheRootOverride: join(projectRoot.path, '.effect-cache',),
        },);
        /** Active boundary declaration retaining explicit foreign provenance. */
        const foreignDeclaration = session.nodeAtOffset(foreignSource.indexOf('readForeign',),)
          .parent;
        if (!isFunctionLikeDeclaration(foreignDeclaration,))
          throw new Error('Expected active foreign boundary declaration.',);
        /** Active boundary summary proving graph completion survived the walk. */
        const foreignSummary = index.get(foreignDeclaration,);
        if (foreignSummary === NO_EFFECT_SUMMARY)
          throw new Error('Expected active foreign boundary summary.',);
        expect([...index.proveForeignBorrowed(foreignDeclaration,),],).toEqual([0,],);
        closeSemanticBridge();
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
      },
    },),
  ],
},);

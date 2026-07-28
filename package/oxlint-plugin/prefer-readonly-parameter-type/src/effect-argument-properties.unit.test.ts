import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { isFunctionLikeDeclaration, } from 'typescript/unstable/ast/is';
import { readFileSync, } from 'node:fs';
import { fileURLToPath, } from 'node:url';

import {
  buildEffectSummaryIndex,
  closeSemanticBridge,
  NO_EFFECT_SUMMARY,
  openSemanticFile,
} from '../dist/final/node/index.mjs';

/** Fixture pairing one narrowing shape per caller with the callee it hands rows to. */
const NARROWING_PATH = fileURLToPath(new URL(
  '../../../test-fixture/oxlint-no-restricted-syntax/src/readonly-slot-narrowing-invalid.ts',
  import.meta.url,
),);

/** Current narrowing-fixture text. */
const NARROWING_SOURCE = readFileSync(
  NARROWING_PATH,
  'utf8',
);

await describe({
  name: 'caller-side property matching',
  concurrency: 1,
  children: [
    it({
      name: 'narrows to the property that fills a slot, and withholds it wherever that would lose a write',
      fn: async () => {
        /* Both directions in one place, because either alone reads as the other's bug.
         * A narrowing that never fires looks like precision that was never recovered, and
         * one that fires everywhere looks the same as a correct one until something
         * measures a shape it should have refused. */
        const session = openSemanticFile({
          fileName: NARROWING_PATH,
          sourceText: NARROWING_SOURCE,
          hasBOM: false,
        },);
        const index = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
        },);
        /**
         * Reads the written parameter positions of one fixture caller.
         *
         * Reads `referentMutatedParameterIndexes` rather than the union with the invoked
         * set, because the readonly offer is gated on that set alone.
         *
         * @param functionName - Exported fixture caller to inspect.
         *
         * @returns written parameter positions in ascending order.
         */
        function writtenIndexes(functionName: string,): readonly number[] {
          /**
           * Name node of the declaration under test.
           */
          const nameNode = session.nodeAtOffset(
            NARROWING_SOURCE.indexOf(`function ${functionName}`,)
              + 'function '.length,
          );
          /**
           * Declaration the name belongs to.
           */
          const declaration = nameNode.parent;
          if (!isFunctionLikeDeclaration(declaration,))
            throw new Error(`Expected a declaration for ${functionName}.`,);
          /**
           * Summary of that declaration.
           */
          const summary = index.get(declaration,);
          if (summary === NO_EFFECT_SUMMARY)
            throw new Error(`Expected an effect summary for ${functionName}.`,);
          /* Explicit numeric compare, since the default sort is lexicographic. */
          return [...summary.referentMutatedParameterIndexes,]
            .toSorted(function byIndex(
              left: number,
              right: number,
            ): number {
              return left - right;
            },);
        }
        /** Each row handed to the property the callee names. */
        const plainKey = writtenIndexes('plainKeyNarrowing',);
        /** Both rows handed over through shorthand properties. */
        const shorthandKey = writtenIndexes('shorthandKeyNarrowing',);
        /** Keys quoted where the callee reads them unquoted. */
        const quotedKey = writtenIndexes('quotedKeyNarrowing',);
        /** Callee binding the written property under another name. */
        const renamedKey = writtenIndexes('renamedKeyNarrowing',);
        /** Numeric key spelled `1e0` against a callee reading `1`. */
        const numericKey = writtenIndexes('numericKeyNarrowing',);
        /** Row packaged one literal below the property the callee names. */
        const nestedValue = writtenIndexes('nestedValueNarrowing',);
        /** Row returned by a method the callee calls. */
        const methodResult = writtenIndexes('methodResultNarrowing',);
        /** Spread placed before the exact key that shadows it. */
        const spreadBefore = writtenIndexes('spreadBeforeKeyNarrowing',);
        /** Spread placed after the key it can overwrite. */
        const spreadAfter = writtenIndexes('spreadAfterKeyBroadcast',);
        /** Property filled under a key resolved at runtime. */
        const computedKey = writtenIndexes('computedKeyBroadcast',);
        /** Property served from an explicit prototype rather than an own key. */
        const prototypeKey = writtenIndexes('prototypeKeyBroadcast',);
        /** Property defined by a getter with an origin-free setter after it. */
        const accessorKey = writtenIndexes('accessorKeyBroadcast',);
        /** Getter reaching its row through `this` rather than through its own value. */
        const thisAccessor = writtenIndexes('thisAccessorBroadcast',);
        /** Literal handed to a rest formal that destructures it by index. */
        const restIndex = writtenIndexes('restIndexBroadcast',);
        closeSemanticBridge();
        /* Narrowing, measured. Every one of these read `[0, 1]` while the edge repeated an
         * argument's whole origin set on every property slot, and the second parameter in
         * each is one the callee only reads. Quoting, renaming and numeric spelling are
         * separate assertions because each is a distinct way for the two sides of the key
         * comparison to disagree, and disagreement drops the origin rather than widening
         * it. */
        expect(plainKey,).toEqual([0,],);
        expect(shorthandKey,).toEqual([0,],);
        expect(quotedKey,).toEqual([0,],);
        expect(renamedKey,).toEqual([0,],);
        expect(numericKey,).toEqual([0,],);
        expect(nestedValue,).toEqual([0,],);
        expect(methodResult,).toEqual([0,],);
        /* A later exact key shadows an earlier spread at runtime, so the spread's row is
         * not reachable through that property and the walk stops at the exact match. */
        expect(spreadBefore,).toEqual([0,],);
        /* Withheld, and each for its own reason. A spread after the key can overwrite it,
         * so both rows stay named. */
        expect(spreadAfter,).toEqual([
          0,
          1,
        ],);
        /* A computed key could name the property the callee reads, so it contributes and
         * the walk continues past it. */
        expect(computedKey,).toEqual([
          0,
          1,
        ],);
        /* The sharpest case. `{ __proto__: { named: second }, spare: first }` defines no own
         * `named`, and the callee writes through the prototype's, so `second` is written and
         * `first` is not. Reading `__proto__` as an ordinary key attributes that write to
         * nothing at all and reads `[]` here, which is an offer for a row something
         * mutates. */
        expect(prototypeKey,).toEqual([1,],);
        /* An accessor pair whose setter comes last carries no origin, so stopping at the
         * first exact match from the end would drop the getter's row. */
        expect(accessorKey,).toEqual([
          0,
          1,
        ],);
        /* A getter reaching its row through `this` puts the origin under a different key
         * entirely, which no walk of the accessor body finds. */
        expect(thisAccessor,).toEqual([
          0,
          1,
        ],);
        /* A rest formal's key `0` names an array index rather than a property of the
         * literal, so resolving it against the literal finds nothing. One parameter here,
         * and it has to stay named. */
        expect(restIndex,).toEqual([0,],);
      },
    },),
  ],
},);

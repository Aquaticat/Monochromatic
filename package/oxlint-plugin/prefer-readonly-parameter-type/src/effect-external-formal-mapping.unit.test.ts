/**
 * Whether external formal positions are mapped from argument positions, or indexed as if identical.
 *
 * Its own test because no shape in the fixture corpus reaches this through a diagnostic. Doing so needs
 * an installed package with a locked version whose shipped implementation provably mutates a formal,
 * invoked with a spread. A mutant restoring the previous actual-position indexing survived the whole
 * suite, so the mapping had to be exercised directly or it would have landed untested.
 *
 * What the mapping being wrong costs is a dropped fact rather than an invented one. A proven mutation of
 * a later formal read an index that did not exist and recorded nothing, so an offer stood where the
 * external analyzer had already disproved it.
 *
 * @module
 */

import { fileURLToPath, } from 'node:url';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  isCallExpression,
  isFunctionDeclaration,
} from 'typescript/unstable/ast/is';

import {
  asEffectSlot,
  closeSemanticBridge,
  formalArgumentIndexes,
  openSemanticFile,
} from '../dist/final/node/index.mjs';

/**
 * Repository path the overlay stands in for, so project discovery succeeds.
 */
const OVERLAY_PATH = fileURLToPath(new URL(
  '../../../test-fixture/oxlint-no-restricted-syntax/src/readonly-structural-store-invalid.ts',
  import.meta.url,
),);

/**
 * Source declaring one plain callee and one rest callee, called four ways.
 *
 * Each call is named by the local it initializes, so a test can find it by that name rather than by
 * counting call expressions.
 */
const SOURCE = `
export function plainCallee(first: string, second: string, third: string,): string {
  return first + second + third;
}

export function restCallee(head: string, ...tail: readonly string[],): string {
  return head + tail.join('',);
}

export function driver(alpha: string, beta: string, gamma: string,): readonly string[] {
  const positional = plainCallee(alpha, beta, gamma,);
  const spreadTail = plainCallee(alpha, ...[beta, gamma,],);
  const spreadWhole = plainCallee(...[alpha, beta, gamma,],);
  const restReceiving = restCallee(alpha, beta, gamma,);
  return [positional, spreadTail, spreadWhole, restReceiving,];
}
`;

/**
 * Origins standing in for what each argument position carries, one distinct slot per position.
 *
 * Slot values are arbitrary and distinct, so a mapping that reads the wrong position produces a
 * visibly wrong answer rather than a coincidentally right one.
 */
const ARGUMENT_ORIGINS = [
  [asEffectSlot(10,),],
  [asEffectSlot(20,),],
  [asEffectSlot(30,),],
];

await describe({
  name: 'external formal-to-actual mapping',
  concurrency: 1,
  children: [
    it({
      name: 'maps a plain positional call one formal to one actual',
      fn: () => {
        const { mapping, } = mapCall({
          calleeName: 'plainCallee',
          callName: 'positional',
        },);
        /* The case that predates the mapping and must be unchanged by it, since every offer standing
         * today rests on this shape answering exactly as it did. */
        expect(mapping,).toEqual([
          [asEffectSlot(10,),],
          [asEffectSlot(20,),],
          [asEffectSlot(30,),],
        ],);
      },
    },),
    it({
      name: 'gives every formal at or past a spread every actual from the spread onward',
      fn: () => {
        const { mapping, } = mapCall({
          calleeName: 'plainCallee',
          callName: 'spreadTail',
        },);
        /* One syntactic argument supplies an unknown number of formals, so positional correspondence
         * is gone from the spread onward. Formals two and three may each receive the spread, and the
         * actual-position indexing answered nothing for formal three because the call writes two
         * arguments. That silence is what dropped a proven mutation. */
        expect(mapping,).toEqual([
          [asEffectSlot(10,),],
          [asEffectSlot(20,),],
          [asEffectSlot(20,),],
        ],);
      },
    },),
    it({
      name: 'gives every formal the spread when the whole argument list is one spread',
      fn: () => {
        const { mapping, } = mapCall({
          calleeName: 'plainCallee',
          callName: 'spreadWhole',
        },);
        expect(mapping,).toEqual([
          [asEffectSlot(10,),],
          [asEffectSlot(10,),],
          [asEffectSlot(10,),],
        ],);
      },
    },),
    it({
      name: 'gives a rest formal every actual from its own position onward',
      fn: () => {
        const { mapping, } = mapCall({
          calleeName: 'restCallee',
          callName: 'restReceiving',
        },);
        /* The second failure direction. Indexing by formal position charged the rest formal the second
         * actual alone and missed the third. */
        expect(mapping,).toEqual([
          [asEffectSlot(10,),],
          [asEffectSlot(20,), asEffectSlot(30,),],
        ],);
      },
    },),
    it({
      name: 'answers empty for a declaration whose formals cannot be read',
      fn: () => {
        const session = openSemanticFile({
          fileName: OVERLAY_PATH,
          sourceText: SOURCE,
          hasBOM: false,
        },);
        try {
          /* A declaration with no formal list orders nothing, so the mapping declines rather than
           * guessing, and the applier charges every argument's origins instead. */
          expect(formalArgumentIndexes({
            declaration: session.sourceFile,
            call: callNamed({
              session,
              callName: 'positional',
            },),
            allArgumentIndexes: ARGUMENT_ORIGINS,
          },),).toEqual([],);
        }
        finally {
          closeSemanticBridge();
        }
      },
    },),
  ],
},);

/**
 * Maps one named call against one named callee's formals.
 *
 * @param calleeName - Declaration whose formals order the arguments.
 *
 * @param callName - Local the call initializes, used to find that call.
 *
 * @returns mapping from formal position to caller origins.
 *
 * @example
 * ```ts
 * mapCall({ calleeName: 'plainCallee', callName: 'positional' });
 * ```
 */
function mapCall({
  calleeName,
  callName,
}: {
  readonly calleeName: string;
  readonly callName: string;
},): { readonly mapping: readonly (readonly number[])[]; } {
  /**
   * Semantic session over the overlay.
   */
  const session = openSemanticFile({
    fileName: OVERLAY_PATH,
    sourceText: SOURCE,
    hasBOM: false,
  },);
  try {
    /**
     * Name node of the requested callee declaration.
     */
    const calleeName_ = session.nodeAtOffset(
      SOURCE.indexOf(`function ${calleeName}`,) + 'function '.length,
    );
    /**
     * Declaration owning that name.
     */
    const declaration = calleeName_.parent;
    if (!isFunctionDeclaration(declaration,))
      throw new Error(`${calleeName} did not resolve to a function declaration`,);
    return {
      mapping: formalArgumentIndexes({
        declaration,
        call: callNamed({
          session,
          callName,
        },),
        allArgumentIndexes: ARGUMENT_ORIGINS,
      },),
    };
  }
  finally {
    closeSemanticBridge();
  }
}

/**
 * Finds the call expression initializing one named local.
 *
 * @param session - Open semantic session over the overlay.
 *
 * @param callName - Local the call initializes.
 *
 * @returns call expression that local is initialized with.
 *
 * @example
 * ```ts
 * callNamed({ session, callName: 'positional' });
 * ```
 */
function callNamed({
  session,
  callName,
}: {
  readonly session: ReturnType<typeof openSemanticFile>;
  readonly callName: string;
},): ReturnType<typeof session.nodeAtOffset> {
  /**
   * Offset of the callee name written just after the local's assignment.
   */
  const at = SOURCE.indexOf('Callee(', SOURCE.indexOf(`const ${callName} =`,),);
  /**
   * Node at that callee name.
   */
  const calleeReference = session.nodeAtOffset(at,);
  /**
   * Call expression that reference is the callee of.
   */
  const call = calleeReference.parent;
  if (!isCallExpression(call,))
    throw new Error(`${callName} did not resolve to a call expression`,);
  return call;
}

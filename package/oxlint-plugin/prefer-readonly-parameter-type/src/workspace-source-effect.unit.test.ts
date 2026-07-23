import { readFileSync, } from 'node:fs';
import { fileURLToPath, } from 'node:url';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { isFunctionLikeDeclaration, } from 'typescript/unstable/ast/is';

import {
  buildEffectSummaryIndex,
  closeSemanticBridge,
  NO_EFFECT_SUMMARY,
  openSemanticFile,
} from '../dist/final/node/index.mjs';

/**
 * File-enforcer source calling workspace `module-toml-edit` functions.
 */
const APPLY_PLAN_PATH = fileURLToPath(new URL(
  '../../../dev-script/file-enforcer/src/cargo/apply-plan.ts',
  import.meta.url,
),);

/**
 * Current apply-plan source text.
 */
const SOURCE = readFileSync(
  APPLY_PLAN_PATH,
  'utf8',
);

await describe({
  name: 'workspace source effect resolution',
  concurrency: 1,
  children: [
    it({
      name: 'resolves workspace package calls through live source without catalog entries',
      fn: async () => {
        const session = openSemanticFile({
          fileName: APPLY_PLAN_PATH,
          sourceText: SOURCE,
          hasBOM: false,
        },);
        const index = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
        },);
        /* The tomlSet chain formerly forced @mutates contracts up through
         * applyCargoPlan; live workspace analysis plus plain-data traversal
         * narrowing proves the whole chain effect-free. */
        const summaries = [
          'setIfDiffers',
          'applyEnforcement',
          'applyCargoPlan',
        ].map(function summaryFor(functionName,) {
          const nameNode = session.nodeAtOffset(
            SOURCE.indexOf(`function ${functionName}`,) + 'function '.length,
          );
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
        closeSemanticBridge();
        expect(summaries,).toEqual([
          {
            functionName: 'setIfDiffers',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'applyEnforcement',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'applyCargoPlan',
            mutated: [],
            opaque: [0,],
          },
        ],);
      },
    },),
  ],
},);

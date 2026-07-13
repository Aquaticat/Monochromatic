import { readFileSync, } from 'node:fs';
import { fileURLToPath, } from 'node:url';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  classifyReadonlyType,
  closeSemanticBridge,
  openSemanticFile,
} from '../dist/final/node/index.mjs';

/** Readonly classifier semantic fixture. */
const FIXTURE_PATH = fileURLToPath(new URL(
  '../../../test-fixture/oxlint-no-restricted-syntax/src/valid/typescript-sync-adapter.ts',
  import.meta.url,
),);

/** Current classifier fixture text. */
const SOURCE = readFileSync(
  FIXTURE_PATH,
  'utf8',
);

await describe({
  name: classifyReadonlyType.name,
  concurrency: 1,
  children: [
      {
        parameter: 'mutableObject:',
        expected: 'mutable',
      },
      {
        parameter: 'readonlyObject:',
        expected: 'honest-readonly',
      },
      {
        parameter: 'projectedController:',
        expected: 'dishonest-readonly',
      },
      {
        parameter: 'capabilityController:',
        expected: 'opaque-capability',
      },
      {
        parameter: 'readonlyMap:',
        expected: 'honest-readonly',
      },
      {
        parameter: 'readonlyValues:',
        expected: 'honest-readonly',
      },
      {
        parameter: 'shallowReadonlyValues:',
        expected: 'mutable',
      },
    ].map(function classificationCase({ parameter, expected, },) {
      return it({
        name: `classifies ${parameter} as ${expected}`,
        fn: async () => {
          const session = openSemanticFile({
            fileName: FIXTURE_PATH,
            sourceText: SOURCE,
            hasBOM: false,
          },);
          const parameterNode = session.nodeAtOffset(SOURCE.indexOf(parameter,),);
          const type = session.checker.getTypeAtLocation(parameterNode,);
          if (type === undefined)
            throw new Error(`Expected semantic type for ${parameter}.`,);
          const classification = classifyReadonlyType({
            checker: session.checker,
            project: session.project,
            type,
          },);
          closeSemanticBridge();
          expect(classification.kind,).toBe(expected,);
        },
      },);
    },),
},);

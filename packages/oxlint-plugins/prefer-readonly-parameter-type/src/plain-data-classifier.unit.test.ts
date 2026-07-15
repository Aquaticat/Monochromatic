import { readFileSync, } from 'node:fs';
import { fileURLToPath, } from 'node:url';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  closeSemanticBridge,
  openSemanticFile,
  typeIsPlainData,
} from '../dist/final/node/index.mjs';

/**
 * Plain-data classifier semantic fixture.
 */
const FIXTURE_PATH = fileURLToPath(new URL(
  '../../../test-fixture/oxlint-no-restricted-syntax/src/valid/plain-data-classifier.ts',
  import.meta.url,
),);

/**
 * Current plain-data fixture text.
 */
const SOURCE = readFileSync(
  FIXTURE_PATH,
  'utf8',
);

await describe({
  name: typeIsPlainData.name,
  concurrency: 1,
  children: [
      {
        parameter: 'plainPrimitive:',
        expected: true,
      },
      {
        parameter: 'brandedPrimitive:',
        expected: true,
      },
      {
        parameter: 'plainUnion:',
        expected: true,
      },
      {
        parameter: 'plainArray:',
        expected: true,
      },
      {
        parameter: 'plainTuple:',
        expected: true,
      },
      {
        parameter: 'plainRecord:',
        expected: true,
      },
      {
        parameter: 'plainNested:',
        expected: true,
      },
      {
        parameter: 'tomlLikeValue:',
        expected: true,
      },
      {
        parameter: 'unknownValue:',
        expected: false,
      },
      {
        parameter: 'objectValue:',
        expected: false,
      },
      {
        parameter: 'unknownIndexValue:',
        expected: false,
      },
      {
        parameter: 'callableProperty:',
        expected: false,
      },
      {
        parameter: 'methodValue:',
        expected: false,
      },
      {
        parameter: 'functionValue:',
        expected: false,
      },
      {
        parameter: 'classInstance:',
        expected: false,
      },
      {
        parameter: 'accessorInstance:',
        expected: false,
      },
      {
        parameter: 'mapValue:',
        expected: false,
      },
      {
        parameter: 'genericValue:',
        expected: false,
      },
  ].map(function plainDataCase({ parameter, expected, },) {
      return it({
        name: `classifies ${parameter} plain data as ${String(expected,)}`,
        fn: async () => {
          const session = openSemanticFile({
            fileName: FIXTURE_PATH,
            sourceText: SOURCE,
            hasBOM: false,
          },);
          const parameterNode = session.nodeAtOffset(SOURCE.indexOf(parameter,),);
          const type = session.checker
            .getTypeAtLocation(parameterNode,);
          if (type === undefined)
            throw new Error(`Expected semantic type for ${parameter}.`,);
          const plain = typeIsPlainData({
            checker: session.checker,
            project: session.project,
            type,
          },);
          closeSemanticBridge();
          expect(plain,).toBe(expected,);
        },
      },);
    },),
},);

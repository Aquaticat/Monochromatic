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

/** Project-owned foreign marker fixture source. */
const FOREIGN_FIXTURE_PATH = fileURLToPath(new URL(
  'prefer-readonly-parameter-types.ts',
  import.meta.url,
),);

/** Current foreign marker fixture text. */
const FOREIGN_SOURCE = readFileSync(
  FOREIGN_FIXTURE_PATH,
  'utf8',
);

await describe({
  name: classifyReadonlyType.name,
  concurrency: 1,
  children: [
    ...[
      {
        parameter: 'mutableObject:',
        expected: 'mutable',
      },
      {
        parameter: 'readonlyObject:',
        expected: 'honest-readonly',
      },
      {
        parameter: 'objectValue:',
        expected: 'opaque-capability',
      },
      {
        parameter: 'callableValue:',
        expected: 'opaque-capability',
      },
      {
        parameter: 'constructorValue:',
        expected: 'opaque-capability',
      },
      {
        parameter: 'unknownValue:',
        expected: 'opaque-capability',
      },
      {
        parameter: 'anyValue:',
        expected: 'opaque-capability',
      },
      {
        parameter: 'readonlyEncoder:',
        expected: 'dishonest-readonly',
      },
      {
        parameter: 'encodeOnly:',
        expected: 'opaque-capability',
      },
      {
        parameter: 'projectedController:',
        expected: 'honest-readonly',
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
      {
        parameter: 'shallowReadonlyMap:',
        expected: 'mutable',
      },
      {
        parameter: 'projectedMethod:',
        expected: 'dishonest-readonly',
      },
      {
        parameter: 'originalMethod:',
        expected: 'opaque-capability',
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
    it({
      name: 'classifies a cycle member the same whichever member is asked for first',
      fn: async () => {
        /* One session for both, because the defect this guards is the shared classification
         * store carrying an answer from the first walk into the second. Two sessions would pass
         * with the guard removed. */
        const session = openSemanticFile({
          fileName: FIXTURE_PATH,
          sourceText: SOURCE,
          hasBOM: false,
        },);
        /**
         * Kinds for both cycle parameters, head asked for first.
         */
        const kinds = [
          'cycleHead:',
          'cycleMember:',
        ].map(function classifyCycleParameter(parameter,): string {
          const parameterNode = session.nodeAtOffset(SOURCE.indexOf(parameter,),);
          const type = session.checker
            .getTypeAtLocation(parameterNode,);
          if (type === undefined)
            throw new Error(`Expected semantic type for ${parameter}.`,);
          return classifyReadonlyType({
            checker: session.checker,
            project: session.project,
            type,
          },).kind;
        },);
        closeSemanticBridge();
        /* Both reach the head's writable slot, the member through readonly properties alone.
         * Reading honest-readonly for the member is the wrong-offer direction: it withholds the
         * opaque effect an outward handoff would charge. */
        expect(kinds,).toEqual([
          'mutable',
          'mutable',
        ],);
      },
    },),
    it({
      name: 'classifies exact foreign borrowed marker as capability',
      fn: async () => {
        const session = openSemanticFile({
          fileName: FOREIGN_FIXTURE_PATH,
          sourceText: FOREIGN_SOURCE,
          hasBOM: false,
        },);
        const parameterNode = session.nodeAtOffset(FOREIGN_SOURCE.indexOf('context: ForeignBorrowed',),);
        const type = session.checker.getTypeAtLocation(parameterNode,);
        if (type === undefined)
          throw new Error('Expected semantic foreign borrowed type.',);
        const classification = classifyReadonlyType({
          checker: session.checker,
          project: session.project,
          type,
        },);
        closeSemanticBridge();
        expect(classification.kind,).toBe('opaque-capability',);
      },
    },),
  ],
},);

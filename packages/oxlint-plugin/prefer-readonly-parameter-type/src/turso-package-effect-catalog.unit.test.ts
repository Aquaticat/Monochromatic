import { readFileSync, } from 'node:fs';
import { fileURLToPath, } from 'node:url';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  closeSemanticBridge,
  intrinsicEffect,
  intrinsicEffectQuery,
  NO_INTRINSIC_EFFECT,
  openSemanticFile,
} from '../dist/final/node/index.mjs';
import { isPropertyAccessExpression, } from 'typescript/unstable/ast/is';

/**
 * Done migration source used for exact Turso declaration provenance.
 */
const MIGRATION_SOURCE_PATH = fileURLToPath(new URL(
  '../../../webapp-productivity/done/src/lib/db-migrations.ts',
  import.meta.url,
),);

/**
 * Done migration source text containing audited database calls.
 */
const MIGRATION_SOURCE = readFileSync(MIGRATION_SOURCE_PATH, 'utf8',);

await describe({
  name: 'Turso package effects',
  children: [
    it({
      name: 'records receiver and native argument effects',
      fn: async () => {
        const effect = intrinsicEffect({
          provenance: {
            kind: 'package',
            packageName: '@tursodatabase/database-common',
            major: 0,
          },
          ownerType: 'Database',
          member: 'exec',
        },);
        expect(effect,).not.toBe(NO_INTRINSIC_EFFECT,);
        if (effect === NO_INTRINSIC_EFFECT)
          throw new Error('Expected Turso database exec effect.',);
        expect(effect.targets,).toEqual([{ kind: 'receiver', },],);
        expect(effect.opaqueTargets,).toEqual([
          { kind: 'argument', index: 0, },
          { kind: 'argument', index: 1, },
        ],);
        expect(intrinsicEffect({
          provenance: {
            kind: 'package',
            packageName: '@tursodatabase/database-common',
            major: 1,
          },
          ownerType: 'Database',
          member: 'exec',
        },),).toBe(NO_INTRINSIC_EFFECT,);
      },
    },),
    it({
      name: 'resolves exact Turso owner from Done source',
      fn: async () => {
        const session = openSemanticFile({
          fileName: MIGRATION_SOURCE_PATH,
          sourceText: MIGRATION_SOURCE,
          hasBOM: false,
        },);
        const pattern = 'database.exec';
        const memberOffset = MIGRATION_SOURCE.indexOf(pattern,) + pattern.lastIndexOf('.',) + 1;
        const memberNode = session.nodeAtOffset(memberOffset,);
        const propertyAccess = memberNode.parent;
        if (!isPropertyAccessExpression(propertyAccess,))
          throw new Error('Expected database exec property access.',);
        const receiverType = session.checker.getTypeAtLocation(propertyAccess.expression,);
        const memberSymbol = session.checker.getSymbolAtLocation(propertyAccess.name,);
        if ((receiverType === undefined) || (memberSymbol === undefined))
          throw new Error('Expected database exec semantic identity.',);
        const query = intrinsicEffectQuery({
          project: session.project,
          receiverType,
          memberSymbol,
        },);
        closeSemanticBridge();
        expect(query,).toEqual({
          provenance: {
            kind: 'package',
            packageName: '@tursodatabase/database-common',
            major: 0,
          },
          ownerType: 'Database',
          member: 'exec',
        },);
      },
    },),
  ],
},);

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  intrinsicEffect,
  NO_INTRINSIC_EFFECT,
} from '../dist/final/node/index.mjs';

await describe({
  name: 'yuku-ast package effects',
  children: [
    it({
      name: 'records pure observation for node guards',
      fn: async () => {
        const effect = intrinsicEffect({
          provenance: {
            kind: 'package',
            packageName: 'yuku-ast',
            major: 0,
          },
          ownerType: '__type',
          member: 'TSType',
        },);
        expect(effect,).not.toBe(NO_INTRINSIC_EFFECT,);
        if (effect === NO_INTRINSIC_EFFECT)
          throw new Error('Expected yuku-ast TSType guard effect.',);
        expect(effect.targets,).toEqual([],);
        expect(effect.opaqueTargets,).toBe(undefined,);
      },
    },),
    it({
      name: 'covers every guard member repository code calls',
      fn: async () => {
        for (const member of [
          'TSDeclareFunction',
          'TSInterfaceDeclaration',
          'TSTypeAliasDeclaration',
          'TSTypeAnnotation',
          'TSTypeParameterDeclaration',
          'TSTypeParameterInstantiation',
        ]) {
          expect(intrinsicEffect({
            provenance: {
              kind: 'package',
              packageName: 'yuku-ast',
              major: 0,
            },
            ownerType: '__type',
            member,
          },),).not.toBe(NO_INTRINSIC_EFFECT,);
        }
      },
    },),
    it({
      name: 'records receiver mutation for walk-context skip',
      fn: async () => {
        const effect = intrinsicEffect({
          provenance: {
            kind: 'package',
            packageName: 'yuku-ast',
            major: 0,
          },
          ownerType: 'WalkContext',
          member: 'skip',
        },);
        expect(effect,).not.toBe(NO_INTRINSIC_EFFECT,);
        if (effect === NO_INTRINSIC_EFFECT)
          throw new Error('Expected yuku-ast skip effect.',);
        expect(effect.targets,).toEqual([{ kind: 'receiver', },],);
      },
    },),
    it({
      name: 'stays silent for unaudited majors',
      fn: async () => {
        expect(intrinsicEffect({
          provenance: {
            kind: 'package',
            packageName: 'yuku-ast',
            major: 1,
          },
          ownerType: '__type',
          member: 'TSType',
        },),).toBe(NO_INTRINSIC_EFFECT,);
      },
    },),
  ],
},);

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  INTRINSIC_EFFECTS,
  intrinsicEffect,
  NO_INTRINSIC_EFFECT,
} from '../dist/final/node/index.mjs';

await describe({
  name: intrinsicEffect.name,
  children: [
    it({
      name: 'matches exact ECMAScript owner and member symbols',
      fn: async () => {
        const effect = intrinsicEffect({
          provenance: { kind: 'ecmascript', },
          ownerType: 'Set',
          member: 'add',
        },);
        expect(effect,).not.toBe(NO_INTRINSIC_EFFECT,);
        if (effect === NO_INTRINSIC_EFFECT)
          throw new Error('Expected Set.add intrinsic effect.',);
        expect(effect.targets,).toEqual([{ kind: 'receiver', },],);
      },
    },),
    it({
      name: 'does not match method name on another owner',
      fn: async () => {
        expect(intrinsicEffect({
          provenance: { kind: 'ecmascript', },
          ownerType: 'Array',
          member: 'add',
        },),).toBe(NO_INTRINSIC_EFFECT,);
      },
    },),
    it({
      name: 'gates package effects by exact major version',
      fn: async () => {
        expect(intrinsicEffect({
          provenance: {
            kind: 'package',
            packageName: 'typescript',
            major: 7,
          },
          ownerType: 'API',
          member: 'updateSnapshot',
        },),).not.toBe(NO_INTRINSIC_EFFECT,);
        expect(intrinsicEffect({
          provenance: {
            kind: 'package',
            packageName: 'typescript',
            major: 6,
          },
          ownerType: 'API',
          member: 'updateSnapshot',
        },),).toBe(NO_INTRINSIC_EFFECT,);
      },
    },),
    it({
      name: 'records evidence for every audited entry',
      fn: async () => {
        expect(INTRINSIC_EFFECTS.every(function hasEvidence(entry,): boolean {
          return entry.evidence.length > 0;
        },),).toBe(true,);
      },
    },),
  ],
},);

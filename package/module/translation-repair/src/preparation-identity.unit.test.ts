/**
 Tests for the shape a preparation identity has, and the assertion that brands
 one.

 WHAT THESE PIN is that a recorded identity passes exactly the check a fresh
 one does, under either scheme this reader understands, and that a refusal
 names the whole shape. The artifact reader refuses a stored identity through
 the same predicate and writes its own reason, so this file is where the
 predicate's every branch is run (ledger B34).

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  caught,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  assertPreparationIdentity,
  isPreparationIdentityShaped,
  preparationIdentity,
  PreparationIdentityError,
  prepareDocumentPair,
} from '../dist/final/node/index.mjs';

/**
 Hex half every well-formed fixture carries.
 */
const HEX_HALF = 'c'.repeat(64,);

/**
 An identity a preparation of a small cat pair produces, which is the value
 every other case is read against.
 */
const FRESH_IDENTITY = preparationIdentity({
  prepared: prepareDocumentPair({
    sourceText: '猫在窗台上打盹。',
    targetText: 'The cat dozes on the windowsill.',
  },),
},);

await describe({
  name: isPreparationIdentityShaped.name,
  children: [
    it({
      name:
        'ACCEPTS what a preparation produces and either scheme this reader understands, which is the '
        + 'control the refusals are read against: a predicate refusing everything would pass them all',
      fn: async () => {
        expect(isPreparationIdentityShaped({ value: FRESH_IDENTITY, },),).toBe(true,);
        expect(isPreparationIdentityShaped({ value: `sha256-preparation-v1:${HEX_HALF}`, },),).toBe(true,);
        expect(isPreparationIdentityShaped({ value: `sha256-preparation-v2:${HEX_HALF}`, },),).toBe(true,);
      },
    },),
    it({
      name:
        'REFUSES a scheme it does not understand, and a hex half without its scheme name, since a later '
        + 'scheme is a different string on purpose and a bare hex string names no scheme at all',
      fn: async () => {
        expect(isPreparationIdentityShaped({ value: `sha256-preparation-v3:${HEX_HALF}`, },),).toBe(false,);
        expect(isPreparationIdentityShaped({ value: `sha256-tree-v1:${HEX_HALF}`, },),).toBe(false,);
        expect(isPreparationIdentityShaped({ value: `sha256-preparation-v2${HEX_HALF}`, },),).toBe(false,);
        expect(isPreparationIdentityShaped({ value: HEX_HALF, },),).toBe(false,);
        expect(isPreparationIdentityShaped({ value: '', },),).toBe(false,);
      },
    },),
    it({
      name:
        'REFUSES a hex half one character short or one long, which is a truncated or padded value rather '
        + 'than a digest',
      fn: async () => {
        expect(isPreparationIdentityShaped({ value: `sha256-preparation-v2:${HEX_HALF.slice(1,)}`, },),)
          .toBe(false,);
        expect(isPreparationIdentityShaped({ value: `sha256-preparation-v2:${HEX_HALF}c`, },),).toBe(false,);
      },
    },),
    it({
      name:
        'REFUSES a character no lowercase hex digest carries, upper case included, since this module only '
        + 'emits lower case and another spelling would name a second slicing',
      fn: async () => {
        expect(isPreparationIdentityShaped({ value: `sha256-preparation-v2:${HEX_HALF.toUpperCase()}`, },),)
          .toBe(false,);
        expect(isPreparationIdentityShaped({ value: `sha256-preparation-v2:${HEX_HALF.slice(1,)}g`, },),)
          .toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: assertPreparationIdentity.name,
  children: [
    it({
      name: 'ACCEPTS what a preparation produces, which is the value it brands',
      fn: async () => {
        expect(() => {
          assertPreparationIdentity(FRESH_IDENTITY,);
        },).not
          .toThrow();
      },
    },),
    it({
      name:
        'REFUSES a value no preparation produced, naming the whole shape an identity has and the value it '
        + 'was handed, so a caller can tell what is missing without reading this module',
      fn: async () => {
        /**
         What brandsWhiskers raised, read for its class as well as its wording.
         */
        const refusalOfWhiskers = caught(function brandsWhiskers() {
          assertPreparationIdentity('whiskers',);
        },);

        expect(refusalOfWhiskers,).toBeInstanceOf(PreparationIdentityError,);
        expect((refusalOfWhiskers as Error).message,)
          .toBe('A preparation identity is "sha256-preparation-v1:" or "sha256-preparation-v2:" followed by 64 '
            + 'lowercase hex characters; received "whiskers".',);
      },
    },),
  ],
},);

/**
 * Tests for comparing the provider's offering against the compiled catalog.
 *
 * The case that matters is the alias. The provider serves ids that are not
 * distinct models, and admitting one would let a single model take two seats on
 * a voting panel, so one opinion would be counted as two independent
 * confirmations. The other case that matters is a catalog id the provider has
 * dropped: that already happened twice on 2026-08-05 and cost a lost voice per
 * call, silently, because 404 is not a transient status.
 *
 * Model ids here are the real ones, since the rule under test is about their
 * relationships. No corpus text is involved.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  compareCatalog,
  decodeModelList,
} from '../../dist/final/node/index.mjs';

/**
 * Catalog the comparisons run against.
 */
const CATALOG: readonly string[] = [
  'hf:zai-org/GLM-5.2',
  'hf:moonshotai/Kimi-K3',
];

await describe({
  name: compareCatalog.name,
  children: [
    it({
      name: 'reports an id the provider no longer serves, which is the failure '
        + 'that already happened: two ids began answering 404, 404 is not in '
        + 'the transient retry set, and every stage holding one lost a voice '
        + 'per call while nothing said why',
      fn: async () => {
        expect(compareCatalog({
          served: [{ id: 'hf:zai-org/GLM-5.2', huggingFaceId: 'zai-org/GLM-5.2', },],
          catalog: CATALOG,
        },).missing,).toStrictEqual(['hf:moonshotai/Kimi-K3',],);
      },
    },),

    it({
      name: 'counts an ALIAS as an alias rather than as a new model, because '
        + 'seating it would let one model vote twice on a panel and a single '
        + 'opinion would read as two independent confirmations',
      fn: async () => {
        /**
         * Provider list carrying an alias onto a seated model.
         */
        const comparison = compareCatalog({
          served: [
            {
              id: 'hf:zai-org/GLM-5.2',
              huggingFaceId: 'zai-org/GLM-5.2',
            },
            {
              id: 'syn:large:text',
              huggingFaceId: 'zai-org/GLM-5.2',
            },
          ],
          catalog: CATALOG,
        },);

        expect(comparison.unlisted,).toHaveLength(0,);
        expect(comparison.aliases
          .map(function toId(model,) {
          return model.id;
        },),).toStrictEqual(['syn:large:text',],);
      },
    },),

    it({
      name: 'reports a genuinely new model as UNLISTED, which is the only kind '
        + 'that could judge an issue independently: critics, panel and judges '
        + 'are all the same roster, so every seated model already ruled on '
        + 'every issue',
      fn: async () => {
        expect(compareCatalog({
          served: [
            {
              id: 'hf:zai-org/GLM-5.2',
              huggingFaceId: 'zai-org/GLM-5.2',
            },
            {
              id: 'hf:moonshotai/Kimi-K3',
              huggingFaceId: 'moonshotai/Kimi-K3',
            },
            {
              id: 'hf:someone/Newcomer-1',
              huggingFaceId: 'someone/Newcomer-1',
            },
          ],
          catalog: CATALOG,
        },).unlisted
          .map(function toId(model,) {
          return model.id;
        },),).toStrictEqual(['hf:someone/Newcomer-1',],);
      },
    },),

    it({
      name: 'counts TWO aliases onto one new model as one new model and one '
        + 'alias, so a provider that exposes a model under several names '
        + 'cannot inflate how many independent voices are available',
      fn: async () => {
        /**
         * One new model served under two ids.
         */
        const comparison = compareCatalog({
          served: [
            {
              id: 'hf:someone/Newcomer-1',
              huggingFaceId: 'someone/Newcomer-1',
            },
            {
              id: 'syn:newcomer',
              huggingFaceId: 'someone/Newcomer-1',
            },
          ],
          catalog: CATALOG,
        },);

        expect(comparison.unlisted,).toHaveLength(1,);
        expect(comparison.aliases,).toHaveLength(1,);
      },
    },),

    it({
      name: 'reports nothing in any direction when the provider serves exactly '
        + 'the catalog, so a clean check is distinguishable from one that '
        + 'failed to compare anything',
      fn: async () => {
        /**
         * Provider list matching the catalog exactly.
         */
        const comparison = compareCatalog({
          served: [
            {
              id: 'hf:zai-org/GLM-5.2',
              huggingFaceId: 'zai-org/GLM-5.2',
            },
            {
              id: 'hf:moonshotai/Kimi-K3',
              huggingFaceId: 'moonshotai/Kimi-K3',
            },
          ],
          catalog: CATALOG,
        },);

        expect(comparison.missing,).toHaveLength(0,);
        expect(comparison.unlisted,).toHaveLength(0,);
        expect(comparison.aliases,).toHaveLength(0,);
      },
    },),
  ],
},);

await describe({
  name: decodeModelList.name,
  children: [
    it({
      name: 'reads id and underlying model from a well-formed list',
      fn: async () => {
        expect(decodeModelList({
          body: {
            data: [
              {
                id: 'syn:large:text',
                hugging_face_id: 'zai-org/GLM-5.2',
              },
            ],
          },
        },),).toStrictEqual([
          {
            id: 'syn:large:text',
            huggingFaceId: 'zai-org/GLM-5.2',
          },
        ],);
      },
    },),

    it({
      name: 'leaves the underlying model EMPTY when the provider states none, '
        + 'rather than inventing one, since an id with no stated model is its '
        + 'own identity and guessing would merge two distinct voices',
      fn: async () => {
        expect(decodeModelList({ body: { data: [{ id: 'hf:someone/Newcomer-1', },], }, },),)
          .toStrictEqual([
            {
              id: 'hf:someone/Newcomer-1',
              huggingFaceId: '',
            },
          ],);
      },
    },),

    it({
      name: 'THROWS on a body with no data array rather than reporting an '
        + 'empty offering, because an empty list reads as "the provider serves '
        + 'nothing" and would mark the whole catalog missing',
      fn: async () => {
        expect(function decodeGarbage() {
          return decodeModelList({ body: { models: [], }, },);
        },).toThrow();
      },
    },),

    it({
      name: 'THROWS on an entry whose id is not a string, so a half-read list '
        + 'cannot quietly under-report what the provider serves',
      fn: async () => {
        expect(function decodeBadEntry() {
          return decodeModelList({ body: { data: [{ id: 7, },], }, },);
        },).toThrow();
      },
    },),
  ],
},);

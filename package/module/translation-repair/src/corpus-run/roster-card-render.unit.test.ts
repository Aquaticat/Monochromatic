/**
 Guards on the roster-card renderer: each provider's listing shape reads
 into the card's field names, a field the listing lacks prints as a
 question, and a listing without the model says so.

 Fixtures are cat-themed invention in the providers' listing shapes; no
 corpus content and no live provider appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  cardFieldsFrom,
  listingRowFor,
  NOT_LISTED,
  readAsk,
  renderProviderCard,
} from '../../dist/final/node/index.mjs';

/**
 A listing body in the `{ data: [...] }` shape, with one OpenRouter-shaped
 row and one Hyper-shaped row.
 */
const LISTING = {
  data: [
    {
      id: 'whiskers/mittens-9',
      context_length: 200_000,
      architecture: {
        input_modalities: [
          'text',
          'image',
        ],
      },
      pricing: {
        prompt: '0.0000003',
        completion: '0.0000012',
      },
      top_provider: { max_completion_tokens: 64_000, },
    },
    {
      id: 'mittens-9',
      context_window: 200_000,
      max_output_tokens: 32_000,
      capabilities: { vision: false, },
    },
    'not a row',
  ],
};

await describe({
  name: 'roster-card-render',
  children: [
    it({
      name: 'FINDS THE ROW BY SERVED ID under `data`, skips non-rows, and answers NOT_LISTED for an unknown id '
        + 'or a body without rows',
      fn: async () => {
        /**
         Row the fixture carries under the OpenRouter spelling.
         */
        const row = listingRowFor({
          body: LISTING,
          servedId: 'whiskers/mittens-9',
        },);
        expect((typeof row) === 'symbol',).toBe(false,);
        expect(listingRowFor({
          body: LISTING,
          servedId: 'tabby-0',
        },),).toBe(NOT_LISTED,);
        expect(listingRowFor({
          body: { data: 'nothing', },
          servedId: 'mittens-9',
        },),).toBe(NOT_LISTED,);
      },
    },),

    it({
      name: 'READS OPENROUTER FIELDS into the card: image input off the architecture, the top endpoint\'s '
        + 'ceiling, and prices scaled from per token to per million',
      fn: async () => {
        /**
         OpenRouter-shaped row.
         */
        const row = listingRowFor({
          body: LISTING,
          servedId: 'whiskers/mittens-9',
        },);
        if ((typeof row) === 'symbol')
          throw new Error('fixture row missing',);
        expect(cardFieldsFrom({
          provider: 'openrouter',
          row,
        },),).toEqual({
          readsImages: true,
          maxOutputLength: 64_000,
          contextLength: 200_000,
          promptPrice: 0.3,
          completionPrice: 1.2,
        },);
      },
    },),

    it({
      name: 'READS SYNTHETIC PRICES WRITTEN WITH A DOLLAR SIGN, as its listing writes them, into dollars per token',
      fn: async () => {
        expect(cardFieldsFrom({
          provider: 'synthetic',
          row: {
            id: 'hf:cat/Mittens-9',
            input_modalities: ['text',],
            context_length: 100_000,
            max_output_length: 8_000,
            pricing: {
              prompt: '$0.000003',
              completion: '$0.000015',
            },
          },
        },),).toEqual({
          readsImages: false,
          maxOutputLength: 8_000,
          contextLength: 100_000,
          promptPrice: 0.000003,
          completionPrice: 0.000015,
        },);
      },
    },),

    it({
      name: 'READS HYPER FIELDS into the card and leaves the prices NOT_LISTED, since Hyper bills in credits '
        + 'the card does not carry',
      fn: async () => {
        /**
         Hyper-shaped row.
         */
        const row = listingRowFor({
          body: LISTING,
          servedId: 'mittens-9',
        },);
        if ((typeof row) === 'symbol')
          throw new Error('fixture row missing',);
        expect(cardFieldsFrom({
          provider: 'hyper',
          row,
        },),).toEqual({
          readsImages: false,
          maxOutputLength: 32_000,
          contextLength: 200_000,
          promptPrice: NOT_LISTED,
          completionPrice: NOT_LISTED,
        },);
      },
    },),

    it({
      name: 'RENDERS the provider side with the listing\'s values and a question for each field it lacks',
      fn: async () => {
        /**
         Rendered OpenRouter side.
         */
        const rendered = renderProviderCard({
          provider: 'openrouter',
          servedId: 'whiskers/mittens-9',
          fields: {
            readsImages: true,
            maxOutputLength: 64_000,
            contextLength: 200_000,
            promptPrice: 0.3,
            completionPrice: NOT_LISTED,
          },
        },);
        expect(rendered,).toContain(`    openrouter: {\n      id: 'whiskers/mittens-9',\n      readsImages: true,\n      maxOutputLength: 64000,`,);
        expect(rendered,).toContain('      promptUsdPerMillion: 0.3,',);
        expect(rendered,).toContain('      completionUsdPerMillion: /* not in the listing:',);
        expect(rendered,).toContain(`      rawCharsPerToken: 'unmeasured',\n    },`,);
        /**
         Rendered Bedrock side, whose listing says nothing a card needs.
         */
        const bedrock = renderProviderCard({
          provider: 'bedrock',
          servedId: 'cat.mittens-9',
          fields: {
            readsImages: NOT_LISTED,
            maxOutputLength: NOT_LISTED,
            contextLength: NOT_LISTED,
            promptPrice: NOT_LISTED,
            completionPrice: NOT_LISTED,
          },
        },);
        expect(bedrock,).toContain('      readsImages: /* not in the listing: send it a picture and measure */,',);
        expect(bedrock,).toContain(`      route: /* 'openai-v1' | 'v1', measured */,`,);
      },
    },),

    it({
      name: 'READS THE ASK off the command line and refuses a missing id or a provider that is not one of the four',
      fn: async () => {
        expect(readAsk({
          argv: [
            'hyper',
            'mittens-9',
          ],
        },),).toEqual({
          provider: 'hyper',
          servedId: 'mittens-9',
        },);
        expect(function noId(): void {
          readAsk({ argv: ['hyper',], },);
        },).toThrow('usage: roster-card',);
        expect(function notAProvider(): void {
          readAsk({
            argv: [
              'catnip',
              'mittens-9',
            ],
          },);
        },).toThrow('usage: roster-card',);
      },
    },),
  ],
},);

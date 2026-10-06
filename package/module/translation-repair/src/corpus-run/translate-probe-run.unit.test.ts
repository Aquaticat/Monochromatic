/**
 Tests for the translate probe's run: which section it demonstrates on, what
 it prints for each slice it asks about, how it reports a slice that failed
 and what it refuses, over a throwaway corpus and a scripted roster.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  probeTranslate,
  type RosterModelId,
  StatedRefusalError,
  type SyntheticClient,
} from '../../dist/final/node/index.mjs';
import { capturingLoggerPair, } from '../capturing-logger.test-fixture.ts';
import {
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
} from '../roster-seats.test-fixture.ts';
import { divertingConsoleLog, } from './console-log-capture.test-fixture.ts';
import {
  makeProbeCorpus,
  refusalOf,
} from './probes-b-built-command.test-fixture.ts';

/**
 Translators asked: two seats.
 */
const ROSTER: readonly RosterModelId[] = [
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
];

/**
 Deadline handed to every exchange.
 */
const TIMEOUT_MS = 60_000;

/**
 What the translators were scripted to say, by model id; a model absent from
 the script stays silent.
 */
type Script = Readonly<Record<string, string>>;

/**
 Client answering each translator from a script.

 @param script - rendered English each model returns

 @returns Client honoring that script, which never reaches a network

 @example
 ```ts
 const client = scriptedClient({ script: { 'hf:cat/Cat-A': 'The cat naps.', }, },);
 ```
 */
function scriptedClient({ script, }: { readonly script: Script; },): SyntheticClient {
  return {
    chatText: function noText(): never {
      throw new Error('chatText unused by the translate probe',);
    },
    quotas: function noQuotas(): never {
      throw new Error('quotas unused by the translate probe',);
    },
    chatJson: function answer<ValueT,>(request: ChatJsonRequest<ValueT>,): Promise<ChatJsonOutcome<ValueT>> {
      /**
       Rendering this model was scripted to give.
       */
      const scripted = script[request.modelId];
      if (scripted === undefined)
        return Promise.resolve({
          kind: 'schema-mismatch',
          rawText: '',
          detail: 'scripted silence',
        },);

      /**
       Wire value carrying it.
       */
      const value: unknown = { translation: scripted, };
      if (!request.validate(value,))
        return Promise.reject(new Error('scripted reply failed the wire guard',),);
      return Promise.resolve({
        kind: 'ok',
        value,
        rawText: JSON.stringify(value,),
      },);
    },
  };
}

/**
 What the probe printed and how many clients it built.
 */
type Probed = {
  /**
   Clients built, one for each slice asked about.
   */
  readonly built: number;

  /**
   Lines printed.
   */
  readonly lines: readonly string[];

  /**
   Whether the probe was refused, and with what, empty when it ran.
   */
  readonly refusal: string;
};

/**
 Runs the probe over the given pages of the entry it is fixed on.

 @param files - corpus files by path

 @param newClient - what building the client for one slice does

 @param roster - translators asked

 @param sinon - the case's own sandbox

 @returns Clients built, lines printed and the refusal if any

 @example
 ```ts
 const probed = await probeOver({ files, newClient, sinon, },);
 ```
 */
async function probeOver(
  {
    files,
    newClient,
    roster,
    sinon,
  }: {
    readonly files: Readonly<Record<string, string>>;
    readonly newClient: () => SyntheticClient;
    readonly roster: readonly RosterModelId[];
    readonly sinon: Parameters<typeof divertingConsoleLog>[0]['sinon'];
  },
): Promise<Probed> {
  await using corpus = await makeProbeCorpus({ files, },);
  using printed = divertingConsoleLog({ sinon, },);
  const { logger, } = capturingLoggerPair();

  /**
   Clients built, one entry each.
   */
  const built: SyntheticClient[] = [];

  /**
   Builds the client for one slice and counts it.

   @returns The client the case scripted

   @example
   ```ts
   const client = counting();
   ```
   */
  function counting(): SyntheticClient {
    /**
     Client the case scripted for this slice.
     */
    const client = newClient();
    built.push(client,);
    return client;
  }

  /**
   Runs the probe, as the case under test asks.
   */
  async function walk(): Promise<void> {
    await probeTranslate({
      entryId: 'Mittens',
      pin: corpus.pin,
      newClient: counting,
      editorModelIds: roster,
      perCallTimeoutMs: TIMEOUT_MS,
      log: logger,
    },);
  }

  /**
   What the probe refused with, empty when it ran.
   */
  const refusal = await refusalOf({ run: walk, },);
  return {
    built: built.length,
    lines: printed.lines,
    refusal,
  };
}

/**
 Original whose headings carry romanised names, the shape the aligner can
 prove a missing section in.
 */
const ANCHORED_SOURCE = `开场白：猫猫登场。

## 其一：Mittens

猫猫喜欢晒太阳，尾巴一摇一摇。

## 其二：Boots

猫猫每天下午都在窗台上打盹，直到太阳落下。

## 其三：Paws

猫猫和邻居家的黑猫是好朋友，它们常常一起追蝴蝶。
`;

/**
 Translation of that original missing its middle section.
 */
const ANCHORED_TARGET = `Prologue: the cat arrives.

## Mittens

The cat loves sunbathing, tail swishing.

## Paws

The cat and the black cat next door are friends.
`;

/**
 Original of the fixture entry: a heading and two blocks.
 */
const SOURCE_PAGE = '# 猫\n\n猫睡觉。\n\n猫吃鱼。\n';

/**
 Translation of the fixture original, lacking a block.
 */
const TARGET_PAGE = '# Cat\n\nThe cat naps.\n';

await describe({
  name: probeTranslate.name,
  children: [
    it({
      name: 'PRINTS the section, the slice and what each heard voice rendered, with the finding for the seat that stayed silent',
      fn: async (ctx) => {
        const probed = await probeOver({
          files: {
            'people/Mittens/page.md': SOURCE_PAGE,
            'people/Mittens/page.en.md': TARGET_PAGE,
          },
          newClient: function oneVoice(): SyntheticClient {
            return scriptedClient({ script: { [SEAT_SYNTHETIC_VISION_NO_OPENROUTER]: 'The cat naps and eats fish.', }, },);
          },
          roster: ROSTER,
          sinon: ctx.sinon,
        },);

        expect(probed,).toEqual({
          built: 1,
          lines: [
            'TRANSLATE Mittens: source 3 blocks / 15 chars, target 2 blocks / 20 chars, coverage 0.667',
            'TRANSLATE section subdivides into 1 slice; probing the first 1',
            '\n--- slice: 15 source chars, 20 target chars ---',
            'SOURCE: # 猫\n\n猫睡觉。\n\n猫吃鱼。',
            'HEARD 1/2',
            `  ${SEAT_SYNTHETIC_VISION_NO_OPENROUTER}: The cat naps and eats fish.`,
            `  finding: stage-voice-lost (translate-probe ${SEAT_SYNTHETIC_VISION_WITHHELD})`,
            '  finding: stage-roster-incomplete (translate-probe 1/2)',
          ],
          refusal: '',
        },);
      },
    },),
    it({
      name: 'PROBES only the first three slices of a section that cuts into more, building a client for each and printing every voice heard',
      fn: async (ctx) => {
        /**
         Paragraphs each long enough to be a slice of their own.
         */
        const paragraphs = ['猫', '鱼', '窗', '碗',].map(function paragraphOf(character,): string {
          return character.repeat(450,);
        },);
        const probed = await probeOver({
          files: {
            'people/Mittens/page.md': `# 猫\n\n${paragraphs.join('\n\n',)}\n`,
            'people/Mittens/page.en.md': `# Cat\n\n${['a', 'b', 'c', 'd',].map(function englishOf(letter,): string {
              return letter.repeat(450,);
            },).join('\n\n',)}\n`,
          },
          newClient: function twoVoices(): SyntheticClient {
            return scriptedClient({ script: {
              [SEAT_SYNTHETIC_VISION_NO_OPENROUTER]: 'The cat naps.',
              [SEAT_SYNTHETIC_VISION_WITHHELD]: 'The cat sleeps.',
            }, },);
          },
          roster: ROSTER,
          sinon: ctx.sinon,
        },);

        expect(probed.built,).toBe(3,);
        expect(probed.refusal,).toBe('',);
        expect(probed.lines.filter(function isHeading(line,): boolean {
          return line.startsWith('\n--- slice: ',);
        },),).toEqual([
          '\n--- slice: 3 source chars, 5 target chars ---',
          '\n--- slice: 450 source chars, 450 target chars ---',
          '\n--- slice: 450 source chars, 450 target chars ---',
        ],);
        expect(probed.lines.filter(function isCount(line,): boolean {
          return line.startsWith('TRANSLATE section',) || line.startsWith('HEARD',);
        },),).toEqual([
          'TRANSLATE section subdivides into 5 slices; probing the first 3',
          'HEARD 2/2',
          'HEARD 2/2',
          'HEARD 2/2',
        ],);
      },
    },),
    it({
      name: 'REPORTS a slice whose round threw as failed, in the error\'s own text, and goes on to the next',
      fn: async (ctx) => {
        const probed = await probeOver({
          files: {
            'people/Mittens/page.md': SOURCE_PAGE,
            'people/Mittens/page.en.md': TARGET_PAGE,
          },
          newClient: function silent(): SyntheticClient {
            return scriptedClient({ script: {}, },);
          },
          roster: [SEAT_SYNTHETIC_VISION_NO_OPENROUTER, SEAT_SYNTHETIC_VISION_NO_OPENROUTER,],
          sinon: ctx.sinon,
        },);

        expect(probed.refusal,).toBe('',);
        expect(probed.lines.slice(4,),).toEqual([
          `  SLICE FAILED: StageRosterRepeatError: the translate-probe roster seats these models more than once: [${SEAT_SYNTHETIC_VISION_NO_OPENROUTER}]; `
          + 'a repeated id is one model counted as several voices, which meets quorum on fewer independent voices than '
          + 'the roster size promises, and the ballots keyed by model id would keep only one of its replies',
        ],);
      },
    },),
    it({
      name: 'REFUSES as stated when the client cannot be built, after printing the section and the slice\'s source and before any call, '
        + 'where it once reported the slice as failed and ran on',
      fn: async (ctx) => {
        const probed = await probeOver({
          files: {
            'people/Mittens/page.md': SOURCE_PAGE,
            'people/Mittens/page.en.md': TARGET_PAGE,
          },
          newClient: function noKey(): SyntheticClient {
            throw new StatedRefusalError({ says: 'the cat has no key', },);
          },
          roster: ROSTER,
          sinon: ctx.sinon,
        },);

        expect(probed,).toEqual({
          built: 0,
          lines: [
            'TRANSLATE Mittens: source 3 blocks / 15 chars, target 2 blocks / 20 chars, coverage 0.667',
            'TRANSLATE section subdivides into 1 slice; probing the first 1',
            '\n--- slice: 15 source chars, 20 target chars ---',
            'SOURCE: # 猫\n\n猫睡觉。\n\n猫吃鱼。',
          ],
          refusal: 'StatedRefusalError: the cat has no key',
        },);
      },
    },),
    it({
      name: 'PROBES a section the translation lacks altogether as one the translators write from nothing, showing it at coverage zero',
      fn: async (ctx) => {
        const probed = await probeOver({
          files: {
            'people/Mittens/page.md': ANCHORED_SOURCE,
            'people/Mittens/page.en.md': ANCHORED_TARGET,
          },
          newClient: function oneVoice(): SyntheticClient {
            return scriptedClient({ script: {
              [SEAT_SYNTHETIC_VISION_NO_OPENROUTER]: 'The cat naps on the sill.',
              [SEAT_SYNTHETIC_VISION_WITHHELD]: 'The cat dozes on the sill.',
            }, },);
          },
          roster: ROSTER,
          sinon: ctx.sinon,
        },);

        expect(probed.refusal,).toBe('',);
        expect(probed.lines,).toEqual([
          'TRANSLATE Mittens: source 2 blocks / 34 chars, target 0 blocks / 0 chars, coverage 0.000 (barely translated)',
          'TRANSLATE section subdivides into 1 slice; probing the first 1',
          '\n--- slice: 34 source chars, 0 target chars ---',
          'SOURCE: ## 其二：Boots\n\n猫猫每天下午都在窗台上打盹，直到太阳落下。',
          'HEARD 2/2',
          `  ${SEAT_SYNTHETIC_VISION_NO_OPENROUTER}: The cat naps on the sill.`,
          `  ${SEAT_SYNTHETIC_VISION_WITHHELD}: The cat dozes on the sill.`,
        ],);
      },
    },),
    it({
      name: 'SAYS no section carries source blocks for entries with nothing to carve, building no client',
      fn: async (ctx) => {
        expect(await probeOver({
          files: {
            'people/Mittens/page.md': '',
            'people/Mittens/page.en.md': TARGET_PAGE,
          },
          newClient: function unused(): SyntheticClient {
            return scriptedClient({ script: {}, },);
          },
          roster: ROSTER,
          sinon: ctx.sinon,
        },),).toEqual({
          built: 0,
          lines: ['TRANSLATE no aligned section carries source blocks',],
          refusal: '',
        },);
      },
    },),
    it({
      name: 'REFUSES an entry whose translation is absent, naming the page, before printing anything',
      fn: async (ctx) => {
        const probed = await probeOver({
          files: { 'people/Mittens/page.md': SOURCE_PAGE, },
          newClient: function unused(): SyntheticClient {
            return scriptedClient({ script: {}, },);
          },
          roster: ROSTER,
          sinon: ctx.sinon,
        },);

        expect(probed.built,).toBe(0,);
        expect(probed.lines,).toEqual([],);
        expect(probed.refusal.startsWith('CorpusReadError: corpus read failed for ',),).toBe(true,);
        expect(probed.refusal.endsWith(':people/Mittens/page.en.md (missing-object); check that the clone exists and the pinned commit is present.',),).toBe(true,);
      },
    },),
  ],
},);

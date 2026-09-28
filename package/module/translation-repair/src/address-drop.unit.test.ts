/**
 Guards class ninety-seven (2026-09-23): a candidate that renders
 a passage the original addresses in the second person (你, 您) with no
 second-person pronoun and a third-person one instead is refused before any
 judge reads it, since a pronoun the original writes is rendered as written
 where it stands (class eighty-one). A greeting (你好) is no address, and a
 rendering carrying no pronoun at all is left to the judges. Cat-themed
 invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { validateTranslatedSlice, } from '../dist/final/node/index.mjs';

/**
 Original wish addressing the cat directly.
 */
const ADDRESSED = '明天早上，你还要陪我去院子里追那只黄蝴蝶哦！';

/**
 Rendering that keeps the address.
 */
const KEPT = 'Tomorrow morning, you still have to come chase that yellow butterfly in the yard with me!';

/**
 Rendering that turned the address into narration.
 */
const NARRATED = 'Tomorrow morning, she still has to come chase that yellow butterfly in the yard with me!';

await describe({
  name: 'a second-person address the original passage carries (class ninety-seven)',
  children: [
    it({
      name: 'REFUSES a candidate that renders 你 with no second-person pronoun and a third-person one instead',
      fn: async () => {
        /**
         Verdict on the narrated rendering.
         */
        const verdict = validateTranslatedSlice({
          sourceText: ADDRESSED,
          candidateText: NARRATED,
        },);
        expect(verdict.kind,).toBe('invalid',);
        if (verdict.kind !== 'invalid')
          throw new Error('unreachable',);
        expect(verdict.findings.join('\n',),).toContain('second person',);
      },
    },),
    it({
      name: 'ACCEPTS the address kept, a greeting rendered as a greeting, and a rendering carrying no pronoun at all',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: ADDRESSED,
          candidateText: KEPT,
        },).kind,).toBe('valid',);
        expect(validateTranslatedSlice({
          sourceText: '她说「你好。再见。」',
          candidateText: 'She said “Hello. Goodbye.”',
        },).kind,).toBe('valid',);
        expect(validateTranslatedSlice({
          sourceText: '啊，干干你的',
          candidateText: 'Ah, wanna play?',
        },).kind,).toBe('valid',);
        expect(validateTranslatedSlice({
          sourceText: '<!-- 你 --> 猫猫睡了。',
          candidateText: 'The cat slept, and she dreamed.',
        },).kind,).toBe('valid',);
      },
    },),
    it({
      name: 'ACCEPTS 你看 and 你瞧 opening a clause as the imperative "look", which English writes without "you" '
        + '(class one hundred eighty-five: the rendering\'s "she" rendered the original\'s own 她)',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: '所以她是只温柔的猫吧。你看窗台上，她在最小的角落里睡出了最甜的梦。',
          candidateText: 'So she was a gentle cat. Look at the windowsill: in the smallest corner she dreamed '
            + 'the sweetest dream.',
        },).kind,).toBe('valid',);
        expect(validateTranslatedSlice({
          sourceText: '「你瞧你瞧，她又醒了！」',
          candidateText: '“Look, look, she’s awake again!”',
        },).kind,).toBe('valid',);
      },
    },),
    it({
      name: 'STILL REFUSES 你看 as a verb with its object or complement (被你看到, 你看到了) where the address drops',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: '那只猫偷吃鱼干的样子，全被你看到了。',
          candidateText: 'Even the cat sneaking dried fish was seen by her.',
        },).kind,).toBe('invalid',);
        expect(validateTranslatedSlice({
          sourceText: '你看到她睡着了吗？',
          candidateText: 'Did she see her fall asleep?',
        },).kind,).toBe('invalid',);
      },
    },),
    it({
      name: 'ACCEPTS third-person pronouns that render the original\'s own, block by block, and 你 that addresses '
        + 'nobody (ledger F-1: the archive-against-itself replay refused correct English in seven slices)',
      fn: async () => {
        // SHAPES, each invented: a closing wish rendered as an imperative beside
        // pronouns for the original's own 他; the address in one block and a
        // pronoun the English adds in another; 其 rendered "she"; a cry whose
        // "you" English drops beside pronouns for the original's own 她; 迷你
        // (mini); 你们好 (hello, everyone); an idiom (你追我赶).
        /**
         Pairs a correct rendering answers.
         */
        const accepted: readonly (readonly [string, string,])[] = [
          [
            '他说，「猫咪早已走远。」我们不会忘记他，感谢他留下的爪印。咪咪，愿你安睡。',
            'He said, “The cat has long gone.” We will not forget him, and we are grateful for the pawprints '
              + 'he left.\nSleep well, Mimi.',
          ],
          [
            '> 啊，玩你的毛线球\n\n确是一只小猫呢',
            '> Ah, go play with the yarn.\n\nA little cat she is~',
          ],
          [
            '> 当你看到此消息。\n>\n> 「纪念其在猫窝留下的足迹。」',
            '> When this message appeared:\n>\n> “In memory of the pawprints she left in the cat bed.”',
          ],
          [
            '「喵！你怎么了！」我不断地呼喊着她。',
            '“Meow! What’s wrong!” I kept calling out to her.',
          ],
          [
            '她买了一个迷你猫窝。',
            'She bought a mini cat bed.',
          ],
          [
            '你们好，她是小橘。',
            'Hello, everyone: she is Little Orange.',
          ],
          [
            '她和小黑在院子里你追我赶。',
            'She and Little Black chased each other around the yard.',
          ],
        ];
        expect(accepted.filter(function refusedWrongly([sourceText, candidateText,],): boolean {
          return validateTranslatedSlice({
            sourceText,
            candidateText,
          },).kind !== 'valid';
        },),).toEqual([],);
      },
    },),
    it({
      name: 'STILL REFUSES a person switch: a pronoun more than the original writes where its address stood',
      fn: async () => {
        /**
         Pairs that turn the address into narration.
         */
        const refused: readonly (readonly [string, string,])[] = [
          [
            '可惜这一切戛然而止，她睡着了。\n\n愿在你的下一个世界，你还有同样的好奇心。',
            'It is a pity all this stopped when she fell asleep.\n\nMay she still have the same curiosity in '
              + 'her next world.',
          ],
          [
            '橘子，那天晚上你请我吃的鱼干真好吃。',
            'The dried fish she treated me to that night was delicious, Orange.',
          ],
          [
            '我很遗憾没有多为 ta 拍照。\n\n希望你去往没有雷雨的世界。',
            'I regret not taking more photos of them.\n\nI hope they have found a world without thunderstorms.',
          ],
          [
            '她说她很累。你要好好的。',
            'She said she was tired. May she be well.',
          ],
        ];
        expect(refused.filter(function acceptedWrongly([sourceText, candidateText,],): boolean {
          return validateTranslatedSlice({
            sourceText,
            candidateText,
          },).kind !== 'invalid';
        },),).toEqual([],);
      },
    },),
    it({
      name: 'READS an accented name as one word, so Heřmánek and Åhe hold no "he", while a real "she" beside one is '
        + 'still refused (ledger B18)',
      fn: async () => {
        // With ASCII letters only, `Heřmánek` read as `he`, `m` and `nek`, and
        // `Åhe` as `he` past its first letter, and the floor refused a
        // rendering that addressed the cat by name.
        expect(validateTranslatedSlice({
          sourceText: ADDRESSED,
          candidateText: 'Tomorrow morning, Heřmánek still has to come chase that yellow butterfly in the yard with me!',
        },).kind,).toBe('valid',);
        expect(validateTranslatedSlice({
          sourceText: ADDRESSED,
          candidateText: 'Tomorrow morning, Åhe still has to come chase that yellow butterfly in the yard with me!',
        },).kind,).toBe('valid',);
        expect(validateTranslatedSlice({
          sourceText: ADDRESSED,
          candidateText: 'Tomorrow morning, she and Heřmánek still have to come chase that yellow butterfly in the yard '
            + 'with me!',
        },).kind,).toBe('invalid',);
      },
    },),
  ],
},);

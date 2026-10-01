/**
 Tests fidelity-first naturalness gate policy and settlement.
 
 Cat-themed invention throughout; no corpus content appears here.
 
 @module
 */

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  buildConsolidationPolishGateMessages,
  type ConsolidationPolishBallot,
  isConsolidationPolishGateWire,
  messageText,
  readConsolidationPolishBallot,
  settleConsolidationPolishBallots,
} from '../dist/final/node/index.mjs';

/**
 Ballot choosing requested candidate.
 
 @param choice - candidate selected
 
 @returns Usable polish ballot
 
 @example
 ```ts
 const value = ballot({ choice: 'polished', });
 ```
 */
function ballot(
  { choice, }: { readonly choice: ConsolidationPolishBallot['choice']; },
): ConsolidationPolishBallot {
  return {
    choice,
    unsupported: [],
    unsupportedRaw: [],
    dropped: [],
    droppedRaw: [],
    reason: 'scripted',
  };
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: settleConsolidationPolishBallots.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'ACCEPTS CLEAR POLISH WIN and keeps base on ties or thin support',
          fn: async () => {
            expect(settleConsolidationPolishBallots({
              ballots: [
                ballot({ choice: 'polished', },),
                ballot({ choice: 'polished', },),
                ballot({ choice: 'base', },),
              ],
            },),).toBe('polished',);
            expect(settleConsolidationPolishBallots({
              ballots: [
                ballot({ choice: 'polished', },),
                ballot({ choice: 'base', },),
              ],
            },),).toBe('neither',);
            expect(settleConsolidationPolishBallots({
              ballots: [ballot({ choice: 'polished', },),],
            },),).toBe('neither',);
            expect(settleConsolidationPolishBallots({
              ballots: [
                ballot({ choice: 'polished', },),
                ballot({ choice: 'polished', },),
                ballot({ choice: 'neither', },),
                ballot({ choice: 'neither', },),
                ballot({ choice: 'neither', },),
                ballot({ choice: 'neither', },),
                ballot({ choice: 'neither', },),
                ballot({ choice: 'neither', },),
                ballot({ choice: 'neither', },),
              ],
            },),).toBe('polished',);
          },
        },),
      ],
    },),

    describe({
      name: isConsolidationPolishGateWire.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'REFUSES a reply it cannot read as a ballot (not an object, null, or with the choice or the reason '
            + 'missing, or a reason that is not text), and ACCEPTS the same reply whole or with a findings key missing '
            + '(ledger B46)',
          fn: async () => {
            /** The whole reply first, then that reply with one part taken away or broken. */
            const replies: readonly unknown[] = [
              { choice: 'base', unsupported: [], dropped: [], reason: 'the polish drops the second cat', },
              'base',
              null,
              { unsupported: [], dropped: [], reason: 'the polish drops the second cat', },
              { choice: 'base', dropped: [], reason: 'the polish drops the second cat', },
              { choice: 'base', unsupported: [], reason: 'the polish drops the second cat', },
              { choice: 'base', unsupported: [], dropped: [], },
              { choice: 'base', unsupported: [], dropped: [], reason: 7, },
            ];
            expect(replies.map(function usable(reply,): boolean {
              return isConsolidationPolishGateWire(reply,);
            },),).toEqual([ true, false, false, false, true, true, false, false, ],);
          },
        },),
      ],
    },),

    describe({
      name: readConsolidationPolishBallot.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'KEEPS the choice of a ballot whose findings are not lists of strings, and reads them as none',
          fn: async () => {
            /** A reply whose findings are a stray null and a bare phrase. */
            const reply: unknown = {
              choice: 'base',
              unsupported: null,
              dropped: 'the second cat',
              reason: 'the polish drops the second cat',
            };
            if (!isConsolidationPolishGateWire(reply,))
              throw new Error('the guard refused a reply whose choice and reason it can read',);
            /** The ballot read off it. */
            const read = readConsolidationPolishBallot({ wire: reply, },);
            expect([
              read.choice,
              read.unsupported,
              read.unsupportedRaw,
              read.dropped,
              read.droppedRaw,
            ],).toEqual([ 'base', [], [], [], [], ],);
          },
        },),
      ],
    },),

    describe({
      name: buildConsolidationPolishGateMessages.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'MAKES FIDELITY A FLOOR before judging literal collocations and calques',
          fn: async () => {
            const system = buildConsolidationPolishGateMessages({
              subject: {
                sourceText: '猫猫乐观地看待每一场雨。',
                archiveText: 'The cat viewed each rainstorm optimistically.',
                baseText: 'The cat faced each rainstorm proactively.',
                polishedText: 'The cat kept a cheerful outlook through every rainstorm.',
                lineStructured: false,
                mode: { kind: 'comparative', },
              },
            },).at(0,)?.content ?? '';
            expect(system,).toContain('Naturalness can never compensate',);
            expect(system,).toContain('calqued verb-object combinations',);
            expect(system,).toContain('Prefer polished only when it is clearly more idiomatic',);
          },
        },),

        it({
          name: 'TELLS THE GATE THE HOUSE RULES in both modes, so a polish moving the life of a person who has '
            + 'died into the past tense is the rule applied and not an unsupported change (class one hundred '
            + 'four, one entry, 2026-09-23: the gate refused the past-tense polish 4 of 4 as "an unsupported '
            + 'change" about "a living person")',
          fn: async () => {
            /**
             Subject shared by both modes.
             */
            const subject = {
              sourceText: '猫猫喜欢向日葵。',
              archiveText: 'The cat loves sunflowers.',
              baseText: 'The cat loves sunflowers.',
              polishedText: 'The cat loved sunflowers.',
              lineStructured: false,
            };
            /**
             System half of the comparative sheet.
             */
            const comparative = buildConsolidationPolishGateMessages({
              subject: {
                ...subject,
                mode: { kind: 'comparative', },
              },
            },).at(0,)?.content ?? '';
            /**
             System half of the objection-correction sheet (ledger B47: this case
             read the removed required-correction sheet).
             */
            const correction = buildConsolidationPolishGateMessages({
              subject: {
                ...subject,
                mode: {
                  kind: 'objection-correction',
                  groups: [{
                    origin: 'consolidation gate',
                    objections: ['The present tense reads as stiff.',],
                  },],
                },
              },
            },).at(0,)?.content ?? '';
            for (const system of [comparative, correction,]) {
              expect(system,).toContain('Tense is chosen once and held',);
              expect(system,).toContain('WHERE THE FORCED CHOICE IS TENSE',);
              expect(system,).toContain('Reader protection outranks completeness',);
            }
          },
        },),

        it({
          name: 'NEVER CALLS the base\'s present tense its choice, and PREFERS a polish whose change is a house '
            + 'correction in the comparative and objection modes (ledger S11: a TianqiChen66616 ballot quoted "a '
            + 'present-tense line about their life is the base\'s choice", and neither policy preferred a polish '
            + 'that only applied a house rule)',
          fn: async () => {
            /**
             Subject whose polish only moves a life into the past tense.
             */
            const subject = {
              sourceText: '猫猫喜欢向日葵。',
              archiveText: 'The cat loves sunflowers.',
              baseText: 'The cat loves sunflowers.',
              polishedText: 'The cat loved sunflowers.',
              lineStructured: false,
            };
            /**
             System half of the comparative sheet.
             */
            const comparative = buildConsolidationPolishGateMessages({
              subject: {
                ...subject,
                mode: { kind: 'comparative', },
              },
            },).at(0,)?.content ?? '';
            /**
             System half of the objection sheet.
             */
            const objection = buildConsolidationPolishGateMessages({
              subject: {
                ...subject,
                mode: {
                  kind: 'objection-correction',
                  groups: [{
                    origin: 'consolidation gate',
                    objections: ['The base drops the tabby\'s name.',],
                  },],
                },
              },
            },).at(0,)?.content ?? '';
            for (const system of [comparative, objection,]) {
              expect(system.includes('is the base\'s choice',),).toBe(false,);
              expect(system,).toContain('A HOUSE CORRECTION IS AN IMPROVEMENT',);
            }
          },
        },),

        it({
          name: 'TELLS THE GATE A PROSE SLICE\'S LINE BREAKS ARE THE PAGE\'S WRAP, and keeps line structure only '
            + 'where the line rule governs (class one hundred fifty-two, one entry, 2026-09-26: the polish '
            + 'replacing a calque tied 2 to 2, both base ballots '
            + 'citing its "line structure" on a slice both candidates were wrapped by the same rule)',
          fn: async () => {
            /**
             Subject shared by both line policies.
             */
            const subject = {
              sourceText: '可惜那场捉迷藏戛然而止，猫猫躲进了衣柜。',
              archiveText: 'What a shame that the hide-and-seek game stopped abruptly; the cat hid in the wardrobe.',
              baseText: 'What a shame that the hide-and-seek game stopped abruptly;\nthe cat hid in the wardrobe.',
              polishedText: 'Sadly, the game ended there:\nthe cat hid in the wardrobe.',
              mode: { kind: 'comparative', } as const,
            };
            /**
             System half for a prose slice.
             */
            const prose = buildConsolidationPolishGateMessages({
              subject: {
                ...subject,
                lineStructured: false,
              },
            },).at(0,)?.content ?? '';
            /**
             System half for a line-structured slice.
             */
            const lined = buildConsolidationPolishGateMessages({
              subject: {
                ...subject,
                lineStructured: true,
              },
            },).at(0,)?.content ?? '';
            expect(prose,).toContain('LINE BREAKS INSIDE A PARAGRAPH ARE THE PAGE\'S OWN WRAP',);
            expect(prose.includes('line structure',),).toBe(false,);
            expect(lined,).toContain('Markdown structure, or line structure',);
            expect(lined.includes('LINE BREAKS INSIDE A PARAGRAPH ARE THE PAGE\'S OWN WRAP',),).toBe(false,);
          },
        },),

        it({
          name: 'SHOWS A PROSE SLICE\'S PARAGRAPHS ON ONE LINE EACH, as they render, keeping hard breaks, blockquotes '
            + 'and a line-structured slice as written (class one hundred fifty-three, one entry, 2026-09-26: the '
            + 'base stood as the archive\'s one-line paragraph beside a wrapped polish on slices 36, 61 and 64, and '
            + 'three ballots weighed the polish\'s "added line breaks")',
          fn: async () => {
            /**
             Subject whose base is one line and whose polish is wrapped.
             */
            const subject = {
              sourceText: '猫猫整天在阳光下打盹，再也没有回家。\n\n猫猫说：\n\n> 晚安。',
              archiveText: 'The cat napped in the sun all day and never came home.',
              baseText: 'The cat napped in the sun all day and never came home.\n\nThe cat said:  \nfarewell.\n\n'
                + '> Good night,\n> friend.',
              polishedText: 'The cat dozed in the sun all day,\n  and never came home.\n\nThe cat said:\\\nfarewell.\n\n'
                + '> Good night,\n> friend.',
              mode: { kind: 'comparative', } as const,
            };
            /**
             Candidates as a prose slice's gate reads them.
             */
            const prose = messageText({
              message: nonNullishOrThrow(buildConsolidationPolishGateMessages({
                subject: {
                  ...subject,
                  lineStructured: false,
                },
              },).at(1,),),
            },);
            /**
             Candidates as a line-structured slice's gate reads them.
             */
            const lined = messageText({
              message: nonNullishOrThrow(buildConsolidationPolishGateMessages({
                subject: {
                  ...subject,
                  lineStructured: true,
                },
              },).at(1,),),
            },);
            expect(prose,).toContain('The cat dozed in the sun all day, and never came home.',);
            expect(prose.includes('all day,\n',),).toBe(false,);
            expect(prose,).toContain('The cat said:  \nfarewell.',);
            expect(prose,).toContain('The cat said:\\\nfarewell.',);
            expect(prose,).toContain('> Good night,\n> friend.',);
            expect(lined,).toContain('The cat dozed in the sun all day,\n  and never came home.',);
          },
        },),

        it({
          name: 'LABELS THE BASE AS THE FALLBACK in an objection correction and quotes each objection under its '
            + 'judges (ledger B47: this case read the removed required correction, whose base was no fallback)',
          fn: async () => {
            const messages = buildConsolidationPolishGateMessages({
              subject: {
                sourceText: '猫猫需要关爱。',
                archiveText: 'The cat needed care.',
                baseText: 'The cat was short on caring.',
                polishedText: 'The cat needed affection.',
                lineStructured: false,
                mode: {
                  kind: 'objection-correction',
                  groups: [{
                    origin: 'consolidation slate',
                    objections: ['The base softens how much the cat needed.',],
                  },],
                },
              },
            },);
            /**
             Complete correction gate sheet across system and user messages.
             */
            const sheet = messages.map(function text(message,): string {
              return messageText({ message, },);
            },)
              .join('\n',);
            expect(sheet,).toContain('The base ships if you refuse the correction, with the objections recorded.',);
            expect(sheet,).toContain('CANDIDATE "base" (ships if the correction is refused):',);
            expect(sheet,).toContain(
              'OBJECTIONS FROM THE CONSOLIDATION SLATE, claims to check against the ORIGINAL:',
            );
            expect(sheet,).toContain('- The base softens how much the cat needed.',);
            expect(sheet,).not.toContain('(already approved)',);
          },
        },),

        it({
          name: 'FENCES THE DECLARED NAMES like every other enclosed text, with the fence the ORIGINAL takes (ledger S20)',
          fn: async () => {
            /**
             Declared identity the gate is shown.
             */
            const identityContext = '- name: ORIGINAL declares "咪咪", TRANSLATION declares "Mittens"';

            /**
             Lines of the gate's user sheet.
             */
            const lines = messageText({
              message: nonNullishOrThrow(buildConsolidationPolishGateMessages({
                subject: {
                  sourceText: '咪咪需要关爱。',
                  archiveText: 'Mittens needed care.',
                  baseText: 'Mittens needed care.',
                  polishedText: 'Mittens needed affection.',
                  lineStructured: false,
                  identityContext,
                  mode: { kind: 'comparative', },
                },
              },)[1],),
            },)
              .split('\n',);

            /**
             Where the declared names open, and where the original does.
             */
            const at = lines.indexOf('DECLARED NAMES:',);
            const original = lines.indexOf('ORIGINAL (Chinese):',);
            expect(at,).toBeGreaterThan(-1,);
            expect(lines[at + 2],).toBe(identityContext,);
            expect(lines[at + 1],).toBe(lines[original + 1],);
            expect(lines[at + 3],).toBe(lines[original + 1],);
          },
        },),
      ],
    },),
  ],
},);

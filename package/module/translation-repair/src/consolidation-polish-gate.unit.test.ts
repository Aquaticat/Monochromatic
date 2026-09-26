/**
 Tests fidelity-first naturalness gate policy and settlement.
 
 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  buildConsolidationPolishGateMessages,
  type ConsolidationPolishBallot,
  messageText,
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
  name: settleConsolidationPolishBallots.name,
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
},);

await describe({
  name: buildConsolidationPolishGateMessages.name,
  children: [
    it({
      name: 'MAKES FIDELITY A FLOOR before judging literal collocations and calques',
      fn: async () => {
        const system = buildConsolidationPolishGateMessages({
          subject: {
            sourceText: '猫猫积极地面对生活。',
            archiveText: 'The cat approached life positively.',
            baseText: 'The cat faced life proactively.',
            polishedText: 'The cat maintained a positive outlook on life.',
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
        + 'four, CuspariaKLSY9, 2026-09-23: the gate refused the past-tense polish 4 of 4 as "an unsupported '
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
         System half of the required-correction sheet.
         */
        const correction = buildConsolidationPolishGateMessages({
          subject: {
            ...subject,
            mode: {
              kind: 'required-naturalness-correction',
              findings: [{
                paragraph: 1,
                problem: 'stiff',
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
      name: 'TELLS THE GATE A PROSE SLICE\'S LINE BREAKS ARE THE PAGE\'S WRAP, and keeps line structure only '
        + 'where the line rule governs (class one hundred fifty-two, yingying12, 2026-09-26: the polish '
        + 'replacing the calque "It is a pity that all this stopped abruptly" tied 2 to 2, both base ballots '
        + 'citing its "line structure" on a slice both candidates were wrapped by the same rule)',
      fn: async () => {
        /**
         Subject shared by both line policies.
         */
        const subject = {
          sourceText: '可惜这一切戛然而止，猫猫再也没有回来。',
          archiveText: 'It is a pity that all this stopped abruptly; the cat never came back.',
          baseText: 'It is a pity that all this stopped abruptly;\nthe cat never came back.',
          polishedText: 'Sadly, it all ended there:\nthe cat never came home.',
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
      name: 'TREATS REJECTED BASE AS EVIDENCE rather than an approved fallback during required correction',
      fn: async () => {
        const messages = buildConsolidationPolishGateMessages({
          subject: {
            sourceText: '猫猫需要关爱。',
            archiveText: 'The cat needed care.',
            baseText: 'The cat was short on caring.',
            polishedText: 'The cat needed affection.',
            lineStructured: false,
            mode: {
              kind: 'required-naturalness-correction',
              findings: [{ paragraph: 1, problem: 'Replace the literal emotional phrase.', },],
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
        expect(sheet,).toContain('base already failed absolute naturalness review',);
        expect(sheet,).toContain('must not win merely because improvement is unclear',);
        expect(sheet,).toContain('Paragraph 1: Replace the literal emotional phrase.',);
        expect(sheet,).toContain('CANDIDATE "base" (rejected naturalness evidence only)',);
      },
    },),
  ],
},);

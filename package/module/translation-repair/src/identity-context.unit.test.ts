import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  buildCriticMessages,
  collectIdentityLines,
  extractDeclaredIdentity,
  sourcePronounLines,
} from '../dist/final/node/index.mjs';

//region Identity context tests
// Fixtures are cat-themed inventions, never real corpus entries, but they
// mirror the exact shapes the pinned corpus uses: a top-level `name` with
// `alias` and `location` nested under `info`.

await describe({
  name: '',
  children: [
    describe({
      name: extractDeclaredIdentity.name,
      children: [
        it({
          name: 'reads name from the top level and alias and location from info',
          fn: async () => {
            /**
             * Declaration in the shape the pinned corpus uses.
             */
            const identity = extractDeclaredIdentity({
              data: {
                name: 'Mittens Pawsworth',
                info: {
                  alias: 'Mittens, MTNS',
                  location: 'Catbury',
                },
              },
            },);

            expect(identity,).toEqual({
              name: 'Mittens Pawsworth',
              alias: 'Mittens, MTNS',
              location: 'Catbury',
            },);
          },
        },),

        it({
          name: 'returns an empty identity for non-record front matter',
          fn: async () => {
            expect(extractDeclaredIdentity({ data: null, },),).toEqual({},);
            expect(extractDeclaredIdentity({ data: 'whiskers', },),).toEqual({},);
            expect(extractDeclaredIdentity({ data: undefined, },),).toEqual({},);
          },
        },),

        it({
          name: 'skips non-string and blank declarations rather than coercing them',
          fn: async () => {
            /**
             * A coerced value would enter the prompt as an authoritative
             * correspondence, which is worse than declaring nothing.
             */
            const identity = extractDeclaredIdentity({
              data: {
                name: 42,
                info: {
                  alias: '   ',
                  location: [ 'Catbury', ],
                },
              },
            },);

            expect(identity,).toEqual({},);
          },
        },),

        it({
          name: 'tolerates info missing entirely',
          fn: async () => {
            expect(
              extractDeclaredIdentity({ data: { name: 'Mittens', }, },),
            ).toEqual({ name: 'Mittens', },);
          },
        },),
      ],
    },),

    describe({
      name: collectIdentityLines.name,
      children: [
        it({
          name: 'renders both sides of a transliterated name, the graded false-positive shape',
          fn: async () => {
            /**
             * Mirrors the Acheron and BI4PBV shape: the two sides declare
             * names matching neither phonetically nor semantically.
             */
            const lines = collectIdentityLines({
              sourceData: { name: '毛毛-fairy', },
              targetData: { name: 'Mittens', },
            },);

            expect(lines.join('\n',),).toContain('ORIGINAL declares "毛毛-fairy"',);
            expect(lines.join('\n',),).toContain('TRANSLATION declares "Mittens"',);
          },
        },),

        it({
          name: 'keeps a one-sided declaration and marks the undeclared side',
          fn: async () => {
            /**
             * A one-sided alias still tells the critic the handle is sourced
             * metadata rather than invention.
             */
            const lines = collectIdentityLines({
              sourceData: { info: { alias: '小毛', }, },
              targetData: { name: 'Mittens', },
            },);

            expect(lines.join('\n',),).toContain(
              'alias: ORIGINAL declares "小毛", TRANSLATION declares (nothing)',
            );
          },
        },),

        it({
          name: 'returns no lines when neither side declares anything',
          fn: async () => {
            expect(
              collectIdentityLines({
                sourceData: undefined,
                targetData: null,
              },),
            ).toHaveLength(0,);
          },
        },),

        it({
          name: 'omits fields no side declares',
          fn: async () => {
            /**
             * Only a name is declared, so no alias or location line appears.
             */
            const lines = collectIdentityLines({
              sourceData: { name: '毛毛', },
              targetData: { name: 'Mittens', },
            },);

            expect(lines,).toHaveLength(1,);
            expect(lines.join('\n',),).toContain('name:',);
          },
        },),

        it({
          name: 'never surfaces free prose such as desc as authoritative',
          fn: async () => {
            /**
             * `desc` is document content, not identity; declaring it
             * authoritative would license real defects inside it.
             */
            const lines = collectIdentityLines({
              sourceData: {
                name: '毛毛',
                desc: '一只很好的猫',
              },
              targetData: {
                name: 'Mittens',
                desc: 'A very good cat',
              },
            },);

            expect(lines.join('\n',),).not.toContain('一只很好的猫',);
            expect(lines.join('\n',),).not.toContain('A very good cat',);
          },
        },),
      ],
    },),

    describe({
      name: buildCriticMessages.name,
      children: [
        it({
          name: 'embeds the identity block before the documents when declared',
          fn: async () => {
            const [ , user, ] = buildCriticMessages({
              sourceText: '毛毛很可爱。',
              targetText: 'Mittens is adorable.',
              identityContext: '- name: ORIGINAL declares "毛毛", TRANSLATION declares "Mittens"',
            },);

            /**
             * User message carrying the fenced blocks.
             */
            const content = user?.content ?? '';

            expect(content,).toContain('IDENTITY',);
            // Declarations must precede the evidence they license.
            expect(content.indexOf('IDENTITY',),).toBeLessThan(
              content.indexOf('ORIGINAL',),
            );
          },
        },),

        it({
          name: 'emits no identity fence when nothing is declared',
          fn: async () => {
            const [ , user, ] = buildCriticMessages({
              sourceText: '毛毛很可爱。',
              targetText: 'Mittens is adorable.',
            },);

            expect(user?.content,).not.toContain('IDENTITY',);
          },
        },),

        it({
          name: 'states that declared names are authoritative',
          fn: async () => {
            const [ system, ] = buildCriticMessages({
              sourceText: '毛毛',
              targetText: 'Mittens',
            },);

            expect(system?.content,).toContain('AUTHORITATIVE',);
          },
        },),
      ],
    },),

    describe({
      name: sourcePronounLines.name,
      children: [
        it({
          name: 'NAMES THE PRONOUN THE ORIGINAL USES FOR ITS SUBJECT with its count, read off the '
            + 'whole document, since a subjectless Chinese sentence is about the person the page is '
            + 'about (the Toka_ls "they" of 2026-09-02, all eight judges reasoning that the '
            + 'sentence had no pronoun while the page used 她 sixteen times)',
          fn: async () => {
            expect(sourcePronounLines({
              text: '毛毛睁开双眼。她笑了。\n\n偶尔灵感迸发，左右推敲。\n\n她走了。',
            },),).toEqual(['- pronoun: ORIGINAL refers to this person as "她" (2 times)',],);
          },
        },),

        it({
          name: 'PICKS THE DOMINANT FORM and breaks a tie towards 她, then 他, then TA, counting TA '
            + 'case-sensitively so a romanised handle does not count',
          fn: async () => {
            expect(sourcePronounLines({ text: '他来了。他走了。她笑了。', },),)
              .toEqual(['- pronoun: ORIGINAL refers to this person as "他" (2 times)',],);
            expect(sourcePronounLines({ text: '他来了。她笑了。', },),)
              .toEqual(['- pronoun: ORIGINAL refers to this person as "她" (1 times)',],);
            expect(sourcePronounLines({ text: 'TA来了。TA走了。alias: catalog', },),)
              .toEqual(['- pronoun: ORIGINAL refers to this person as "TA" (2 times)',],);
          },
        },),

        it({
          name: 'LEAVES COMPOUNDS OUT OF THE COUNT: 他们, 她们, 其他, 其他人 and 他人 contain the '
            + 'character without being the pronoun, so a page about a woman with a few "others" '
            + 'in it still reads 她; the pinned corpus\'s XIEPT2 carries 77 她 against 17 他, of '
            + 'which 9 are 他们, 5 其他 and 3 他人',
          fn: async () => {
            expect(sourcePronounLines({ text: '她来了。他们走了。其他人笑了。他人说。她们唱歌。其他', },),)
              .toEqual(['- pronoun: ORIGINAL refers to this person as "她" (1 times)',],);
            expect(sourcePronounLines({ text: '他们走了。其他人笑了。', },),).toEqual([],);
          },
        },),

        it({
          name: 'COUNTS TA ONLY AS A WORD OF ITS OWN, not inside DATA, STATION or a romanised '
            + 'handle, so an uppercase Latin word on a pronoun-free page does not declare a '
            + 'neutral pronoun the original never used',
          fn: async () => {
            expect(sourcePronounLines({ text: 'DATA STATION TAG metaTA', },),).toEqual([],);
            expect(sourcePronounLines({ text: 'TA的DATA。TA。', },),)
              .toEqual(['- pronoun: ORIGINAL refers to this person as "TA" (2 times)',],);
          },
        },),

        it({
          name: 'EMITS NOTHING for an original that uses no third-person singular pronoun, leaving '
            + 'the house rule on neutral pronouns to speak for itself',
          fn: async () => {
            expect(sourcePronounLines({ text: '毛毛很可爱。猫咪在书店。', },),).toEqual([],);
            expect(sourcePronounLines({ text: '', },),).toEqual([],);
          },
        },),
      ],
    },),
  ],
},);

//endregion Identity context tests

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  findCategoricalDismissal,
  findTrailingQuestion,
  findUncertainty,
  NO_MATCH,
  stripNonProseRegions,
} from './uncertainty.ts';

await describe({
  name: 'uncertainty detection',
  children: [
    describe({
      name: findUncertainty.name,
      children: [
        it({
          name: 'matches a hedge phrase in prose',
          fn: async () => {
            expect(findUncertainty('This is probably the fix.',),).toEqual({ phrase: 'probably', },);
          },
        },),
        it({
          name: 'returns NO_MATCH when prose has no hedges',
          fn: async () => {
            expect(findUncertainty('A fact stated plainly.',),).toBe(NO_MATCH,);
          },
        },),
      ],
    },),
    describe({
      name: findCategoricalDismissal.name,
      children: [
        it({
          name: 'flags uncited "project doesn\'t use" dismissal',
          fn: async () => {
            expect(
              findCategoricalDismissal(
                "All JSX rules: project doesn't use JSX.",
              ),
            )
              .toEqual({ phrase: "project doesn't use", },);
          },
        },),
        it({
          name: 'flags uncited "we don\'t use" dismissal',
          fn: async () => {
            expect(findCategoricalDismissal("Skip; we don't use enums.",),)
              .toEqual({ phrase: "we don't use", },);
          },
        },),
        it({
          name: 'flags uncited "is already handled by" dismissal',
          fn: async () => {
            expect(
              findCategoricalDismissal(
                'Skip; operator-linebreak is already handled by dprint.',
              ),
            )
              .toEqual({ phrase: 'is already handled by', },);
          },
        },),
        it({
          name: 'allows dismissal when the same line cites a file path',
          fn: async () => {
            expect(
              findCategoricalDismissal(
                'Skip; is already handled by dprint (`packages/config/dprint/index.json:103`).',
              ),
            )
              .toBe(NO_MATCH,);
          },
        },),
        it({
          name: 'allows dismissal when the same line names AGENTS.md',
          fn: async () => {
            expect(
              findCategoricalDismissal(
                "Skip; the project doesn't use this (AGENTS.md bans it).",
              ),
            )
              .toBe(NO_MATCH,);
          },
        },),
        it({
          name: 'does not blanket-allow dismissals when citations are on other lines',
          fn: async () => {
            const text = [
              'A bullet with a real citation: see `packages/foo/bar.ts:42`.',
              "A separate bullet; project doesn't use JSX.",
            ]
              .join('\n',);
            expect(findCategoricalDismissal(text,),)
              .toEqual({ phrase: "project doesn't use", },);
          },
        },),
        it({
          name: 'returns NO_MATCH when prose has no dismissal',
          fn: async () => {
            expect(
              findCategoricalDismissal('Just a factual statement, no dismissal.',),
            )
              .toBe(NO_MATCH,);
          },
        },),
        it({
          name: 'flags "codebase doesn\'t have" without citation',
          fn: async () => {
            expect(
              findCategoricalDismissal(
                "Skip; the codebase doesn't have any Vue files.",
              ),
            )
              .toEqual({ phrase: "the codebase doesn't have", },);
          },
        },),
        it({
          name: 'flags "doesn\'t apply here" without citation',
          fn: async () => {
            expect(
              findCategoricalDismissal(
                "Skip; that rule doesn't apply here.",
              ),
            )
              .toEqual({ phrase: "doesn't apply here", },);
          },
        },),
        it({
          name: 'allows dismissal accompanied by a line-number suffix',
          fn: async () => {
            expect(
              findCategoricalDismissal(
                'Skip; is already covered by dprint at line :103.',
              ),
            )
              .toBe(NO_MATCH,);
          },
        },),
      ],
    },),
    describe({
      name: findTrailingQuestion.name,
      children: [
        it({
          name: 'flags a trailing question',
          fn: async () => {
            expect(findTrailingQuestion('I finished. Want me to run tests?',),)
              .toEqual({ sentence: 'Want me to run tests?', },);
          },
        },),
        it({
          name: 'returns NO_MATCH when no trailing question',
          fn: async () => {
            expect(findTrailingQuestion('I finished. Tests pass.',),).toBe(
              NO_MATCH,
            );
          },
        },),
        it({
          name: 'flags a question that spans the whole message (sentence start at 0)',
          fn: async () => {
            expect(findTrailingQuestion('Want me to commit?',),)
              .toEqual({ sentence: 'Want me to commit?', },);
          },
        },),
        it({
          name: 'finds the sentence start after a terminator and multiple spaces',
          fn: async () => {
            expect(findTrailingQuestion('Done!   Should I proceed?',),)
              .toEqual({ sentence: 'Should I proceed?', },);
          },
        },),
        it({
          name: 'ignores a rhetorical trailing question',
          fn: async () => {
            expect(findTrailingQuestion('I fixed it. Why would anyone object?',),).toBe(
              NO_MATCH,
            );
          },
        },),
      ],
    },),
    describe({
      name: stripNonProseRegions.name,
      children: [
        it({
          name: 'strips fenced code blocks',
          fn: async () => {
            const cleaned = stripNonProseRegions(
              'before\n```js\nmaybe();\n```\nafter',
            );
            expect(cleaned.includes('maybe',),).toBe(false,);
          },
        },),
        it({
          name: 'strips inline code',
          fn: async () => {
            const cleaned = stripNonProseRegions('use `maybe` here',);
            expect(cleaned.includes('maybe',),).toBe(false,);
          },
        },),
      ],
    },),
  ],
},);

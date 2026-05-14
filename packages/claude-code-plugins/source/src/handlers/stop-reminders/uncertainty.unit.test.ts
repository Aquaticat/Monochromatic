import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import {
  findCategoricalDismissal,
  findTrailingQuestion,
  findUncertainty,
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
            const m = findUncertainty('This is probably the fix.',);
            expect(m?.phrase,).toBe('probably',);
          },
        },),
        it({
          name: 'returns undefined when prose has no hedges',
          fn: async () => {
            expect(findUncertainty('A fact stated plainly.',),).toBe(undefined,);
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
            const m = findCategoricalDismissal(
              'All JSX rules: project doesn\'t use JSX.',
            );
            expect(m?.phrase.toLowerCase(),).toBe('project doesn\'t use',);
          },
        },),
        it({
          name: 'flags uncited "we don\'t use" dismissal',
          fn: async () => {
            const m = findCategoricalDismissal('Skip; we don\'t use enums.',);
            expect(m?.phrase.toLowerCase(),).toBe('we don\'t use',);
          },
        },),
        it({
          name: 'flags uncited "is already handled by" dismissal',
          fn: async () => {
            const m = findCategoricalDismissal(
              'Skip; operator-linebreak is already handled by dprint.',
            );
            expect(m?.phrase.toLowerCase(),).toBe('is already handled by',);
          },
        },),
        it({
          name: 'allows dismissal when the same line cites a file path',
          fn: async () => {
            expect(
              findCategoricalDismissal(
                'Skip; is already handled by dprint (`packages/config/dprint/index.json:103`).',
              ),
            ).toBe(undefined,);
          },
        },),
        it({
          name: 'allows dismissal when the same line names AGENTS.md',
          fn: async () => {
            expect(
              findCategoricalDismissal(
                'Skip; the project doesn\'t use this (AGENTS.md bans it).',
              ),
            ).toBe(undefined,);
          },
        },),
        it({
          name: 'does not blanket-allow dismissals when citations are on other lines',
          fn: async () => {
            const text = [
              'A bullet with a real citation: see `packages/foo/bar.ts:42`.',
              'A separate bullet; project doesn\'t use JSX.',
            ].join('\n',);
            const m = findCategoricalDismissal(text,);
            expect(m?.phrase.toLowerCase(),).toBe('project doesn\'t use',);
          },
        },),
        it({
          name: 'returns undefined when prose has no dismissal',
          fn: async () => {
            expect(
              findCategoricalDismissal('Just a factual statement, no dismissal.',),
            ).toBe(undefined,);
          },
        },),
        it({
          name: 'flags "codebase doesn\'t have" without citation',
          fn: async () => {
            const m = findCategoricalDismissal(
              'Skip; the codebase doesn\'t have any Vue files.',
            );
            expect(m?.phrase.toLowerCase(),).toBe(
              'the codebase doesn\'t have',
            );
          },
        },),
        it({
          name: 'flags "doesn\'t apply here" without citation',
          fn: async () => {
            const m = findCategoricalDismissal(
              'Skip; that rule doesn\'t apply here.',
            );
            expect(m?.phrase.toLowerCase(),).toBe('doesn\'t apply here',);
          },
        },),
        it({
          name: 'allows dismissal accompanied by a line-number suffix',
          fn: async () => {
            expect(
              findCategoricalDismissal(
                'Skip; is already covered by dprint at line :103.',
              ),
            ).toBe(undefined,);
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
            const m = findTrailingQuestion('I finished. Want me to run tests?',);
            expect(m?.sentence,).toBe('Want me to run tests?',);
          },
        },),
        it({
          name: 'returns undefined when no trailing question',
          fn: async () => {
            expect(findTrailingQuestion('I finished. Tests pass.',),).toBe(
              undefined,
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

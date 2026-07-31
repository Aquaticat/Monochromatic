/**
 * Built-artifact tests for session-local judge call history.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { createJudgeCallHistory, } from '../dist/final/node/index.mjs';

/** Canonical model identity used by call-history fixtures. */
const MODEL_SLUG = 'test/reviewer';

await describe({
  name: createJudgeCallHistory.name,
  children: [
    it({
      name: 'blocklists only after three most recent calls all produced no content',
      fn: async () => {
        /** Isolated history under test. */
        const history = createJudgeCallHistory();
        history.record({ modelSlug: MODEL_SLUG, outcome: 'noContent', },);
        history.record({ modelSlug: MODEL_SLUG, outcome: 'noContent', },);
        expect(history.blocklistedModelSlugs(),).toEqual([],);

        history.record({ modelSlug: MODEL_SLUG, outcome: 'noContent', },);
        expect(history.blocklistedModelSlugs(),).toEqual([MODEL_SLUG,],);
      },
    },),
    it({
      name: 'uses rolling recency and removes blocklist after another outcome',
      fn: async () => {
        /** Isolated rolling history under test. */
        const history = createJudgeCallHistory();
        history.record({ modelSlug: MODEL_SLUG, outcome: 'noContent', },);
        history.record({ modelSlug: MODEL_SLUG, outcome: 'other', },);
        history.record({ modelSlug: MODEL_SLUG, outcome: 'noContent', },);
        history.record({ modelSlug: MODEL_SLUG, outcome: 'noContent', },);
        expect(history.blocklistedModelSlugs(),).toEqual([],);

        history.record({ modelSlug: MODEL_SLUG, outcome: 'noContent', },);
        expect(history.blocklistedModelSlugs(),).toEqual([MODEL_SLUG,],);

        history.record({ modelSlug: MODEL_SLUG, outcome: 'other', },);
        expect(history.blocklistedModelSlugs(),).toEqual([],);
      },
    },),
    it({
      name: 'clears temporary blocklist at session boundary',
      fn: async () => {
        /** Isolated history under test. */
        const history = createJudgeCallHistory();
        history.record({ modelSlug: MODEL_SLUG, outcome: 'noContent', },);
        history.record({ modelSlug: MODEL_SLUG, outcome: 'noContent', },);
        history.record({ modelSlug: MODEL_SLUG, outcome: 'noContent', },);
        history.clear();
        expect(history.blocklistedModelSlugs(),).toEqual([],);
      },
    },),
  ],
},);

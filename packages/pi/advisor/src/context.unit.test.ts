/**
 * Unit tests for Advisor context serialization.
 *
 * @module
 */

import type { SessionEntry, } from '@earendil-works/pi-coding-agent';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import { ADVISOR_MESSAGE_TYPE, } from './constants.ts';
import {
  buildAdvisorContext,
  truncateContext,
} from './context.ts';
import { DEFAULT_CONFIG, } from './config.ts';
import type { AdvisorConfig, } from './types.ts';

//region Fixtures

/** Context truncation budget for tests. */
const TRUNCATION_BUDGET = 5;

/** Stable timestamp for fixture entries. */
const TIMESTAMP = '2026-05-15T00:00:00.000Z';

/** Advisor config fixture with prior Advisor results omitted. */
const omitPriorAdvisorConfig: AdvisorConfig = {
  ...DEFAULT_CONFIG,
  includePriorAdvisorResults: false,
  source: {
    globalPath: '/home/test/.pi/agent/extensions/pi-advisor.json',
    projectPath: '/repo/.pi/extensions/pi-advisor.json',
    globalLoaded: false,
    projectLoaded: false,
  },
};

/** Advisor custom message from a previous manual `/advisor` run. */
const priorAdvisorMessage: SessionEntry = {
  type: 'custom_message',
  id: 'advisor-message',
  parentId: null,
  timestamp: TIMESTAMP,
  customType: ADVISOR_MESSAGE_TYPE,
  content: 'prior advisor text',
  display: true,
};

/** Non-Advisor custom message that should remain visible. */
const otherCustomMessage: SessionEntry = {
  type: 'custom_message',
  id: 'other-message',
  parentId: 'advisor-message',
  timestamp: TIMESTAMP,
  customType: 'other-extension',
  content: 'other extension text',
  display: true,
};

//endregion Fixtures

await describe({
  name: buildAdvisorContext.name,
  children: [
    it({
      name: 'omits prior Advisor custom messages when configured',
      fn: async () => {
        const context = buildAdvisorContext({
          branch: [
            priorAdvisorMessage,
            otherCustomMessage,
          ],
          config: omitPriorAdvisorConfig,
          advisorSystemPrompt: 'review carefully',
        },);
        expect(context.text,).not.toContain('prior advisor text',);
        expect(context.text,).toContain('other extension text',);
      },
    },),
  ],
},);

await describe({
  name: truncateContext.name,
  children: [
    it({
      name: 'preserves head and tail when truncating',
      fn: async () => {
        const result = truncateContext({
          text: 'abcdefghij',
          maxChars: TRUNCATION_BUDGET,
        },);
        expect(result.truncated,).toBe(true,);
        expect(result.text,).toContain('advisor: middle of serialized conversation omitted',);
      },
    },),
  ],
},);

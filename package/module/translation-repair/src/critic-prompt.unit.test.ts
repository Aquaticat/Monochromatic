/**
 * Tests for the shared critic prompt sheet:
 * closed vocabularies embedded, quote rules stated, both documents
 * fenced verbatim, JSON-only reply demanded.
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  buildCriticMessages,
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
} from '../dist/final/neutral/index.mjs';

/**
 * Invented zh source shown to critics.
 */
const SOURCE_TEXT = '## 猫的日常\n\n小猫喜欢晒太阳。\n';

/**
 * Invented translation under review.
 */
const TARGET_TEXT = '## A cat\'s day\n\nThe kitten loves sunbathing.\n';

/**
 * Messages the prompt tests probe.
 */
const MESSAGES = buildCriticMessages({
  sourceText: SOURCE_TEXT,
  targetText: TARGET_TEXT,
},);

await describe({
  name: buildCriticMessages.name,
  children: [
    it({
      name: 'opens with system instructions, then one user sheet',
      fn: async () => {
        expect(MESSAGES.map(function toRole(message,) {
          return message.role;
        },),).toEqual(['system', 'user',],);
      },
    },),
    it({
      name: 'embeds every listed category and severity in the instructions',
      fn: async () => {
        /**
         * System instructions under vocabulary probing.
         */
        const system = MESSAGES[0]?.content ?? '';
        for (const category of ISSUE_CATEGORIES)
          expect(system,).toContain(category,);
        for (const severity of ISSUE_SEVERITIES)
          expect(system,).toContain(severity,);
        expect(system,).toContain('ONLY a JSON object',);
      },
    },),
    it({
      name: 'fences both documents verbatim on the user sheet',
      fn: async () => {
        /**
         * User sheet carrying the fenced pair.
         */
        const sheet = MESSAGES[1]?.content ?? '';
        expect(sheet,).toContain(`===== ORIGINAL =====\n${SOURCE_TEXT}`,);
        expect(sheet,).toContain(`===== TRANSLATION =====\n${TARGET_TEXT}`,);
        expect(sheet,).toContain('===== END =====',);
      },
    },),
  ],
},);

/**
 * Unit tests for Advisor rendering summaries.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { firstAdvisoryLine, } from './rendering-summary.ts';

await describe({
  name: firstAdvisoryLine.name,
  children: [
    it({
      name: 'skips markdown headings before body text',
      fn: async function testSkipsMarkdownHeadingsBeforeBodyText() {
        expect(firstAdvisoryLine(`
## Advisor review

### Flawed assumptions

1. **Assumption** Check the active model identity.
`,),).toBe('1. **Assumption** Check the active model identity.',);
      },
    },),
    it({
      name: 'keeps markdown heading when it is the only text',
      fn: async function testKeepsOnlyMarkdownHeading() {
        expect(firstAdvisoryLine('## Advisor review',),).toBe('## Advisor review',);
      },
    },),
  ],
},);

import type { Rule, } from 'markdownlint';

import noPipeTables from './no-pipe-tables.ts';

export { default as toHtmlTable, } from './to-html-table.ts';

/**
 * Custom markdownlint rules for this repo, in the shape markdownlint-cli2's
 * `customRules` array expects (each entry is a rule or an array of rules).
 */
const rules: Rule[] = [noPipeTables,];

export default rules;

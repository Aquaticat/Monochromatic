// @ts-check

import noPipeTables from './no-pipe-tables.mjs';

/**
 * Custom markdownlint rules for this repo, in the shape markdownlint-cli2's
 * `customRules` array expects (each entry is a rule or an array of rules).
 *
 * @type {import('markdownlint').Rule[]}
 */
const rules = [noPipeTables];

export default rules;

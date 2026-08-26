#!/usr/bin/env node

/**
 * Detached terminal entry that opens configured editor for one Pi answer request.
 *
 * @module
 */

import { parseArgs, } from 'node:util';

import { runAnswerHelper, } from './helper-core.ts';

//region Arguments

/**
 * Strict helper command-line values supplied by extension bundle.
 */
const parsed = parseArgs({
  args: process.argv
    .slice(2,),
  strict: true,
  options: {
    request: {
      type: 'string',
    },
  },
},);

/**
 * Private helper request path passed as sole required option.
 */
const requestPath = parsed.values
  .request;
if ((requestPath === undefined) || (requestPath.length === 0))
  throw new Error('Answer helper requires --request path.',);

//endregion Arguments

await runAnswerHelper({ requestPath, },);

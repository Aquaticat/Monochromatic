/**
 * Direct check and fix Optique grammar.
 *
 * @module
 */
import {
  argument,
  command,
  constant,
  flag,
  multiple,
  object,
  option,
  optional,
  or,
  string,
  type Parser,
  withDefault,
} from '@optique/core';

/**
 * Direct read-only policy check parser.
 */
const CHECK_PARSER = command(
  'check',
  object({
  command: constant('check' as const,),
  all: withDefault(
    optional(flag('--all',),),
    false,
  ),
  policies: multiple(option(
    '--policy',
    string(),
  ),),
  pathspecs: multiple(argument(
    string(),
  ),),
},),
);
/**
 * Direct convergent policy fix parser.
 */
const FIX_PARSER = command(
  'fix',
  object({
  command: constant('fix' as const,),
  all: withDefault(
    optional(flag('--all',),),
    false,
  ),
  policies: multiple(option(
    '--policy',
    string(),
  ),),
  pathspecs: multiple(argument(
    string(),
  ),),
},),
);

/**
 * Shared direct-operation parser.
 *
 * @example
 * ```ts
 * runParserSync(DIRECT_MANAGEMENT_PARSER, 'git cli-git', ['check', '--all']);
 * ```
 */
export const DIRECT_MANAGEMENT_PARSER: Parser = or(
  CHECK_PARSER,
  FIX_PARSER,
);

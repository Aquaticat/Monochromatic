import {
  parseArgs,
  type ParseArgsOptionDescriptor,
} from 'node:util';

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import { isAsciiDigits, } from '../ascii-letters.ts';
import { StatedRefusalError, } from '../stated-refusal.ts';

//region Command line
// THE ONE READER OF THE WHOLE COMMAND LINE every runner takes (ledger B75).
//
// Each runner used to find its own flags with `indexOf` or `includes` on the
// exact token, so a flag written any other way read as not written at all.
// `--cap=0` bought every subject the settled audit could buy, `--olny Toka_ls`
// or a mistyped `--plan` ran every pending corpus entry for real, a second
// `--only` was dropped, and a command that takes no flags ran as if nothing
// had been typed after it. B73 gave the flag VALUES one reader; the line itself
// still had none, so nothing said which tokens a command reads at all.
//
// EVERY RUNNER NOW DECLARES WHAT IT READS, in `command-lines.ts`, and
// `reportingRefusals` reads the whole line against that before the command
// starts. Node's `parseArgs` splits the line, so the equals form, the `--`
// terminator and grouped short flags read as they do for every Node command.
// It runs with `strict` off and hands back its tokens, and every refusal is
// written here: all of them at once, in the words the B73 readers already
// used, and a number written with a minus sign after a flag still reaches the
// reader that answers it as below zero, which strict `parseArgs` refuses as
// ambiguous before any reader sees it.

/**
 Position of the script path in a process's arguments, after the runtime.
 */
const SCRIPT_AT = 1;

/**
 Position of the first argument the person typed.
 */
const FIRST_TYPED_AT = 2;

/**
 Marker a long flag starts with.
 */
const LONG_PREFIX = '--';

/**
 Sign a number below zero is written with.
 */
const MINUS = '-';

/**
 What a flag carried, or that nobody wrote it.

 NAMED RATHER THAN LEFT NULLISH because the two answers lead to opposite
 behaviour one line later: an unwritten flag takes a default, and a written
 one is read and may be refused. Each answer carries the flag as the person
 types it, so a reader refusing the value names the flag without being told
 it a second time.

 @example
 ```ts
 const asked: FlagValue = { kind: 'written', flag: '--cap', value: '4', };
 ```
 */
export type FlagValue = {
  readonly kind: 'written';

  /**
   Flag as typed, dashes included.
   */
  readonly flag: string;

  /**
   What was written after it, never empty: an empty value is refused.
   */
  readonly value: string;
} | {
  readonly kind: 'unwritten';

  /**
   Flag as typed, dashes included.
   */
  readonly flag: string;
};

/**
 What a command reads after its flags, by position.

 @example
 ```ts
 const logs: PositionalSpec = { names: ['log file',], least: 1, rest: true, };
 ```
 */
export type PositionalSpec = {
  /**
   What each position holds, in order, as the usage line names it.
   */
  readonly names: readonly string[];

  /**
   How many positions must be written.
   */
  readonly least: number;

  /**
   Whether the last position may be written any number of times.
   */
  readonly rest: boolean;
};

/**
 Everything a command reads from its command line.

 @example
 ```ts
 const spec: CommandLineSpec = {
   valued: { only: 'entry ids', },
   repeatable: {},
   switches: { plan: true, },
   positionals: { names: [], least: 0, rest: false, },
 };
 ```
 */
export type CommandLineSpec<
  Valued extends string = string,
  Listed extends string = string,
  Switch extends string = string,
> = {
  /**
   Flags written once with a value, each mapped to what the value is, as the
   usage line names it.
   */
  readonly valued: Readonly<Record<Valued, string>>;

  /**
   Flags that may be written any number of times, each with a value.
   */
  readonly repeatable: Readonly<Record<Listed, string>>;

  /**
   Flags written once with no value, each mapped to `true`, so a table
   naming the switches a command reads must name every one of them.
   */
  readonly switches: Readonly<Record<Switch, true>>;

  /**
   What the command reads after its flags.
   */
  readonly positionals: PositionalSpec;
};

/**
 A command line read against what its command declares, offering only the
 flags declared: asking for any other is a type error rather than a flag that
 always reads as unwritten.

 @example
 ```ts
 const asked = line.flag('only',);
 ```
 */
export type CommandLineFor<Spec extends CommandLineSpec> = {
  /**
   Path of the script the runtime ran, which names the runner's built file.
   */
  readonly script: string;

  /**
   What a flag written once with a value carried.
   */
  readonly flag: (name: keyof Spec['valued'] & string) => FlagValue;

  /**
   Every value a repeatable flag carried, in the order written.
   */
  readonly list: (name: keyof Spec['repeatable'] & string) => readonly string[];

  /**
   Whether a switch was written.
   */
  readonly switched: (name: keyof Spec['switches'] & string) => boolean;

  /**
   What was written after the flags, by position.
   */
  readonly positionals: readonly string[];
};

/**
 The part of a command line a reader of one valued flag needs, so a reader
 shared by several commands accepts the line of any command declaring it.

 @example
 ```ts
 function readCap({ line, }: { readonly line: ReadsFlag<'cap'>; },): FlagValue { return line.flag('cap',); }
 ```
 */
export type ReadsFlag<Name extends string> = {
  readonly flag: (name: Name) => FlagValue;
};

/**
 The part of a command line a reader of one switch needs.

 @example
 ```ts
 function readPlan({ line, }: { readonly line: ReadsSwitch<'plan'>; },): boolean { return line.switched('plan',); }
 ```
 */
export type ReadsSwitch<Name extends string> = {
  readonly switched: (name: Name) => boolean;
};

/**
 One option token as `parseArgs` hands it back.

 @example
 ```ts
 const token: OptionToken = { kind: 'option', index: 0, name: 'plan', rawName: '--plan', value: undefined, };
 ```
 */
type OptionToken = {
  readonly kind: 'option';
  readonly index: number;
  readonly name: string;
  readonly rawName: string;
  readonly value: string | undefined;
};

/**
 What one option token reads as against the declaration.

 @example
 ```ts
 const reading: OptionReading = { kind: 'value', name: 'only', value: 'tabby', };
 ```
 */
type OptionReading =
  | {
    readonly kind: 'value';
    readonly name: string;
    readonly value: string;
  }
  | {
    readonly kind: 'switch';
    readonly name: string;
  }
  | {
    readonly kind: 'refused';
    readonly says: string;
  };

/**
 Whether an argument is a minus sign before digits, which this package's
 runners read as a number rather than as a flag.

 A COUNT TYPED BELOW ZERO STAYS A COUNT. `parseArgs` reads `-3` as the short
 flag `-3`, and no runner declares one, so without this a bench asked for
 `-3` slices would be told it has no flag `-3` rather than that a count cannot
 be below one, which is what was typed (ledger B73). Python's argparse reads
 such an argument as a value for the same reason when no flag looks like a
 number, and no flag here does.

 @param written - argument as typed

 @returns True for a minus sign followed by ASCII digits only

 @example
 ```ts
 isMinusNumber({ written: '-3', },); // true
 ```
 */
function isMinusNumber({ written, }: { readonly written: string; },): boolean {
  return written.startsWith(MINUS,)
    && isAsciiDigits({ text: written.slice(MINUS.length,), },);
}

/**
 The declaration in the form `parseArgs` takes, so a valued flag consumes the
 argument after it and a switch does not.

 @param spec - what the command reads

 @returns Option descriptors keyed by flag name

 @example
 ```ts
 const options = optionsOf({ spec, },);
 ```
 */
function optionsOf({ spec, }: { readonly spec: CommandLineSpec; },): Record<string, ParseArgsOptionDescriptor> {
  /**
   Descriptor of a flag that carries a value.
   */
  const carriesValue: ParseArgsOptionDescriptor = { type: 'string', };

  /**
   Descriptor of a switch.
   */
  const carriesNothing: ParseArgsOptionDescriptor = { type: 'boolean', };

  return Object.fromEntries([
    ...Object.keys(spec.valued,).map(function valuedOption(name,): [string, ParseArgsOptionDescriptor,] {
      return [name, carriesValue,];
    },),
    ...Object.keys(spec.repeatable,).map(function repeatableOption(name,): [string, ParseArgsOptionDescriptor,] {
      return [name, carriesValue,];
    },),
    ...Object.keys(spec.switches,).map(function switchOption(name,): [string, ParseArgsOptionDescriptor,] {
      return [name, carriesNothing,];
    },),
  ],);
}

/**
 The usage line a refusal ends with, built from the declaration so it cannot
 drift from what the command reads.

 @param command - command name as typed

 @param spec - what it reads

 @returns Command, then its flags, then its positions; a bracketed part may be
 left off

 @example
 ```ts
 usageOf({ command: 'corpus-pass', spec, },); // 'corpus-pass [--only <entry ids>] [--plan]'
 ```
 */
function usageOf(
  {
    command,
    spec,
  }: {
    readonly command: string;
    readonly spec: CommandLineSpec;
  },
): string {
  /**
   Names of the positions, as declared.
   */
  const { names, } = spec.positionals;

  /**
   Each part of the line after the command.
   */
  const parts = [
    ...Object.entries(spec.valued,).map(function valuedPart([name, value,],): string {
      return `[--${name} <${value}>]`;
    },),
    ...Object.entries(spec.repeatable,).map(function repeatablePart([name, value,],): string {
      return `[--${name} <${value}> ...]`;
    },),
    ...Object.keys(spec.switches,).map(function switchPart(name,): string {
      return `[--${name}]`;
    },),
    ...names.map(function positionalPart(name, at,): string {
      /**
       Whether this position must be written.
       */
      const required = at < spec.positionals.least;

      /**
       Whether this is the last position and may repeat.
       */
      const repeats = spec.positionals.rest && (at === (names.length - 1));

      if (repeats)
        return required ? `<${name}> [<${name}> ...]` : `[<${name}> ...]`;
      return required ? `<${name}>` : `[<${name}>]`;
    },),
  ];
  return [command, ...parts,].join(' ',);
}

/**
 Reads one option token against the declaration.

 @param token - token as `parseArgs` split it

 @param written - the whole argument the token came from

 @param spec - what the command reads

 @returns The value or switch it carries, or why it is refused

 @example
 ```ts
 const reading = optionReading({ token, written: '--only=tabby', spec, },);
 ```
 */
function optionReading(
  {
    token,
    written,
    spec,
  }: {
    readonly token: OptionToken;
    readonly written: string;
    readonly spec: CommandLineSpec;
  },
): OptionReading {
  /**
   Flag as the person typed it, without any value written with `=`.
   */
  const flag = token.rawName;

  /**
   Whether the declaration names this flag as carrying a value.
   */
  const carriesValue = Object.hasOwn(spec.valued, token.name,) || Object.hasOwn(spec.repeatable, token.name,);

  if (carriesValue) {
    // NOTHING AFTER IT, AN EMPTY ARGUMENT, OR THE NEXT FLAG standing where its
    // value should be: each once read as unwritten and took the default nobody
    // asked for (ledger B73).
    if ((token.value === undefined) || (token.value === '') || token.value.startsWith(LONG_PREFIX,))
      return {
        kind: 'refused',
        says: `${flag} needs a value written after it`,
      };
    return {
      kind: 'value',
      name: token.name,
      value: token.value,
    };
  }

  if (Object.hasOwn(spec.switches, token.name,)) {
    if (token.value !== undefined)
      return {
        kind: 'refused',
        says: `${flag} takes no value, and ${written} gives it one`,
      };
    return {
      kind: 'switch',
      name: token.name,
    };
  }

  return {
    kind: 'refused',
    says: `${flag.startsWith(LONG_PREFIX,) ? flag : written} is not a flag this command reads`,
  };
}

/**
 Refusals for flags written more than once and for positions written past or
 short of what the command reads.

 @param timesWritten - how often each once-only flag was written

 @param positionals - what was written by position

 @param spec - what the command reads

 @returns One refusal per problem, empty when there is none

 @example
 ```ts
 const said = countRefusals({ timesWritten, positionals, spec, },);
 ```
 */
function countRefusals(
  {
    timesWritten,
    positionals,
    spec,
  }: {
    readonly timesWritten: ReadonlyMap<string, number>;
    readonly positionals: readonly string[];
    readonly spec: CommandLineSpec;
  },
): readonly string[] {
  /**
   Names of the positions, as declared.
   */
  const {
    names,
    least,
    rest,
  } = spec.positionals;

  /**
   Flags written twice or more, each a refusal: a second value once replaced
   or was dropped in favour of the first, without a word either way.
   */
  const repeated = [...timesWritten,]
    .filter(function isRepeated([, times,],): boolean {
      return times > 1;
    },)
    .map(function repeatRefusal([name, times,],): string {
      return `--${name} is written ${String(times,)} times, and is read once`;
    },);

  /**
   Arguments past the last position the command reads.
   */
  const extra = rest ? [] : positionals.slice(names.length,);

  /**
   Positions that must be written and were not, as the usage line shows them.
   */
  const missing = names
    .slice(positionals.length, least,)
    .map(function shown(name,): string {
      return `<${name}>`;
    },);

  /**
   Last position read, after which nothing more is.
   */
  const last = names.at(-1,);

  /**
   Refusal of arguments past the last position, empty when there are none.
   */
  const past = (extra.length === 0)
    ? []
    : [
      (last === undefined)
        ? `this command takes no argument but its flags, and was given ${extra.join(' ',)}`
        : `this command takes nothing after <${last}>, and was given ${extra.join(' ',)}`,
    ];

  return [
    ...repeated,
    ...past,
    ...((missing.length === 0) ? [] : [`this command needs ${missing.join(' ',)}`,]),
  ];
}

/**
 Reads a runner's whole command line against what it declares.

 @param command - command name as typed, which starts the usage line

 @param spec - what it reads

 @param argv - process arguments: the runtime, the script, then what was typed

 @returns The flags, switches and positions written, offering only those
 declared

 @throws StatedRefusalError naming every problem at once, then the usage line:
 a flag the command does not read, a valued flag written with nothing usable
 after it, a switch given a value, a once-only flag written twice, an argument
 past the last position read, or a required position left out

 @example
 ```ts
 const line = readCommandLine({ command: 'corpus-pass', spec: COMMAND_LINES['corpus-pass'], argv: process.argv, },);
 ```
 */
export function readCommandLine<const Spec extends CommandLineSpec>(
  {
    command,
    spec,
    argv,
  }: {
    readonly command: string;
    readonly spec: Spec;
    readonly argv: readonly string[];
  },
): CommandLineFor<Spec> {
  /**
   Script the runtime ran.
   */
  const script = nonNullishOrThrow(argv[SCRIPT_AT],);

  /**
   What the person typed after it.
   */
  const typed = argv.slice(FIRST_TYPED_AT,);

  /**
   The line split into flags, values and positions.
   */
  const { tokens, } = parseArgs({
    args: [...typed,],
    options: optionsOf({ spec, },),
    strict: false,
    allowPositionals: true,
    tokens: true,
  },);

  /**
   Why the line is refused, in the order the problems were written.
   */
  const refusals: string[] = [];

  /**
   Value of each once-only flag written.
   */
  const values = new Map<string, string>();

  /**
   Values of each repeatable flag, in the order written.
   */
  const lists = new Map<string, string[]>();

  /**
   Switches written.
   */
  const switches = new Set<string>();

  /**
   How often each once-only flag or switch was written.
   */
  const timesWritten = new Map<string, number>();

  /**
   What was written by position.
   */
  const positionals: string[] = [];

  /**
   Arguments already read whole, since one grouped argument splits into
   several tokens that share its position.
   */
  const readWhole = new Set<number>();

  for (const token of tokens) {
    if (token.kind === 'option-terminator')
      continue;
    if (token.kind === 'positional') {
      positionals.push(token.value,);
      continue;
    }

    /**
     The whole argument this token came from.
     */
    const written = nonNullishOrThrow(typed[token.index],);

    if (readWhole.has(token.index,))
      continue;

    if (isMinusNumber({ written, },)) {
      readWhole.add(token.index,);
      positionals.push(written,);
      continue;
    }

    /**
     What this token reads as.
     */
    const reading = optionReading({
      token,
      written,
      spec,
    },);

    if (reading.kind === 'refused') {
      // A grouped short argument is refused once, whole, as it was typed.
      readWhole.add(token.index,);
      refusals.push(reading.says,);
      continue;
    }

    if (reading.kind === 'switch') {
      timesWritten.set(reading.name, (timesWritten.get(reading.name,) ?? 0) + 1,);
      switches.add(reading.name,);
      continue;
    }

    if (Object.hasOwn(spec.repeatable, reading.name,)) {
      /**
       Values this flag carried before this one.
       */
      const earlier = lists.get(reading.name,);
      if (earlier === undefined)
        lists.set(reading.name, [reading.value,],);
      else
        earlier.push(reading.value,);
      continue;
    }

    timesWritten.set(reading.name, (timesWritten.get(reading.name,) ?? 0) + 1,);
    values.set(reading.name, reading.value,);
  }

  refusals.push(...countRefusals({
    timesWritten,
    positionals,
    spec,
  },),);

  if (refusals.length > 0)
    throw new StatedRefusalError({
      says: `${refusals.join('; ',)}. Usage: ${usageOf({
        command,
        spec,
      },)}`,
    },);

  return {
    script,
    flag: function flag(name: string,): FlagValue {
      /**
       What the flag carried, absent when it was not written.
       */
      const value = values.get(name,);
      return (value === undefined)
        ? {
          kind: 'unwritten',
          flag: `--${name}`,
        }
        : {
          kind: 'written',
          flag: `--${name}`,
          value,
        };
    },
    list: function list(name: string,): readonly string[] {
      return lists.get(name,) ?? [];
    },
    switched: function switched(name: string,): boolean {
      return switches.has(name,);
    },
    positionals,
  };
}

//endregion Command line

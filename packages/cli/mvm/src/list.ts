import { VM_PREFIX, } from './config.ts';
import {
  l,
  tagged,
} from './log.ts';
import { virsh, } from './virsh.ts';

/** Single VM entry with its display name and current libvirt state. */
export type VmInfo = {
  name: string;
  state: string;
};

/**
 * Checks whether `c` is a single ASCII whitespace character.
 *
 * @param c - single-character string to inspect
 *
 * @returns whether `c` is space, tab, newline, carriage return, form feed, or vertical tab
 *
 * @example
 * ```ts
 * isWhitespaceChar(' ');  // true
 * isWhitespaceChar('a');  // false
 * ```
 */
function isWhitespaceChar(c: string,): boolean {
  return (c === ' ')
    || (c === '\t')
    || (c === '\n')
    || (c === '\r')
    || (c === '\f')
    || (c === '\v');
}

/**
 * Checks whether `s` consists only of ASCII digits and is non-empty.
 *
 * @param s - string to inspect
 *
 * @returns whether every character of `s` is in `[0-9]` and `s` is non-empty
 *
 * @example
 * ```ts
 * isDigitString('42'); // true
 * isDigitString('');   // false
 * isDigitString('1a'); // false
 * ```
 */
function isDigitString(s: string,): boolean {
  if (s.length === 0)
    return false;
  for (const c of s) {
    if ((c < '0') || (c > '9'))
      return false;
  }
  return true;
}

/**
 * Splits `s` on runs of whitespace, dropping empty fragments.
 *
 * Equivalent to `s.trim().split(/\s+/)` for non-empty results; written as an
 * index walker to avoid a regex literal under the `require-regex-justification`
 * rule.
 *
 * @param s - input string
 *
 * @returns ordered non-empty tokens
 *
 * @example
 * ```ts
 * splitOnWhitespace('  a  b\tc'); // ['a', 'b', 'c']
 * splitOnWhitespace('   ');       // []
 * ```
 */
function splitOnWhitespace(s: string,): readonly string[] {
  /**
   * Walks `s` from `idx`, accumulating tokens.
   *
   * @param idx - current scan offset
   *
   * @param acc - tokens collected so far
   *
   * @returns final token list once the cursor exceeds `s.length`
   *
   * @example
   * ```ts
   * walk({ idx: 0, acc: [] }); // ['a', 'b'] for s === 'a b'
   * ```
   */
  function walk(
    {
      idx,
      acc,
    }: {
      idx: number;
      acc: readonly string[];
    },
  ): readonly string[] {
    if (idx >= s.length)
      return acc;
    /** Current char under the cursor; whitespace skips, non-whitespace starts a token. */
    const c = s.charAt(idx,);
    if (isWhitespaceChar(c,)) {
      return walk({
        idx: idx + 1,
        acc,
      },);
    }
    /**
     * Locates the exclusive end of the token starting at the calling cursor.
     *
     * @param end - candidate end index; advanced until whitespace or EOS
     *
     * @returns exclusive token end
     *
     * @example
     * ```ts
     * findTokenEnd(0); // 2 for s === 'ab cd'
     * ```
     */
    function findTokenEnd(end: number,): number {
      if (end >= s.length)
        return end;
      if (isWhitespaceChar(s.charAt(end,),))
        return end;
      return findTokenEnd(end + 1,);
    }
    /** Exclusive end of the token that begins at `idx`. */
    const tokenEnd = findTokenEnd(idx + 1,);
    return walk({
      idx: tokenEnd,
      acc: [
        ...acc,
        s.slice(
          idx,
          tokenEnd,
        ),
      ],
    },);
  }
  return walk({
    idx: 0,
    acc: [],
  },);
}

/**
 * Parses a single row of `virsh list --all` output into structured fields.
 *
 * Mirrors the original `/\s+(?:\d+|-)\s+(\S+)\s+(.+)/` shape: rows have
 * leading whitespace, an id column (digits or `-`), a name column
 * (non-whitespace), then a state column (one or more whitespace-separated
 * tokens). Returns `undefined` for header rows, separator rows, and any
 * non-data row.
 *
 * @param line - single line of virsh tabular output
 *
 * @returns parsed row or `undefined` when `line` is not a data row
 *
 * @example
 * ```ts
 * parseVirshRow(' 1    mvm-foo    running');  // { name: 'mvm-foo', state: 'running' }
 * parseVirshRow(' -    mvm-bar    shut off'); // { name: 'mvm-bar', state: 'shut off' }
 * parseVirshRow(' Id   Name   State');        // undefined (header)
 * ```
 */
function parseVirshRow(
  line: string,
): {
  name: string;
  state: string;
} | undefined {
  /**
   * Minimum token count for a data row: id, name, and at least one state token.
   * Header (`Id Name State`) and separator (`---`) rows produce fewer or
   * differently-shaped tokens.
   */
  const MIN_DATA_ROW_TOKENS = 3;
  /** Whitespace-separated tokens of `line`. */
  const tokens = splitOnWhitespace(line,);
  if (tokens.length < MIN_DATA_ROW_TOKENS)
    return undefined;
  /** Id column; data rows have digits or a literal `-`. */
  const [idToken, vmName, ...stateTokens] = tokens;
  if ((idToken === undefined) || (vmName === undefined))
    return undefined;
  if ((idToken !== '-') && (!isDigitString(idToken,)))
    return undefined;
  return {
    name: vmName,
    state: stateTokens.join(' ',),
  };
}

/**
 * Queries libvirt for all managed VMs and returns structured info.
 * Parses `virsh list --all` output and filters for VMs with the `mvm-` prefix.
 *
 * @returns Array of VM entries with name (without prefix) and state
 *
 * @example
 * ```ts
 * const vms = await list();
 * // [{ name: 'dev-01', state: 'running' }, { name: 'dev-02', state: 'shut off' }]
 * ```
 */
export async function list(): Promise<readonly VmInfo[]> {
  /** Logger scoped to this call so debug output is attributable. */
  const rl = tagged({
    tag: list.name,
    l,
  },);
  rl.debug('querying virsh for all VMs',);

  /** Raw multi-line output from `virsh list --all`; parsed line by line below. */
  const output = await virsh({ args: [
    'list',
    '--all',
  ], },);
  /** Each row of the virsh table, including the header and separator rows the parser below filters out. */
  const lines = output.split('\n',);

  /** Accumulator for prefixed VMs found in the virsh table; returned as the result. */
  const vms: VmInfo[] = [];

  for (const line of lines) {
    /** Parsed row fields, or `undefined` for non-data rows. */
    const row = parseVirshRow(line,);
    /** Captured VM name from the parser; may be undefined when the line is not a data row. */
    const vmName = row?.name;
    /** Captured state column from the parser; trimmed when emitted because it carries trailing spaces. */
    const vmState = row?.state;
    if ((vmName !== undefined)
      && (vmState !== undefined)
      && vmName.startsWith(VM_PREFIX,))
    {
      vms.push({
        name: vmName.slice(VM_PREFIX.length,),
        state: vmState.trim(),
      },);
    }
  }

  rl.debug(`found ${String(vms.length,)} managed VMs`,);
  return vms;
}

/**
 * Command validation predicates for the Bash output filter hook.
 *
 * Provides allowlist and denylist checks that determine whether a Bash command
 * should be piped through the output filter. Implemented as named predicate
 * functions rather than regex arrays so each check stays inspectable and
 * stays out of the `no-restricted-syntax/no-regex` rule.
 *
 * @module
 */

import {
  containsAnyOfWordBounded,
  containsWordBoundedPhrase,
  isAlphaNum,
  isWhitespace,
  splitWhitespace,
} from '../../lib/text-scan.ts';

//region Allowlist

/** Non-alphanumeric characters that are still safe as a command's leading char. */
const ALLOW_LEADING_PUNCT = '_/.~"\'-';

/**
 * Whether `cmd` starts with an allowlisted leading character: alphanumeric,
 * underscore, slash, dot, tilde, quote, or hyphen. Mirrors the original
 * regex `/^[a-zA-Z0-9_/.~"'-]/`.
 *
 * @param cmd - full Bash command string
 *
 * @returns whether the leading char is allowlisted
 *
 * @example
 * ```ts
 * startsWithSafeChar('git status'); // true
 * startsWithSafeChar('!history');   // false
 * ```
 */
function startsWithSafeChar(cmd: string,): boolean {
  if (cmd.length === 0)
    return false;
  /** Leading char to test against the allow-list set. */
  const c = cmd.charAt(0,);
  return isAlphaNum(c,) || ALLOW_LEADING_PUNCT.includes(c,);
}

/** Predicates a command must satisfy at least one of to be allowed through the filter. */
const ALLOW_PREDICATES: readonly ((cmd: string,) => boolean)[] = [
  startsWithSafeChar,
];

/**
 * Whether a command looks like a normal text command that is safe to pipe.
 *
 * @param command - full Bash command string from the tool input
 *
 * @returns `true` if the command matches any allowlist predicate
 *
 * @example
 * ```ts
 * isAllowed('git status'); // true
 * isAllowed('!special'); // false
 * ```
 */
function isAllowed(command: string,): boolean {
  return ALLOW_PREDICATES.some(function predicateTest(predicate,) {
    return predicate(command,);
  },);
}

//endregion

//region Denylist predicates

/** Binary-handling tools whose output would be mangled by the filter pipeline. */
const BINARY_TOOL_NAMES: readonly string[] = [
  'xxd',
  'hexdump',
  'od',
  'base64',
  'tar',
  'gzip',
  'gunzip',
  'zip',
  'unzip',
  'bzip2',
  'xz',
  'zstd',
];

/**
 * Whether `cmd` invokes a binary-handling tool whose output should not be
 * piped through the filter. Mirrors `\b(xxd|hexdump|...)\b`.
 *
 * @param cmd - full Bash command string
 *
 * @returns whether a binary tool is invoked
 *
 * @example
 * ```ts
 * hasBinaryTool('xxd file.bin'); // true
 * hasBinaryTool('git status');   // false
 * ```
 */
function hasBinaryTool(cmd: string,): boolean {
  return containsAnyOfWordBounded({
    haystack: cmd,
    phrases: BINARY_TOOL_NAMES,
  },) !== undefined;
}

/**
 * Whether `cmd` contains a file redirect (`> foo`, `>foo`, `2> foo`) but not
 * descriptor redirects like `2>&1`. Mirrors the original `>\s*[^\s|&;]`.
 *
 * @param cmd - full Bash command string
 *
 * @returns whether a file redirect is present
 *
 * @example
 * ```ts
 * hasFileRedirect('cat > out.txt'); // true
 * hasFileRedirect('cmd 2>&1');      // false
 * ```
 */
function hasFileRedirect(cmd: string,): boolean {
  // Walk each `>` in order (monotonic `indexOf`, no rescan of earlier text).
  // For each, skip optional whitespace and test the next char; a redirect to a
  // real target (not `|`, `&`, `;`, or whitespace) marks a file redirect.
  for (
    let gtIdx = cmd.indexOf(
      '>',
      0,
    );
    gtIdx !== (-1);
    gtIdx = cmd.indexOf(
      '>',
      gtIdx + 1,
    )
  ) {
    /** Position of the candidate destination char, advanced past whitespace after `>`. */
    let afterWs = gtIdx + 1;
    while ((afterWs < cmd.length) && isWhitespace(cmd.charAt(afterWs,),)) {
      afterWs += 1;
    }
    if (afterWs < cmd.length) {
      /** Char immediately following the optional whitespace; classified below. */
      const next = cmd.charAt(afterWs,);
      if ((next !== '|') && (next !== '&') && (next !== ';') && (!isWhitespace(next,)))
        return true;
    }
  }
  return false;
}

/**
 * Whether `cmd` invokes the bash-output-filter helper script itself. Used to
 * avoid recursively piping the filter through itself. Mirrors
 * `\bfilter\.(mjs|ts)\b`.
 *
 * @param cmd - full Bash command string
 *
 * @returns whether `filter.mjs` or `filter.ts` is invoked
 *
 * @example
 * ```ts
 * invokesFilterScript('bun ./filter.mjs'); // true
 * invokesFilterScript('bun ./other.ts');   // false
 * ```
 */
function invokesFilterScript(cmd: string,): boolean {
  return containsWordBoundedPhrase({
    haystack: cmd,
    phrase: 'filter.mjs',
  },) || containsWordBoundedPhrase({
    haystack: cmd,
    phrase: 'filter.ts',
  },);
}

/** Marker emitted by the filter to indicate end-of-filter execution. */
const BOF_MARKER = '___BOF_EC:';

/**
 * Whether `cmd` carries the end-of-filter marker. Mirrors `___BOF_EC:`.
 *
 * @param cmd - full Bash command string
 *
 * @returns whether the marker is present
 *
 * @example
 * ```ts
 * hasBofMarker('echo ___BOF_EC:0'); // true
 * ```
 */
function hasBofMarker(cmd: string,): boolean {
  return cmd.includes(BOF_MARKER,);
}

/**
 * Whether `cmd` ends with `&` (with optional trailing whitespace), marking it
 * as a background command. Mirrors `&\s*$`.
 *
 * @param cmd - full Bash command string
 *
 * @returns whether the command ends with a background op
 *
 * @example
 * ```ts
 * endsWithBackgroundOp('npm start &'); // true
 * endsWithBackgroundOp('cmd && cmd2'); // false
 * ```
 */
function endsWithBackgroundOp(cmd: string,): boolean {
  return cmd.trimEnd().endsWith('&',);
}

/** Detachment wrapper utilities that take their child off the controlling terminal. */
const DETACH_WRAPPER_NAMES: readonly string[] = [
  'nohup',
  'setsid',
];

/**
 * Whether `cmd` runs `nohup` or `setsid`. Mirrors `\b(nohup|setsid)\b`.
 *
 * @param cmd - full Bash command string
 *
 * @returns whether a detachment wrapper is present
 *
 * @example
 * ```ts
 * hasDetachWrapper('nohup ./long-running &'); // true
 * ```
 */
function hasDetachWrapper(cmd: string,): boolean {
  return containsAnyOfWordBounded({
    haystack: cmd,
    phrases: DETACH_WRAPPER_NAMES,
  },) !== undefined;
}

/** Container runtimes whose `exec`/`run` subcommands may attach a TTY. */
const CONTAINER_RUNTIMES: ReadonlySet<string> = new Set([
  'docker',
  'podman',
],);

/** Container subcommands that accept TTY flags. */
const CONTAINER_TTY_SUBCOMMANDS: ReadonlySet<string> = new Set([
  'exec',
  'run',
],);

/**
 * Whether `token` is a CLI flag of the form `-[a-z]*[it]`: starts with `-`,
 * any number of lowercase letters, ending in `i` or `t`. Examples: `-i`,
 * `-t`, `-it`, `-ti`, `-rmit`, `-rmt`.
 *
 * @param token - whitespace-separated token from a command
 *
 * @returns whether `token` is a TTY-style flag
 *
 * @example
 * ```ts
 * isTtyFlag('-it'); // true
 * isTtyFlag('--it'); // false (extra leading dash makes body start with '-')
 * isTtyFlag('-Q'); // false (uppercase)
 * ```
 */
function isTtyFlag(token: string,): boolean {
  /** Minimum length: leading dash plus at least one body character. */
  const MIN_FLAG_LENGTH = 2;
  if ((!token.startsWith('-',)) || (token.length < MIN_FLAG_LENGTH))
    return false;
  /** Body after the leading dash; all chars must be lowercase letters. */
  const body = token.slice(1,);
  for (const c of body) {
    if ((c < 'a') || (c > 'z'))
      return false;
  }
  /** Final char of the body must be `i` or `t`. */
  const last = body.at(-1,) ?? '';
  return (last === 'i') || (last === 't');
}

/**
 * Whether `cmd` invokes a container runtime (`docker` / `podman`) with an
 * `exec` / `run` subcommand and a later TTY flag. Mirrors
 * `\b(docker|podman)\s+(exec|run)\b.*-[a-z]*[it]`. Tokenises the command;
 * does not match container invocations buried inside punctuation like
 * `(docker exec ...)` because shells rarely produce that shape.
 *
 * @param cmd - full Bash command string
 *
 * @returns whether a TTY-attached container invocation is present
 *
 * @example
 * ```ts
 * hasTtyContainerInvoke('docker exec -it ctr sh'); // true
 * hasTtyContainerInvoke('docker pull ubuntu');     // false
 * ```
 */
function hasTtyContainerInvoke(cmd: string,): boolean {
  /** Whitespace-separated tokens of the command. */
  const tokens = splitWhitespace(cmd,);
  // Scan adjacent token pairs for `(runtime, subcommand)`; on a hit, look for a
  // later TTY flag among the remaining tokens.
  for (let idx = 0; (idx + 1) < tokens.length; idx += 1) {
    /** Candidate container runtime token. */
    const runtime = tokens[idx] ?? '';
    /** Candidate subcommand token immediately following the runtime. */
    const sub = tokens[idx + 1] ?? '';
    if (CONTAINER_RUNTIMES.has(runtime,) && CONTAINER_TTY_SUBCOMMANDS.has(sub,)) {
      for (const t of tokens.slice(idx + 2,)) {
        if (isTtyFlag(t,))
          return true;
      }
    }
  }
  return false;
}

/**
 * Whether `cmd` invokes `bun build`. Mirrors `\bbun\s+build\b` using a
 * token walk so any whitespace between `bun` and `build` is normalised.
 *
 * @param cmd - full Bash command string
 *
 * @returns whether `bun build` is invoked as adjacent tokens
 *
 * @example
 * ```ts
 * hasBunBuild('bun build --watch'); // true
 * hasBunBuild('bun run build');     // false
 * ```
 */
function hasBunBuild(cmd: string,): boolean {
  /** Whitespace-separated tokens of the command. */
  const tokens = splitWhitespace(cmd,);
  // Scan adjacent token pairs for `bun` immediately followed by `build`.
  for (let idx = 0; (idx + 1) < tokens.length; idx += 1) {
    if ((tokens[idx] === 'bun') && (tokens[idx + 1] === 'build'))
      return true;
  }
  return false;
}

/**
 * Whether `cmd` uses command-substitution syntax `$(...)`. Mirrors `\$\(`.
 *
 * @param cmd - full Bash command string
 *
 * @returns whether `$(` appears in `cmd`
 *
 * @example
 * ```ts
 * hasDollarParen('echo $(date)'); // true
 * ```
 */
function hasDollarParen(cmd: string,): boolean {
  return cmd.includes('$(',);
}

/**
 * Whether `cmd` contains a balanced backtick command-substitution pair with
 * at least one non-backtick character inside. Mirrors the legacy regex
 * matching one backtick, one or more non-backtick characters, then another
 * backtick.
 *
 * @param cmd - full Bash command string
 *
 * @returns whether a backtick-bounded substitution is present
 *
 * @example
 * ```ts
 * hasBacktickPair('echo `date`'); // true
 * hasBacktickPair('a `` b');      // false (empty content)
 * ```
 */
function hasBacktickPair(cmd: string,): boolean {
  /** Index of the opening backtick, or `-1` when absent. */
  const first = cmd.indexOf('`',);
  if (first === (-1))
    return false;
  /** Index of the closing backtick, or `-1` when unmatched. */
  const second = cmd.indexOf(
    '`',
    first + 1,
  );
  if (second === (-1))
    return false;
  return second > (first + 1);
}

/**
 * Whether `cmd` uses process-substitution syntax `<(...)` or `>(...)`.
 * Mirrors `[<>]\(`.
 *
 * @param cmd - full Bash command string
 *
 * @returns whether process substitution appears in `cmd`
 *
 * @example
 * ```ts
 * hasProcessSubstitution('diff <(a) <(b)'); // true
 * ```
 */
function hasProcessSubstitution(cmd: string,): boolean {
  return cmd.includes('<(',) || cmd.includes('>(',);
}

/**
 * Whether `cmd` opens a heredoc (`<<EOF`, `<<-EOF`, `<<<word`). Mirrors
 * `<<[<-]?\s*\S`.
 *
 * @param cmd - full Bash command string
 *
 * @returns whether a heredoc opener appears
 *
 * @example
 * ```ts
 * hasHeredoc('cat <<EOF');   // true
 * hasHeredoc('cat <<<word'); // true
 * hasHeredoc('cat << ');     // false (no body)
 * ```
 */
function hasHeredoc(cmd: string,): boolean {
  /** Length of the base `<<` opener; characters consumed before any variant marker. */
  const OPENER_LENGTH = '<<'.length;
  // Walk each `<<` opener in order; skip an optional `<`/`-` variant marker and
  // any whitespace, then require a non-whitespace body char.
  for (
    let idx = cmd.indexOf(
      '<<',
      0,
    );
    idx !== (-1);
    idx = cmd.indexOf(
      '<<',
      idx + 1,
    )
  ) {
    /** Char after the `<<`; may indicate `<<<` or `<<-` variants. */
    const afterOpener = cmd.charAt(idx + OPENER_LENGTH,);
    /** Cursor past the optional variant marker. */
    const afterMarker = ((afterOpener === '<') || (afterOpener === '-'))
      ? (idx + OPENER_LENGTH + 1)
      : (idx + OPENER_LENGTH);
    /** Position of the candidate body char, advanced past whitespace after the marker. */
    let afterWs = afterMarker;
    while ((afterWs < cmd.length) && isWhitespace(cmd.charAt(afterWs,),)) {
      afterWs += 1;
    }
    if ((afterWs < cmd.length) && (!isWhitespace(cmd.charAt(afterWs,),)))
      return true;
  }
  return false;
}

/** Shell built-ins that change shell state in ways the filter cannot follow. */
const STATE_BUILTIN_NAMES: readonly string[] = [
  'cd',
  'pushd',
  'popd',
  'export',
  'unset',
  'source',
];

/**
 * Whether `cmd` invokes a state-changing shell built-in. Mirrors
 * `\b(cd|pushd|popd|export|unset|source)\b`.
 *
 * @param cmd - full Bash command string
 *
 * @returns whether a state-changing built-in appears
 *
 * @example
 * ```ts
 * hasStateBuiltin('cd /tmp');       // true
 * hasStateBuiltin('mkdir foo');     // false
 * ```
 */
function hasStateBuiltin(cmd: string,): boolean {
  return containsAnyOfWordBounded({
    haystack: cmd,
    phrases: STATE_BUILTIN_NAMES,
  },) !== undefined;
}

/**
 * Whether `cmd` is the dot-source shorthand `. file`. Mirrors `^\.\s`.
 *
 * @param cmd - full Bash command string
 *
 * @returns whether the command starts with `. ` (dot + whitespace)
 *
 * @example
 * ```ts
 * isSourceShorthand('. ./env.sh'); // true
 * isSourceShorthand('./run.sh');   // false
 * ```
 */
function isSourceShorthand(cmd: string,): boolean {
  /** Minimum length: dot plus whitespace. */
  const MIN_LENGTH = 2;
  return (cmd.length >= MIN_LENGTH)
    && cmd.startsWith('.',)
    && isWhitespace(cmd.charAt(1,),);
}

/**
 * Whether `cmd` invokes `eval`. Mirrors `\beval\b`.
 *
 * @param cmd - full Bash command string
 *
 * @returns whether `eval` is invoked
 *
 * @example
 * ```ts
 * hasEval('eval "$cmd"');  // true
 * hasEval('evaluate');     // false (word boundary excludes embedded matches)
 * ```
 */
function hasEval(cmd: string,): boolean {
  return containsWordBoundedPhrase({
    haystack: cmd,
    phrase: 'eval',
  },);
}

/** Predicates whose match marks the command as unsafe to pipe through the filter. */
const SKIP_PREDICATES: readonly ((cmd: string,) => boolean)[] = [
  hasBinaryTool,
  hasFileRedirect,
  invokesFilterScript,
  hasBofMarker,
  endsWithBackgroundOp,
  hasDetachWrapper,
  hasTtyContainerInvoke,
  hasBunBuild,
  hasDollarParen,
  hasBacktickPair,
  hasProcessSubstitution,
  hasHeredoc,
  hasStateBuiltin,
  isSourceShorthand,
  hasEval,
];

/**
 * Whether a command should be skipped (not piped through the filter).
 *
 * @param command - full Bash command string from the tool input
 *
 * @returns `true` if the command matches any denylist predicate
 *
 * @example
 * ```ts
 * shouldSkip('xxd file.bin'); // true (binary tool denylisted)
 * shouldSkip('git status'); // false
 * ```
 */
function shouldSkip(command: string,): boolean {
  return SKIP_PREDICATES.some(function predicateTest(predicate,) {
    return predicate(command,);
  },);
}

//endregion

export {
  isAllowed,
  shouldSkip,
};

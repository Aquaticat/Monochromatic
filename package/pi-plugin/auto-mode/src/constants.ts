/**
 * Constants shared across the auto-mode package.
 *
 * - Command sets and patterns used by the flagger
 *   (privilege, mutating, network, env-dump, interpreter, etc.)
 * - Context-builder limits used by `context.ts`
 *   (recent visible-message floor)
 *
 * @module
 */

//region Judge timeout

/**
 * Maximum duration of one complete judge attempt.
 *
 * @example
 * ```typescript
 * callJudge({ timeoutMs: JUDGE_TIMEOUT_MS, });
 * ```
 */
export const JUDGE_TIMEOUT_MS = 10_000;

//endregion

//region Context builder limits

/**
 * Minimum newest visible messages included in judge context when history exists.
 *
 * @example
 * ```typescript
 * const floor = CONTEXT_MESSAGE_FLOOR;
 * ```
 */
export const CONTEXT_MESSAGE_FLOOR = 5;

//endregion

//region Agent temp directories

/**
 * Historical agent-owned temp root retained for compatibility.
 *
 * Current scratch work uses `~/temp/agent`.
 *
 * @example
 * ```typescript
 * const historicalRoot = HISTORICAL_AGENT_TEMP_DIR;
 * ```
 */
export const HISTORICAL_AGENT_TEMP_DIR = '/tmp/agent';

//endregion

//region Privilege commands

/**
 * Commands that escalate privileges.
 */
export const PRIVILEGE_COMMANDS = new Set([
  'sudo',
  'su',
  'doas',
  'pkexec',
] as const,) as Set<string>;

//endregion

//region Mutating commands

/**
 * Commands that mutate the filesystem.
 */
export const MUTATING_COMMANDS = new Set([
  'rm',
  'chmod',
  'chown',
  'chgrp',
  'find',
  'xargs',
] as const,) as Set<string>;

//endregion

//region Network commands

/**
 * Commands that make network connections.
 */
export const NETWORK_COMMANDS = new Set([
  'curl',
  'wget',
  'nc',
  'ncat',
  'netcat',
  'ssh',
  'scp',
  'rsync',
  'ftp',
  'sftp',
] as const,) as Set<string>;

//endregion

//region Environment dump commands

/**
 * Commands that dump environment variables.
 */
export const ENV_DUMP_COMMANDS = new Set([
  'printenv',
  'env',
  'set',
] as const,) as Set<string>;

//endregion

//region Interpreter commands

/**
 * Interpreter commands that can execute inline code.
 */
export const INTERPRETER_COMMANDS = new Set([
  'eval',
  'bash',
  'sh',
  'zsh',
  'fish',
  'python',
  'python3',
  'node',
  'ruby',
  'perl',
] as const,) as Set<string>;

//endregion

//region Interpreter inline flags

/**
 * Flag arguments that cause interpreters to execute inline code.
 */
export const INTERPRETER_INLINE_FLAGS: Record<string, string[]> = {
  eval: [],
  bash: [
    '-c',
  ],
  sh: [
    '-c',
  ],
  zsh: [
    '-c',
  ],
  fish: [
    '-c',
  ],
  python: [
    '-c',
  ],
  python3: [
    '-c',
  ],
  node: [
    '-e',
    '--eval',
  ],
  ruby: [
    '-e',
  ],
  perl: [
    '-e',
  ],
};

//endregion

//region Long flags mapping

/**
 * Mapping from short flag characters to their long flag names.
 */
export const LONG_FLAGS: Record<string, string> = {
  r: 'recursive',
  R: 'recursive',
  f: 'force',
};

//endregion

/* oxlint-disable no-restricted-syntax/no-regex -- this module defines auto-mode's secret-detection patterns; the regex literals ARE the rule set. Each pattern is anchored to a known credential format (length-bounded character classes) or surrounded by anchor-like boundaries, so no nested quantifiers and no backtracking risk. Input is bounded by the surrounding scanner. */

//region Content signal patterns

/**
 * Pattern matching private key PEM headers.
 */
export const PRIVATE_KEY_PATTERN: RegExp = /-----BEGIN\s[\w\s]*PRIVATE\sKEY-----/u;

/**
 * Patterns matching known secret formats (tokens, keys).
 */
export const SECRET_FORMAT_PATTERNS: readonly RegExp[] = [
  /ghp_[A-Za-z0-9_]{36,}/u,
  /gho_[A-Za-z0-9_]{36,}/u,
  /ghs_[A-Za-z0-9_]{36,}/u,
  /github_pat_[A-Za-z0-9_]{22,}/u,
  /sk-[A-Za-z0-9]{20,}/u,
  /sk-proj-[A-Za-z0-9-_]{20,}/u,
  /AKIA[0-9A-Z]{16}/u,
  /xoxb-[0-9]+-[A-Za-z0-9]+/u,
  /xoxp-[0-9]+-[A-Za-z0-9]+/u,
  /xoxs-[0-9]+-[A-Za-z0-9]+/u,
] as const;

//endregion

//region Text signal patterns

/**
 * Built-in text patterns that always trigger flagging.
 */
export const BUILTIN_TEXT_PATTERNS: readonly RegExp[] = [
  /\bsudo\b/u,
  /\bauto-mode\b/u,
  /\bsafeguard\b/u,
] as const;

//endregion

//region Secret variable pattern

/**
 * Variable names that look like secrets.
 *
 * `AUTH` requires underscore/start/end boundaries to avoid
 * matching `AUTHOR`, `AUTHORIZE`.
 */
export const SECRET_VAR_PATTERN: RegExp =
  /(?:SECRET|TOKEN|PASSWORD|PASSWD|PASSPHRASE|CREDENTIAL|API[_.]?KEY|PRIVATE[_.]?KEY|(?:^|_)AUTH(?:_|$))/iu;

//endregion

//region Secret path pattern

/**
 * Pattern matching secret-related keywords in file paths.
 */
export const SECRET_PATH_PATTERN: RegExp =
  /(?:^|[/\\._-])(?:secret|credential|password|passwd|token|private[._-]?key|\.env(?:\.|$)|\.dev\.vars(?:$|[/\\])|id_rsa|id_ed25519|id_ecdsa|authorized_keys|known_hosts)|\.(?:pem|key)$/iu;

//endregion

/* oxlint-enable no-restricted-syntax/no-regex */

//region Relevant tools

/**
 * Tools that could be used for circumvention after a denial.
 */
export const RELEVANT_TOOLS: readonly string[] = [
  'bash',
  'read',
  'write',
  'edit',
  'grep',
  'find',
  'ls',
] as const;

//endregion

/**
 * Constants shared across the auto-mode package.
 *
 * - Command sets and patterns used by the flagger
 *   (privilege, mutating, network, env-dump, interpreter, etc.)
 * - Context-builder limits used by `context.ts`
 *   (max tools, user-message truncation lengths, bash detail length)
 *
 * @module
 */

//region Judge-model defaults

/**
 * Default judge-model selection used when no global config is set
 * and when `findBudgetModel` is called with no options.
 *
 * Single source of truth: referenced by `loadMergedConfig` (for the
 * config-file fallback), by `GLOBAL_DEFAULTS` (for the global
 * defaults), and by `findBudgetModel` (for the no-options call).
 */
export const JUDGE_MODEL_DEFAULTS = {
  strategy: 'same-provider',
  costRatio: 0.5,
  majorVersions: 1,
} as const;

//endregion

//region Context builder limits

/** Maximum number of tool calls included in judge context. */
export const MAX_CONTEXT_TOOLS = 8;

/** Maximum length of user message text in judge context. */
export const USER_MSG_MAX = 300;

/** Head portion of truncated user messages. */
export const USER_MSG_HEAD = 150;

/** Tail portion of truncated user messages. */
export const USER_MSG_TAIL = 100;

/** Maximum length of bash detail in context. */
export const BASH_DETAIL_LEN = 50;

//endregion

//region Privilege commands

/** Commands that escalate privileges. */
export const PRIVILEGE_COMMANDS = new Set([
  'sudo',
  'su',
  'doas',
  'pkexec',
] as const,) as Set<string>;

//endregion

//region Mutating commands

/** Commands that mutate the filesystem. */
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

/** Commands that make network connections. */
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

/** Commands that dump environment variables. */
export const ENV_DUMP_COMMANDS = new Set([
  'printenv',
  'env',
  'set',
] as const,) as Set<string>;

//endregion

//region Interpreter commands

/** Interpreter commands that can execute inline code. */
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

/** Flag arguments that cause interpreters to execute inline code. */
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

/** Mapping from short flag characters to their long flag names. */
export const LONG_FLAGS: Record<string, string> = {
  r: 'recursive',
  R: 'recursive',
  f: 'force',
};

//endregion

//region Content signal patterns

/** Pattern matching private key PEM headers. */
export const PRIVATE_KEY_PATTERN: RegExp = /-----BEGIN\s[\w\s]*PRIVATE\sKEY-----/;

/** Patterns matching known secret formats (tokens, keys). */
export const SECRET_FORMAT_PATTERNS: readonly RegExp[] = [
  /ghp_[A-Za-z0-9_]{36,}/,
  /gho_[A-Za-z0-9_]{36,}/,
  /ghs_[A-Za-z0-9_]{36,}/,
  /github_pat_[A-Za-z0-9_]{22,}/,
  /sk-[A-Za-z0-9]{20,}/,
  /sk-proj-[A-Za-z0-9-_]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /xoxb-[0-9]+-[A-Za-z0-9]+/,
  /xoxp-[0-9]+-[A-Za-z0-9]+/,
  /xoxs-[0-9]+-[A-Za-z0-9]+/,
] as const;

//endregion

//region Text signal patterns

/** Built-in text patterns that always trigger flagging. */
export const BUILTIN_TEXT_PATTERNS: readonly RegExp[] = [
  /\bsudo\b/,
  /\bauto-mode\b/,
  /\bsafeguard\b/,
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
  /(?:SECRET|TOKEN|PASSWORD|PASSWD|PASSPHRASE|CREDENTIAL|API[_.]?KEY|PRIVATE[_.]?KEY|(?:^|_)AUTH(?:_|$))/i;

//endregion

//region Secret path pattern

/** Pattern matching secret-related keywords in file paths. */
export const SECRET_PATH_PATTERN: RegExp =
  /(?:^|[/\\._-])(?:secret|credential|password|passwd|token|private[._-]?key|\.env(?:\.|$)|\.dev\.vars(?:$|[/\\])|id_rsa|id_ed25519|id_ecdsa|authorized_keys|known_hosts)|\.(?:pem|key)$/i;

//endregion

//region Relevant tools

/** Tools that could be used for circumvention after a denial. */
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

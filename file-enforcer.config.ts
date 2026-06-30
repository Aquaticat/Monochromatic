import {
  glob,
  lstat,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  addWatchedPaths,
  cat,
  manageLsp4ijServerSettings,
  overwrite,
  overwriteEach,
  overwriteIfNotExists,
} from '@monochromatic-dev/dev-script-file-enforcer/ts';

import type browserslist from 'browserslist';

/**
 * Root-level context summary path that must remain absent. The repo relies on
 * source reads plus docs/agents/domain.md instead of cached context files.
 *
 * @example
 * ```ts
 * console.log(FORBIDDEN_ROOT_CONTEXT_PATH);
 * ```
 */
const FORBIDDEN_ROOT_CONTEXT_PATH = './CONTEXT.md';

/**
 * Checked-in Browserslist policy file read directly by file-enforcer.
 *
 * @example
 * ```ts
 * console.log(BROWSERSLIST_CONFIG_PATH);
 * ```
 */
const BROWSERSLIST_CONFIG_PATH = './.browserslistrc';

/**
 * Deterministic Browserslist environment section used when the config declares
 * environment-specific blocks. Keeping this fixed prevents ambient shell env
 * from changing generated files.
 *
 * @example
 * ```ts
 * console.log(BROWSERSLIST_CONFIG_ENVIRONMENT);
 * ```
 */
const BROWSERSLIST_CONFIG_ENVIRONMENT = 'production';

/**
 * Explicit empty custom-usage statistics passed to Browserslist so it never
 * searches ancestor directories for `browserslist-stats.json`.
 *
 * @example
 * ```ts
 * console.log(Object.keys(EMPTY_BROWSERSLIST_STATS));
 * ```
 */
const EMPTY_BROWSERSLIST_STATS: browserslist.Stats = {};

/**
 * Node filesystem error code for an absent path.
 *
 * @example
 * ```ts
 * console.log(ABSENT_PATH_ERROR_CODE);
 * ```
 */
const ABSENT_PATH_ERROR_CODE = 'ENOENT';

/**
 * Error object shape used by Node filesystem APIs when a system code is present.
 *
 * @example
 * ```ts
 * const codedError = error as NodeErrorCodeCarrier;
 * ```
 */
type NodeErrorCodeCarrier = Error & {
  readonly code?: unknown;
};

/**
 * Signals that root CONTEXT.md exists even though cached context files are forbidden.
 *
 * @example
 * ```ts
 * throw new ForbiddenRootContextFileError({ filePath: './CONTEXT.md' });
 * ```
 */
class ForbiddenRootContextFileError extends Error {
  /**
   * Builds a failure with guidance toward source-driven context.
   *
   * @param filePath - forbidden root context path that was present.
   *
   * @example
   * ```ts
   * new ForbiddenRootContextFileError({ filePath: './CONTEXT.md' });
   * ```
   */
  public constructor({ filePath, }: { readonly filePath: string; }) {
    super([
      `${filePath} is forbidden.`,
      'Do not create cached context files;',
      'read source code directly and use docs/agents/domain.md for this repo policy.',
    ].join(' ',),);
    this.name = ForbiddenRootContextFileError.name;
  }
}

/**
 * Returns whether an unknown filesystem error carries the expected Node error code,
 * narrowing through {@link NodeErrorCodeCarrier}.
 *
 * @param error - unknown error from a filesystem operation.
 *
 * @param code - Node error code that should be treated as expected.
 *
 * @returns Whether error carries code.
 *
 * @example
 * ```ts
 * const absent = errorHasCode({ error, code: ABSENT_PATH_ERROR_CODE });
 * ```
 */
function errorHasCode(
  {
    error,
    code,
  }: {
    readonly error: unknown;
    readonly code: string;
  },
): boolean {
  return (error instanceof Error)
    && ('code' in error)
    && ((error as NodeErrorCodeCarrier).code === code);
}

/**
 * Registers root CONTEXT.md with watch mode and rejects it before generated writes,
 * using {@link errorHasCode} to tell an absent path from a real stat failure and
 * throwing {@link ForbiddenRootContextFileError} when the file is present.
 *
 * @example
 * ```ts
 * await assertForbiddenRootContextAbsent();
 * ```
 */
async function assertForbiddenRootContextAbsent(): Promise<void> {
  addWatchedPaths([FORBIDDEN_ROOT_CONTEXT_PATH,],);
  try {
    await lstat(FORBIDDEN_ROOT_CONTEXT_PATH,);
  }
  catch (statError: unknown) {
    if (errorHasCode({
      error: statError,
      code: ABSENT_PATH_ERROR_CODE,
    },))
      return;

    throw statError;
  }

  throw new ForbiddenRootContextFileError({
    filePath: FORBIDDEN_ROOT_CONTEXT_PATH,
  },);
}

/**
 * Resolver function exported by the `browserslist` package.
 *
 * @example
 * ```ts
 * const resolveBrowserslist = await importBrowserslist();
 * ```
 */
type BrowserslistResolver = typeof browserslist;

/**
 * Imports Browserslist at runtime so generators use the installed package data.
 *
 * @returns {@link BrowserslistResolver} from dynamic package import.
 *
 * @example
 * ```ts
 * const resolveBrowserslist = await importBrowserslist();
 * ```
 */
async function importBrowserslist(): Promise<BrowserslistResolver> {
  /**
   * CommonJS package namespace exposed through ESM dynamic import.
   */
  const browserslistModule = await import('browserslist') as {
    readonly default: BrowserslistResolver;
  };

  return browserslistModule.default;
}

/**
 * Selects query lines from parsed Browserslist config without letting
 * Browserslist search the filesystem for config files.
 *
 * @param config - parsed checked-in Browserslist config.
 *
 * @returns Production section when present, otherwise default query lines.
 *
 * @example
 * ```ts
 * const queries = selectBrowserslistQueries({
 *   config: { defaults: ['last 1 Chrome version'] },
 * });
 * ```
 */
function selectBrowserslistQueries(
  { config, }: { readonly config: browserslist.Config; },
): readonly string[] {
  return config[BROWSERSLIST_CONFIG_ENVIRONMENT]
    ?? config.defaults;
}

/**
 * Generates mise.toml from mise.no-env.toml with a dynamic [env] section
 * containing _.path entries for all workspace package bin directories.
 */
async function generateMiseToml(): Promise<void> {
  /**
   * Dynamic [env] block appended after the static mise.no-env.toml content; wires PATH to every workspace bin dir.
   */
  const envSection = `[env]
# .env file is optional - mise silently ignores missing files
# https://github.com/jdx/mise/blob/main/src/config/env_directive/file.rs#L155-L163
_.file = [{ path = ".env", redact = true }, { path = ".env.local", redact = true }]
_.path = [
${
    [
      'node_modules/.bin',
      ...(await Array.fromAsync(glob('packages/*/*/node_modules/.bin',),)),
    ]
      .map(function quote(dir,): string {
        return `  "${dir}"`;
      },)
      .join(',\n',)
  },
]

# Enables Slint's experimental builtins (e.g. FlexboxLayout) in slint-lsp when it
# is launched through mise (e.g. the JetBrains plugin's external LSP set to run
# "mise exec -- slint-lsp"). slint-lsp exposes no CLI flag for this; the compiler
# reads this env var at runtime (internal/compiler/lib.rs) and the LSP relies on
# that path (tools/lsp/main.rs). The two desktop-app packages already set it for
# their builds; setting it at the repo root also covers the editor LSP whose cwd
# is the monorepo root. mise [env] is directory-activated, so it only reaches the
# LSP process when mise launches it.
SLINT_ENABLE_EXPERIMENTAL_FEATURES = "1"
`;
  await overwrite({
    dest: './mise.toml',
    content: `# Generated from mise.no-env.toml by file-enforcer.
${await cat(['./mise.no-env.toml',],)}
${envSection}`,
  },);
}

/**
 * Generates `forbidden-strings.local.txt` by concatenating three sources:
 * the committed example baseline, a committed shared appendix, and a
 * gitignored sensitive appendix. The sensitive appendix is seeded with a
 * comment-only header on first run; the developer adds private deny-list
 * literals into it directly so those literals never enter version control.
 *
 * Why three files? `forbidden-strings.local.example.txt` is the ported
 * betterleaks baseline (sane defaults, regenerated by
 * `mise.port-betterleaks.ts`). `forbidden-strings.append.txt` is checked
 * in and holds non-sensitive repo-wide rules (e.g. AGENTS.md shortcode
 * collisions) so every clone and CI share them.
 * `forbidden-strings.append.local.txt` is gitignored and holds sensitive
 * rules (codenames, partner identifiers, politically-charged literals)
 * that must not leak into git history. The scanner reads the combined
 * `forbidden-strings.local.txt` at runtime.
 */
async function generateForbiddenStringsRules(): Promise<void> {
  // Seed the gitignored sensitive appendix with a comment header only;
  // the file is where developers add private deny-list literals (e.g.
  // codenames, customer names) that must not be committed. We never
  // write a literal into this committed config; otherwise the
  // scanner would self-match against the seed string here.
  await overwriteIfNotExists({
    dest: './forbidden-strings.append.local.txt',
    content: `# forbidden-strings per-repo appendix (gitignored).
# Sensitive deny-list rules that must NOT enter version control: codenames,
# customer names, partner identifiers, politically-charged literals, etc.
# Add literal substrings or /PATTERN/FLAGS regex rules below; one per line.
# This file is concatenated onto forbidden-strings.local.example.txt and
# forbidden-strings.append.txt by file-enforcer to produce the runtime
# forbidden-strings.local.txt. Non-sensitive shared rules belong in the
# checked-in forbidden-strings.append.txt instead.
`,
  },);
  await overwrite({
    dest: './forbidden-strings.local.txt',
    content:
      `# Generated from forbidden-strings.local.example.txt + forbidden-strings.append.txt + forbidden-strings.append.local.txt by file-enforcer.
# Do not edit manually. To change baseline rules, edit
# packages/cli/forbidden-strings/src/mise.port-betterleaks.ts and re-run it.
# To add shared (non-sensitive) rules, edit forbidden-strings.append.txt.
# To add sensitive rules, edit forbidden-strings.append.local.txt.

${await cat([
        './forbidden-strings.local.example.txt',
        './forbidden-strings.append.txt',
        './forbidden-strings.append.local.txt',
      ],)}`,
  },);
}

/**
 * Generates resolved Browserslist targets for build tools that cannot resolve
 * `.browserslistrc` directly, loading the resolver via {@link importBrowserslist}
 * and picking query lines with {@link selectBrowserslistQueries}.
 *
 * @example
 * ```ts
 * await generateResolvedBrowserslistTargets();
 * ```
 */
async function generateResolvedBrowserslistTargets(): Promise<void> {
  /**
   * Browserslist resolver loaded lazily so file-enforcer uses real package data.
   */
  const resolveBrowserslist = await importBrowserslist();
  /**
   * Parsed query groups from the checked-in Browserslist file.
   */
  const browserslistConfig = resolveBrowserslist.parseConfig(
    await cat([BROWSERSLIST_CONFIG_PATH,],),
  );
  /**
   * Target strings selected from explicit query lines, with both config and stats
   * discovery disabled at the Browserslist API boundary.
   */
  const targets = resolveBrowserslist(
    selectBrowserslistQueries({ config: browserslistConfig, },),
    {
      path: false,
      stats: EMPTY_BROWSERSLIST_STATS,
    },
  );

  await overwrite({
    dest: './.browserslistrc.resolved.local.json',
    content: `${JSON.stringify(
      targets,
      null,
      2,
    )}\n`,
  },);
}

/**
 * Mirrors canonical skills from .agents/skills/ to .factory/skills/ and .claude/skills/
 * for legacy consumers.
 */
async function mirrorSkills(): Promise<void> {
  /**
   * Concatenated SKILL.md contents from the canonical .agents/skills tree, mirrored verbatim to legacy consumer dirs.
   */
  const skills = await cat('./.agents/skills/*/*.md',);
  await Promise.all([
    overwriteEach({
      destGlob: './.factory/skills/*/*.md',
      files: skills,
    },),
    overwriteEach({
      destGlob: './.claude/skills/*/*.md',
      files: skills,
    },),
  ],);
}

/**
 * Builds a flat patch disabling the given Harper linter rules.
 *
 * @param rules - Harper rule names to disable.
 *
 * @returns Patch mapping each `harper-ls.linters.<rule>` key to false.
 *
 * @example
 * ```ts
 * harperLintersDisabled(['SplitWords']);
 * ```
 */
function harperLintersDisabled(rules: readonly string[],): Record<string, false> {
  return Object.fromEntries(rules.map(function toDisabledEntry(rule,): readonly [
    string,
    false,
  ] {
    return [
      `harper-ls.linters.${rule}`,
      false,
    ];
  },),);
}

/**
 * Syncs this repo's Harper LSP4IJ writing-style policy into the latest IntelliJ
 * IDEA config via {@link manageLsp4ijServerSettings}: disables prose rules
 * globally with {@link harperLintersDisabled}, excludes the caveman-style agent
 * docs from the main server, and registers a second Harper server scoped to
 * AGENTS.md and CLAUDE.md with extra rules disabled.
 *
 * @example
 * ```ts
 * await manageHarperLsp4ij();
 * ```
 */
async function manageHarperLsp4ij(): Promise<void> {
  await manageLsp4ijServerSettings({
    productPrefixes: [
      'IntelliJIdea',
      'IdeaIC',
    ],
    baseServerMatch: {
      commandLineIncludes: 'harper-ls',
      serverNameEquals: 'Harper Language Server',
      templateId: 'harper-ls',
    },
    baseConfig: {
      set: harperLintersDisabled([
        'UseTitleCase',
        'SplitWords',
        'PhrasalVerbAsCompoundNoun',
      ],),
      arrayUnion: {
        'harper-ls.excludePatterns': [
          '**/AGENTS.md',
          '**/CLAUDE.md',
          join(
            process.cwd(),
            'AGENTS.md',
          ),
          join(
            process.cwd(),
            'CLAUDE.md',
          ),
        ],
      },
    },
    schemaDefaults: {
      'harper-ls.linters.UseTitleCase': {
        type: 'boolean',
        default: true,
        description: 'Prompts you to use title case in relevant headings.',
      },
    },
    scopedServers: [
      {
        id: 'harper-ls-agents-claude-md',
        name: 'Harper Language Server (AGENTS.md and CLAUDE.md)',
        fileNames: [
          'AGENTS.md',
          'CLAUDE.md',
        ],
        languageId: 'markdown',
        copyOptions: [
          'commandLine',
          'installAlreadyDone',
          'installerConfigurationContent',
          'serverUrl',
          'templateId',
          'workingDir',
          'workspaceFolderStrategyConfiguration',
        ],
        configOmitKeys: ['harper-ls.excludePatterns',],
        config: { set: harperLintersDisabled([
          'MissingTo',
          'LongSentences',
          'OxfordComma',
        ],), },
      },
    ],
  },);
}

await assertForbiddenRootContextAbsent();

await Promise.all([
  // CLAUDE.md must literally contain AGENTS.md content (Claude Code's @include is unreliable)
  overwrite({
    dest: './CLAUDE.md',
    content: `Generated from AGENTS.md by file-enforcer.

### Delegating work to subagents and child sessions

Two peer mechanisms; pick by whether you need a visible, independently-running session.

In-process subagents (the Agent tool, including the general-purpose type) run inside this session and forward their results back to you reliably. General-purpose subagents are allowed. Caveat: you cannot enumerate how many subagents are running, and SendMessage steering is unreliable, so fan out general-purpose subagents only in interactive sessions where the user watches and steers them in the Claude Code UI. Rationale: \`docs/decisions/general-purpose-subagent-ban.md\`.

Use \`spawn-claude\` outside sandbox to launch a steerable child Claude Code session in a visible terminal window. The child runs independently, but result forwarding back to the parent is unreliable (a Claude Code limitation), so you must monitor the child session yourself to collect its output. Do not pass \`--cwd\`: the child then will not read the repo \`CLAUDE.md\`, and Claude Code's cwd handling is unreliable.

${await cat(['./AGENTS.md',],)}`,
  },),

  generateMiseToml(),

  generateForbiddenStringsRules(),

  generateResolvedBrowserslistTargets(),

  manageHarperLsp4ij(),

  mirrorSkills(),
  // Oxlint config: root oxlint.config.ts imports @monochromatic-dev/config-oxlint and adds jsPlugins.
  // JS plugins (tsdoc, no-restricted-syntax, stylistic) are referenced by path from the root config.
],);

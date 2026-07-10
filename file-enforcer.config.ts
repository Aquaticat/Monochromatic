import {
  glob,
  lstat,
  unlink,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  addWatchedPaths,
  cat,
  getTomlProperty,
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
 * Source license texts keyed by SPDX license identifier, copied verbatim into
 * package-local `LICENSES/` directories so package artifacts carry the texts
 * without maintaining hand-edited duplicates.
 *
 * @example
 * ```ts
 * console.log(PACKAGE_LICENSE_TEXT_SOURCES['LGPL-3.0-or-later']);
 * ```
 */
const PACKAGE_LICENSE_TEXT_SOURCES = {
  'CC-BY-SA-4.0': './LICENSES/CC-BY-SA-4.0.txt',
  'GPL-3.0-or-later': './LICENSES/GPL-3.0-or-later.txt',
  'LGPL-3.0-or-later': './LICENSES/LGPL-3.0-or-later.txt',
} as const;

/**
 * License identifiers whose canonical texts file-enforcer knows how to copy.
 *
 * @example
 * ```ts
 * const id: PackageLicenseTextId = 'GPL-3.0-or-later';
 * ```
 */
type PackageLicenseTextId = keyof typeof PACKAGE_LICENSE_TEXT_SOURCES;

/**
 * Package manifest globs whose license expressions drive package-local license texts.
 *
 * @example
 * ```ts
 * console.log(PACKAGE_LICENSE_MANIFEST_GLOBS.length);
 * ```
 */
const PACKAGE_LICENSE_MANIFEST_GLOBS = [
  './packages/*/*/package.json',
  './packages/*/*/Cargo.toml',
] as const;

/**
 * License text identifiers needed when a package uses LGPLv3.
 * LGPLv3 incorporates GPLv3 by reference, so package artifacts need both texts.
 *
 * @example
 * ```ts
 * console.log(LGPL_3_OR_LATER_TEXT_IDS);
 * ```
 */
const LGPL_3_OR_LATER_TEXT_IDS = [
  'GPL-3.0-or-later',
  'LGPL-3.0-or-later',
] as const satisfies readonly PackageLicenseTextId[];

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
 * Converts an SPDX license expression to license texts that must accompany the
 * package artifact. The mapping is intentionally conservative: LGPLv3 yields
 * both LGPLv3 and GPLv3 because LGPLv3 is an additional-permissions layer over GPLv3.
 *
 * @param expression - SPDX license expression from a package manifest.
 *
 * @returns Known license text identifiers required by expression.
 *
 * @example
 * ```ts
 * licenseTextIdsForExpression({ expression: 'LGPL-3.0-or-later AND CC-BY-SA-4.0' });
 * ```
 */
function licenseTextIdsForExpression(
  { expression, }: { readonly expression: string; },
): readonly PackageLicenseTextId[] {
  /**
   * Ordered de-duplicated text identifiers produced from the expression.
   */
  const textIds = new Set<PackageLicenseTextId>();

  if (expression.includes('LGPL-3.0-or-later',))
    for (const textId of LGPL_3_OR_LATER_TEXT_IDS)
      textIds.add(textId,);
  else if (expression.includes('GPL-3.0-or-later',))
    textIds.add('GPL-3.0-or-later',);

  if (expression.includes('CC-BY-SA-4.0',))
    textIds.add('CC-BY-SA-4.0',);

  return [...textIds,];
}

/**
 * Reads license expression from a package.json manifest.
 *
 * @param manifestPath - package.json path.
 *
 * @returns SPDX expression when manifest carries a string `license` field.
 *
 * @example
 * ```ts
 * await packageJsonLicenseExpression({ manifestPath: './packages/module/test/package.json' });
 * ```
 */
async function packageJsonLicenseExpression(
  { manifestPath, }: { readonly manifestPath: string; },
): Promise<string | undefined> {
  /**
   * Parsed package.json object; only the license field matters here.
   */
  const packageJson = JSON.parse(await cat([manifestPath,],),) as {
    readonly license?: unknown;
  };

  return (typeof packageJson.license === 'string')
    ? packageJson.license
    : undefined;
}

/**
 * Reads license expression from a Cargo manifest.
 *
 * @param manifestPath - Cargo.toml path.
 *
 * @returns SPDX expression when manifest carries a string package.license field.
 *
 * @example
 * ```ts
 * await cargoTomlLicenseExpression({ manifestPath: './packages/cli/forbidden-strings/Cargo.toml' });
 * ```
 */
async function cargoTomlLicenseExpression(
  { manifestPath, }: { readonly manifestPath: string; },
): Promise<string | undefined> {
  /**
   * License value from Cargo's package metadata. Workspace-inherited or missing
   * values are ignored unless they resolve to a direct string in this manifest.
   */
  const license = getTomlProperty({
    path: ['package', 'license',],
    content: await cat([manifestPath,],),
  },) as string | undefined;

  return (typeof license === 'string')
    ? license
    : undefined;
}

/**
 * Returns package directory path for a two-level package manifest.
 *
 * @param manifestPath - package.json or Cargo.toml path.
 *
 * @returns Package root path containing manifest.
 *
 * @example
 * ```ts
 * packageDirFromManifest({ manifestPath: './packages/cli/forbidden-strings/Cargo.toml' });
 * ```
 */
function packageDirFromManifest(
  { manifestPath, }: { readonly manifestPath: string; },
): string {
  return manifestPath.slice(
    0,
    manifestPath.lastIndexOf('/',),
  );
}

/**
 * Removes file path when present, ignoring absent-path races.
 *
 * @param filePath - generated file path that may need deletion.
 *
 * @example
 * ```ts
 * await unlinkIfExists({ filePath: './packages/example/name/LICENSES/GPL-3.0-or-later.txt' });
 * ```
 */
async function unlinkIfExists(
  { filePath, }: { readonly filePath: string; },
): Promise<void> {
  try {
    await unlink(filePath,);
  }
  catch (error) {
    if (errorHasCode({ error, code: ABSENT_PATH_ERROR_CODE, },))
      return;

    throw error;
  }
}

/**
 * Adds one license expression to the per-package accumulator.
 *
 * @param packageLicenseExpressions - Accumulator keyed by package directory.
 *
 * @param packageDir - Package directory receiving expression.
 *
 * @param expression - SPDX expression from manifest.
 *
 * @example
 * ```ts
 * addPackageLicenseExpression({ packageLicenseExpressions: new Map(), packageDir: './packages/x/y', expression: 'LGPL-3.0-or-later' });
 * ```
 */
function addPackageLicenseExpression(
  {
    packageLicenseExpressions,
    packageDir,
    expression,
  }: {
    readonly packageLicenseExpressions: Map<string, Set<string>>;
    readonly packageDir: string;
    readonly expression: string;
  },
): void {
  /**
   * Existing expression set for this package, created lazily.
   */
  const expressions = packageLicenseExpressions.get(packageDir,) ?? new Set<string>();
  expressions.add(expression,);
  packageLicenseExpressions.set(
    packageDir,
    expressions,
  );
}

/**
 * Reads every two-level package manifest and records package-local license text needs.
 *
 * @returns Map from package directory to known license text identifiers.
 *
 * @example
 * ```ts
 * await collectPackageLicenseTextIds();
 * ```
 */
async function collectPackageLicenseTextIds(): Promise<Map<string, Set<PackageLicenseTextId>>> {
  /**
   * SPDX expressions grouped by package directory before mapping to text files.
   */
  const packageLicenseExpressions = new Map<string, Set<string>>();

  for (const manifestGlob of PACKAGE_LICENSE_MANIFEST_GLOBS) {
    for await (const manifestPath of glob(manifestGlob,)) {
      /**
       * SPDX expression read by the parser matching the manifest type.
       */
      const expression = manifestPath.endsWith('/package.json',)
        ? await packageJsonLicenseExpression({ manifestPath, },)
        : await cargoTomlLicenseExpression({ manifestPath, },);

      if (expression === undefined)
        continue;

      addPackageLicenseExpression({
        packageLicenseExpressions,
        packageDir: packageDirFromManifest({ manifestPath, },),
        expression,
      },);
    }
  }

  return new Map(Array.from(
    packageLicenseExpressions,
    function toPackageTextIds([packageDir, expressions,]): readonly [string, Set<PackageLicenseTextId>] {
      /**
       * Known license text identifiers required by all expressions in this package.
       */
      const textIds = new Set<PackageLicenseTextId>();
      for (const expression of expressions)
        for (const textId of licenseTextIdsForExpression({ expression, },))
          textIds.add(textId,);

      return [packageDir, textIds,];
    },
  ),);
}

/**
 * Generates package-local license texts under each package's `LICENSES/` directory from
 * canonical root `LICENSES/` sources, based on each package manifest's license
 * expression.
 *
 * @example
 * ```ts
 * await generatePackageLicenseTexts();
 * ```
 */
async function generatePackageLicenseTexts(): Promise<void> {
  /**
   * Required license text identifiers keyed by package directory.
   */
  const packageLicenseTextIds = await collectPackageLicenseTextIds();

  /**
   * Every generated license text identifier this config owns.
   */
  const knownLicenseTextIds = Object.keys(PACKAGE_LICENSE_TEXT_SOURCES,) as readonly PackageLicenseTextId[];

  await Promise.all(Array.from(
    packageLicenseTextIds,
    async function syncPackageLicenseTexts([packageDir, textIds,]): Promise<void> {
      await Promise.all(knownLicenseTextIds
        .filter(function isStaleTextId(textId,): boolean {
          return !textIds.has(textId,);
        },)
        .map(async function removeStaleLicenseText(textId,): Promise<void> {
          await unlinkIfExists({ filePath: `${packageDir}/LICENSES/${textId}.txt`, },);
        },),);

      await Promise.all(Array.from(
        textIds,
        async function writeLicenseText(textId,): Promise<void> {
          await overwrite({
            dest: `${packageDir}/LICENSES/${textId}.txt`,
            content: await cat([PACKAGE_LICENSE_TEXT_SOURCES[textId],],),
          },);
        },
      ),);
    },
  ),);
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
# Secrets live in the age-encrypted .env.local.json (sops backend), gitignored
# via the *.local.* pattern and decrypted at runtime by mise's built-in rops
# using the identity at ~/.config/mise/age.txt. Encrypted-only: no plaintext env
# slot survives, so a secret can never re-enter an unencrypted, backed-up file.
# Optional file - mise silently ignores it when missing.
# https://mise.jdx.dev/environments/secrets/sops.html
_.file = [{ path = ".env.local.json", redact = true }]
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

# Emits Slint element debug info (ids, source positions) into compiled UIs at
# build time. Required for the ElementHandle/MCP introspection APIs
# (find_elements_by_id, get_element_tree) the desktop-app test harnesses rely
# on; without it those calls panic at runtime (see
# docs/handover/slint-app-testing.md, docs/troubleshooting/slint-embedded-mcp-server.md).
# Setting it at the repo root covers every cargo/slint invocation mise
# launches, not just the packages that previously set it per-task.
SLINT_EMIT_DEBUG_INFO = "1"
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
    content: `Generated from \`AGENTS.md\` by file-enforcer.

### Delegating work to subagents and child sessions

Two peer mechanisms;
pick by whether you need a visible,
independently-running session.

In-process subagents (the Agent tool,
including the general-purpose type) run inside this session and forward their results back to you reliably.
General-purpose subagents are allowed.
Caveat:
you cannot enumerate how many subagents are running,
and SendMessage steering is unreliable,
so fan out general-purpose subagents only in interactive sessions where the user watches and steers them in the Claude Code UI.
Rationale:
\`docs/decisions/general-purpose-subagent-ban.md\`.

Use \`spawn-claude\` outside sandbox to launch a steerable child Claude Code session in a visible terminal window.
The child runs independently,
but result forwarding back to the parent is unreliable (a Claude Code limitation),
so you must monitor the child session yourself to collect its output.
Do not pass \`--cwd\`:
the child then will not read the repo \`CLAUDE.md\`,
and Claude Code's cwd handling is unreliable.

${await cat(['./AGENTS.md',],)}`,
  },),

  generateMiseToml(),

  generateForbiddenStringsRules(),

  generatePackageLicenseTexts(),

  generateResolvedBrowserslistTargets(),

  manageHarperLsp4ij(),

  mirrorSkills(),
  // Oxlint config: root oxlint.config.ts imports @monochromatic-dev/config-oxlint and adds jsPlugins.
  // JS plugins (tsdoc, no-restricted-syntax, stylistic) are referenced by path from the root config.
],);

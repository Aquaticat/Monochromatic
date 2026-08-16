import { createHash, } from 'node:crypto';
import {
  glob,
  lstat,
  mkdir,
  readFile,
  rm,
  unlink,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  addWatchedPaths,
  cat,
  getTomlProperty,
  manageCargoManifests,
  manageLsp4ijServerSettings,
  overwrite,
  overwriteEach,
  overwriteIfNotExists,
} from '@monochromatic-dev/dev-script-file-enforcer/ts';
import type {
  CanonicalTomlValue,
  CargoEnforcement,
  CargoManifestPlan,
  GlobResults,
} from '@monochromatic-dev/dev-script-file-enforcer/ts';

import type browserslist from 'browserslist';

/**
 * Root-level context summary path that must remain absent. The repo relies on
 * source reads plus doc/agent/domain.md instead of cached context files.
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
  './package/*/*/package.json',
  './package/*/*/Cargo.toml',
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
 * Canonical repo-relative prefix owned by the agent-skill mirror generator.
 *
 * @example
 * ```ts
 * console.log(SKILL_MIRROR_CANONICAL_PREFIX);
 * ```
 */
const SKILL_MIRROR_CANONICAL_PREFIX = '.agents/skills/';

/**
 * Legacy skill roots receiving byte-identical canonical Markdown files.
 *
 * @example
 * ```ts
 * console.log(SKILL_MIRROR_DESTINATION_ROOTS);
 * ```
 */
const SKILL_MIRROR_DESTINATION_ROOTS = [
  './.claude/skills',
  './.factory/skills',
] as const;

/**
 * Ownership manifest filename stored in each legacy skill root.
 *
 * @example
 * ```ts
 * console.log(SKILL_MIRROR_MANIFEST_FILENAME);
 * ```
 */
const SKILL_MIRROR_MANIFEST_FILENAME = '.agents-mirror-manifest.json';

/**
 * Canonical skill path to SHA-256 mapping owned by one mirror destination.
 *
 * @example
 * ```ts
 * const manifest: SkillMirrorManifest = {
 *   '.agents/skills/example/SKILL.md': 'hash',
 * };
 * ```
 */
type SkillMirrorManifest = Readonly<Record<string, string>>;

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
      'read source code directly and use doc/agent/domain.md for this repo policy.',
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
 * await packageJsonLicenseExpression({ manifestPath: './package/module/test/package.json' });
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
 * await cargoTomlLicenseExpression({ manifestPath: './package/cli/forbidden-strings/Cargo.toml' });
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
 * packageDirFromManifest({ manifestPath: './package/cli/forbidden-strings/Cargo.toml' });
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
 * await unlinkIfExists({ filePath: './package/example/name/LICENSES/GPL-3.0-or-later.txt' });
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
 * addPackageLicenseExpression({ packageLicenseExpressions: new Map(), packageDir: './package/x/y', expression: 'LGPL-3.0-or-later' });
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

      await Promise.all([...textIds,].map(
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
  { config, }: { readonly config: Readonly<Record<string, readonly string[]>>; },
): readonly string[] {
  return config[BROWSERSLIST_CONFIG_ENVIRONMENT]
    ?? config['defaults']
    ?? [];
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

# Every workspace bin dir, globbed from what is installed on disk rather than
# read from workspace metadata. So this list changes with install state: a fresh
# clone, a pruned package, or a pnpm install that adds a dependency all move it.
# That is expected, and the regenerated list is committed as file-enforcer
# writes it. Do not revert it as drift and do not hand-edit it; the source is
# file-enforcer.config.ts. Issue #335 tracks deriving it from workspace metadata
# instead, which would make it stable across environments.
_.path = [
${
    [
      ...new Set([
        'node_modules/.bin',
        ...(await Array.fromAsync(glob('package/*/*/node_modules/.bin',),)).toSorted(),
      ]),
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
# doc/handover/slint-app-testing.md, doc/troubleshooting/slint-embedded-mcp-server.md).
# Setting it at the repo root covers every cargo/slint invocation mise
# launches, not just the packages that previously set it per-task.
SLINT_EMIT_DEBUG_INFO = "1"

# Points the forbidden-strings scanner (and the cli-git forbidden-strings
# policy adapter, which reads the same variable) at the file-enforcer
# generated rules file under the gitignored .cache/ scratch dir; rules no
# longer materialize at the repository root
# (doc/decision/gitignore-negations.md). {{config_root}} makes the path
# absolute so scans started from any subdirectory resolve the same file.
FORBIDDEN_STRINGS_RULES = "{{config_root}}/.cache/forbidden-strings.rules.txt"
`;
  await overwrite({
    dest: './mise.toml',
    content: `# Generated from mise.no-env.toml by file-enforcer.
${await cat(['./mise.no-env.toml',],)}
${envSection}`,
  },);
}

/**
 * Generates the forbidden-strings rules file under the gitignored `.cache/`
 * scratch directory by concatenating the committed shared appendix with a
 * gitignored sensitive appendix. The sensitive appendix is seeded with a
 * comment-only header on first run; the developer adds private deny-list
 * literals into it directly so those literals never enter version control.
 *
 * Why two files? `forbidden-strings.append.txt` is checked in and holds
 * non-sensitive repo-wide rules (e.g. AGENTS.md shortcode collisions) so
 * every clone and CI share them. `forbidden-strings.append.local.txt` is
 * gitignored and holds sensitive rules (codenames, partner identifiers,
 * politically-charged literals) that must not leak into git history.
 *
 * The betterleaks baseline no longer materializes here: it ships inside the
 * scanner binary and repo invocations activate it with `--builtin-rules`
 * (see `doc/decision/gitignore-negations.md`). The generated root
 * `mise.toml` points `FORBIDDEN_STRINGS_RULES` at the scratch file, so no
 * rules file exists at the repository root at all. The retired root outputs
 * (`forbidden-strings.local.txt`, previously generated here) are removed
 * when present so a stale copy can never shadow the scratch file through
 * the scanner's cwd-default fallback.
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
# Tail-format sections: a '==> name <==' header opens one rule (a bare
# literal or a /PATTERN/FLAGS regex on a single significant line; several
# significant lines form one verbatim always-verbose pattern).
# Section names surface in findings and CI logs as 'rule=<name>', so give
# sensitive rules deliberately opaque names (for example sequential
# 'local-001' style) that reveal nothing about what the rule bans.
# This file is concatenated onto forbidden-strings.append.txt by
# file-enforcer to produce the runtime .cache/forbidden-strings.rules.txt
# (the betterleaks baseline ships inside the scanner binary; repo scans
# pass --builtin-rules). Names must not collide with the shared appendix's
# or the baseline's. Non-sensitive shared rules belong in the checked-in
# forbidden-strings.append.txt instead.
`,
  },);
  await mkdir(
    './.cache',
    { recursive: true, },
  );
  await overwrite({
    dest: './.cache/forbidden-strings.rules.txt',
    content:
      `# Generated from forbidden-strings.append.txt + forbidden-strings.append.local.txt by file-enforcer.
# Do not edit manually. Baseline credential rules are NOT in this file: they
# ship inside the forbidden-strings binary and repo invocations pass
# --builtin-rules (regenerate via
# mise run //package/cli/forbidden-strings:generate:rules). To add shared
# (non-sensitive) rules, edit forbidden-strings.append.txt. To add sensitive
# rules, edit forbidden-strings.append.local.txt; section names must stay
# unique across the concatenation.

${await cat([
        './forbidden-strings.append.txt',
        './forbidden-strings.append.local.txt',
      ],)}`,
  },);
  // Retired root output of this generator (pre-de-rooting); remove so the
  // scanner's cwd-default fallback can never resolve a stale rules copy.
  await rm(
    './forbidden-strings.local.txt',
    { force: true, },
  );
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
 * Signals malformed mirror ownership data before any owned destination can be removed.
 *
 * @example
 * ```ts
 * throw new SkillMirrorManifestError({
 *   manifestPath: './.claude/skills/.agents-mirror-manifest.json',
 *   reason: 'unexpected path',
 * });
 * ```
 */
class SkillMirrorManifestError extends Error {
  /**
   * Builds a mirror-manifest failure naming the unsafe source.
   *
   * @param manifestPath - manifest whose ownership data failed validation.
   *
   * @param reason - evidence explaining why synchronization cannot continue.
   *
   * @example
   * ```ts
   * new SkillMirrorManifestError({ manifestPath: 'manifest.json', reason: 'invalid JSON', });
   * ```
   */
  public constructor(
    {
      manifestPath,
      reason,
    }: {
      readonly manifestPath: string;
      readonly reason: string;
    },
  ) {
    super(`Invalid skill mirror manifest ${manifestPath}: ${reason}`,);
    this.name = SkillMirrorManifestError.name;
  }
}

/**
 * Removes file-enforcer's optional leading current-directory marker.
 *
 * @param filePath - path emitted by canonical skill glob.
 *
 * @returns Repo-relative path without leading `./`.
 *
 * @example
 * ```ts
 * canonicalSkillPath({ filePath: './.agents/skills/example/SKILL.md' });
 * ```
 */
function canonicalSkillPath({ filePath, }: { readonly filePath: string; }): string {
  return filePath.startsWith('./',)
    ? filePath.slice(2,)
    : filePath;
}

/**
 * Returns whether a manifest key names exactly one canonical skill Markdown file.
 *
 * @param filePath - repo-relative manifest key.
 *
 * @returns Whether path is safe to map under a mirror destination.
 *
 * @example
 * ```ts
 * isCanonicalSkillPath({ filePath: '.agents/skills/example/SKILL.md' });
 * ```
 */
function isCanonicalSkillPath({ filePath, }: { readonly filePath: string; }): boolean {
  /**
   * Path segments checked without filesystem resolution so traversal cannot escape destination root.
   */
  const segments = filePath.split('/',);
  return segments.length === 4
    && segments[0] === '.agents'
    && segments[1] === 'skills'
    && segments[2] !== ''
    && segments[2] !== '.'
    && segments[2] !== '..'
    && segments[3]?.endsWith('.md',) === true
    && !filePath.includes('\\',);
}

/**
 * Validates parsed JSON and returns it as a safe canonical skill ownership
 * manifest. A returning validator, not an `asserts` predicate, because an
 * assertion signature cannot reference a destructured parameter element (TS1230).
 *
 * @param value - parsed JSON value.
 *
 * @param manifestPath - source path used in validation errors.
 *
 * @returns value narrowed to a validated {@link SkillMirrorManifest}.
 *
 * @throws {@link SkillMirrorManifestError} when value is not a flat string map of canonical skill paths.
 *
 * @mutates value through `Reflect.ownKeys` and `Reflect.get` proxy or accessor hooks
 *
 * @example
 * ```ts
 * const manifest = toSkillMirrorManifest({ value: {}, manifestPath: 'manifest.json', });
 * ```
 */
function toSkillMirrorManifest(
  {
    value,
    manifestPath,
  }: {
    readonly value: unknown;
    readonly manifestPath: string;
  },
): SkillMirrorManifest {
  if (value === null
    || (typeof value) !== 'object'
    || Array.isArray(value,))
    throw new SkillMirrorManifestError({ manifestPath, reason: 'expected a JSON object', },);

  for (const key of Reflect.ownKeys(value,)) {
    if ((typeof key) !== 'string'
      || !isCanonicalSkillPath({ filePath: key, })
      || (typeof Reflect.get(value, key,)) !== 'string')
      throw new SkillMirrorManifestError({
        manifestPath,
        reason: `unsafe ownership entry ${String(key,)}`,
      },);
  }

  return value as SkillMirrorManifest;
}

/**
 * Reads and validates a prior mirror manifest,
 * returning no owned paths when destination has never been synchronized.
 *
 * @param manifestPath - destination ownership-manifest path.
 *
 * @returns Valid prior canonical-path mapping.
 *
 * @throws {@link SkillMirrorManifestError} when existing manifest is malformed.
 *
 * @example
 * ```ts
 * await readSkillMirrorManifest({ manifestPath: './.claude/skills/.agents-mirror-manifest.json', });
 * ```
 */
async function readSkillMirrorManifest(
  { manifestPath, }: { readonly manifestPath: string; },
): Promise<SkillMirrorManifest> {
  /**
   * Existing manifest text read before any stale destination is removed.
   */
  let content: string;
  try {
    content = await readFile(manifestPath, 'utf8',);
  }
  catch (readError: unknown) {
    if (errorHasCode({ error: readError, code: ABSENT_PATH_ERROR_CODE, },))
      return {};

    throw readError;
  }

  /**
   * Parsed ownership value validated before use as deletion authority.
   */
  let parsed: unknown;
  try {
    parsed = JSON.parse(content,) as unknown;
  }
  catch (parseError: unknown) {
    throw new SkillMirrorManifestError({
      manifestPath,
      reason: `invalid JSON: ${String(parseError,)}`,
    },);
  }
  return toSkillMirrorManifest({ value: parsed, manifestPath, },);
}

/**
 * Hashes canonical Markdown content for deterministic mirror ownership.
 *
 * @param content - exact canonical UTF-8 text.
 *
 * @returns Lowercase SHA-256 digest.
 *
 * @example
 * ```ts
 * hashSkillContent({ content: '# Skill\n', });
 * ```
 */
function hashSkillContent({ content, }: { readonly content: string; }): string {
  return createHash('sha256',)
    .update(content, 'utf8',)
    .digest('hex',);
}

/**
 * Maps one canonical path beneath a legacy mirror root after path validation.
 *
 * @param canonicalPath - validated canonical repo-relative path.
 *
 * @param destinationRoot - mirror root receiving canonical suffix.
 *
 * @returns Destination counterpart path.
 *
 * @throws {@link SkillMirrorManifestError} when canonical path is unsafe.
 *
 * @example
 * ```ts
 * mirrorDestinationPath({
 *   canonicalPath: '.agents/skills/example/SKILL.md',
 *   destinationRoot: './.claude/skills',
 * });
 * ```
 */
function mirrorDestinationPath(
  {
    canonicalPath,
    destinationRoot,
  }: {
    readonly canonicalPath: string;
    readonly destinationRoot: string;
  },
): string {
  if (!isCanonicalSkillPath({ filePath: canonicalPath, }))
    throw new SkillMirrorManifestError({
      manifestPath: `${destinationRoot}/${SKILL_MIRROR_MANIFEST_FILENAME}`,
      reason: `unsafe canonical path ${canonicalPath}`,
    },);

  return `${destinationRoot}/${canonicalPath.slice(SKILL_MIRROR_CANONICAL_PREFIX.length,)}`;
}

/**
 * Synchronizes one mirror root,
 * pruning only paths owned by its valid prior manifest.
 *
 * @param destinationRoot - legacy root receiving canonical files and ownership manifest.
 *
 * @param skills - canonical file-enforcer glob results.
 *
 * @param canonicalPaths - current canonical paths used to identify removed mirrors.
 *
 * @param manifestText - serialized current ownership manifest.
 *
 * @mutates skills - mirror writes run inside the file-enforcer capture boundary (sourceCaptureStorage.run), which may invoke lazy glob builders reachable from these results.
 *
 * @example
 * ```ts
 * await mirrorSkillsToDestination({ canonicalPaths, destinationRoot, manifestText, skills, });
 * ```
 */
async function mirrorSkillsToDestination(
  {
    canonicalPaths,
    destinationRoot,
    manifestText,
    skills,
  }: {
    readonly canonicalPaths: ReadonlySet<string>;
    readonly destinationRoot: string;
    readonly manifestText: string;
    skills: GlobResults;
  },
): Promise<void> {
  /**
   * Ownership manifest colocated with mirrored skills.
   */
  const manifestPath = `${destinationRoot}/${SKILL_MIRROR_MANIFEST_FILENAME}`;
  /**
   * Prior ownership controls the only destination paths eligible for pruning.
   */
  const priorManifest = await readSkillMirrorManifest({ manifestPath, },);

  await Promise.all(Object.keys(priorManifest,)
    .filter(function isRemovedCanonicalPath(canonicalPath,): boolean {
      return !canonicalPaths.has(canonicalPath,);
    },)
    .map(async function removeOwnedStaleMirror(canonicalPath,): Promise<void> {
      await unlinkIfExists({
        filePath: mirrorDestinationPath({ canonicalPath, destinationRoot, }),
      },);
    },),);

  await overwriteEach({
    destGlob: `${destinationRoot}/*/*.md`,
    files: skills,
  },);
  await overwrite({
    dest: manifestPath,
    content: manifestText,
  },);
}

/**
 * Mirrors canonical skills from .agents/skills/ to .factory/skills/ and .claude/skills/,
 * with manifests limiting stale deletion to paths the prior synchronization owned.
 *
 * @example
 * ```ts
 * await mirrorSkills();
 * ```
 */
async function mirrorSkills(): Promise<void> {
  /**
   * Canonical Markdown contents mirrored verbatim to each legacy consumer root.
   */
  const skills = await cat('./.agents/skills/*/*.md',);
  /**
   * Canonical files ordered by raw path before JSON construction.
   */
  const orderedSkills = [...skills,].sort(function compareSkillPaths(left, right,): number {
    /**
     * Normalized left path used for deterministic code-unit ordering.
     */
    const leftPath = canonicalSkillPath({ filePath: left.path, },);
    /**
     * Normalized right path used for deterministic code-unit ordering.
     */
    const rightPath = canonicalSkillPath({ filePath: right.path, },);
    if (leftPath < rightPath)
      return -1;
    if (leftPath > rightPath)
      return 1;
    return 0;
  },);
  /**
   * Current ownership mapping excludes every destination-only skill by construction.
   */
  const manifest: SkillMirrorManifest = Object.fromEntries(orderedSkills.map(
    function toManifestEntry(skill,): readonly [string, string] {
      return [
        canonicalSkillPath({ filePath: skill.path, },),
        hashSkillContent({ content: skill.content, },),
      ];
    },
  ),);
  /**
   * Current canonical path set shared by every destination pruning pass.
   */
  const canonicalPaths = new Set(Object.keys(manifest,),);
  /**
   * Serialized ownership manifest produced once at local ownership boundary.
   */
  const manifestText = `${JSON.stringify(manifest, null, 2,)}\n`;

  await Promise.all(SKILL_MIRROR_DESTINATION_ROOTS.map(
    async function syncDestination(destinationRoot,): Promise<void> {
      await mirrorSkillsToDestination({
        canonicalPaths,
        destinationRoot,
        manifestText,
        skills,
      },);
    },
  ),);
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

/**
 * Canonical Rust edition enforced on every crate (`AGENTS.md`: fleet is 2024).
 *
 * @example
 * ```ts
 * console.log(CARGO_CANONICAL_EDITION);
 * ```
 */
const CARGO_CANONICAL_EDITION = '2024';

/**
 * Canonical SPDX license for crates that declare one (present-seeded).
 *
 * @example
 * ```ts
 * console.log(CARGO_CANONICAL_LICENSE);
 * ```
 */
const CARGO_CANONICAL_LICENSE = 'LGPL-3.0-or-later';

/**
 * Git repository URL shared by every published crate manifest.
 *
 * @example
 * ```ts
 * console.log(CARGO_REPOSITORY_URL);
 * ```
 */
const CARGO_REPOSITORY_URL = 'https://github.com/Aquaticat/Monochromatic.git';

/**
 * GitHub tree base used to derive each published crate's homepage from its path.
 *
 * @example
 * ```ts
 * console.log(CARGO_HOMEPAGE_TREE_BASE);
 * ```
 */
const CARGO_HOMEPAGE_TREE_BASE = 'https://github.com/Aquaticat/Monochromatic/tree/main';

/**
 * Canonical readme filename for published crates.
 *
 * @example
 * ```ts
 * console.log(CARGO_README_FILENAME);
 * ```
 */
const CARGO_README_FILENAME = 'README.md';

/**
 * Canonical `[lints.clippy]` block appended to crates lacking it. Denies
 * `Result::unwrap` (the root `clippy.toml` supplies the disallowed-methods
 * list), denies implicit returns, and allows explicit returns.
 *
 * @example
 * ```ts
 * console.log(CARGO_LINTS_BLOCK);
 * ```
 */
const CARGO_LINTS_BLOCK = `# Canonical lint policy, enforced by file-enforcer (doc/planning/cargo-toml-file-enforcer.md).
[lints.clippy]
disallowed_methods = "deny"
implicit_return = "deny"
needless_return = "allow"
`;

/**
 * Canonical empty `[workspace]` block appended to crates lacking one, pinning
 * each crate as its own workspace root so no ancestor `Cargo.toml` absorbs it.
 *
 * @example
 * ```ts
 * console.log(CARGO_WORKSPACE_BLOCK);
 * ```
 */
const CARGO_WORKSPACE_BLOCK = `# Standalone crate: its own workspace root, so no ancestor Cargo.toml can absorb it.
# Enforced by file-enforcer (doc/planning/cargo-toml-file-enforcer.md).
[workspace]
`;

/**
 * Clippy lint keys the canonical policy sets inside an existing `[lints.clippy]`.
 *
 * @example
 * ```ts
 * console.log(CARGO_LINTS_CLIPPY_KEYS.implicit_return);
 * ```
 */
const CARGO_LINTS_CLIPPY_KEYS = {
  disallowed_methods: 'deny',
  implicit_return: 'deny',
  needless_return: 'allow',
} as const satisfies Record<string, CanonicalTomlValue>;

/**
 * One owned shared dependency: its table, name, and single fleet-wide requirement.
 *
 * @example
 * ```ts
 * const dep: CargoSharedDependency = { table: 'dependencies', name: 'anyhow', value: '1' };
 * ```
 */
type CargoSharedDependency = {
  readonly table: 'dependencies' | 'build-dependencies';
  readonly name: string;
  readonly value: CanonicalTomlValue;
};

/**
 * Shared dependency requirements owned across crates: every dependency whose
 * exact requirement is identical wherever it appears (single fleet-wide form).
 * `tokio` is excluded because `truepeak-core` declares an `optional` variant;
 * `image`, `gtk4`, and `windows` carry genuinely divergent per-crate forms.
 *
 * @example
 * ```ts
 * console.log(CARGO_SHARED_DEPENDENCIES.length);
 * ```
 */
const CARGO_SHARED_DEPENDENCIES: readonly CargoSharedDependency[] = [
  { table: 'dependencies', name: 'aho-corasick', value: '1', },
  { table: 'dependencies', name: 'anyhow', value: '1', },
  { table: 'dependencies', name: 'arbitrary', value: { version: '1', features: ['derive',], }, },
  { table: 'dependencies', name: 'clap', value: { version: '4', features: ['derive',], }, },
  { table: 'dependencies', name: 'gxhash', value: '3', },
  { table: 'dependencies', name: 'i-slint-backend-winit', value: '1.17.0', },
  { table: 'dependencies', name: 'ignore', value: '0.4', },
  { table: 'dependencies', name: 'libfuzzer-sys', value: { version: '0.4', features: ['arbitrary-derive',], }, },
  { table: 'dependencies', name: 'memchr', value: '2', },
  {
    table: 'dependencies',
    name: 'opus',
    value: { git: 'https://github.com/SpaceManiac/opus-rs', rev: '559876660603dc8079a053e03e6438766f669e69', },
  },
  { table: 'dependencies', name: 'rayon', value: '1', },
  { table: 'dependencies', name: 'regex', value: '1', },
  { table: 'dependencies', name: 'ringbuf', value: '0.4', },
  { table: 'dependencies', name: 'serde', value: { version: '1', features: ['derive',], }, },
  { table: 'dependencies', name: 'serde_json', value: '1', },
  {
    table: 'dependencies',
    name: 'slint',
    value: { version: '1.17.0', features: ['backend-winit', 'renderer-femtovg', 'renderer-software',], },
  },
  { table: 'dependencies', name: 'symphonia', value: { version: '0.6', features: ['all',], }, },
  { table: 'dependencies', name: 'tracing', value: '0.1', },
  { table: 'dependencies', name: 'tracing-appender', value: '0.2', },
  { table: 'dependencies', name: 'tracing-subscriber', value: { version: '0.3', features: ['env-filter',], }, },
  { table: 'build-dependencies', name: 'slint-build', value: '1.17.0', },
];

/**
 * Release/dev profile tables mapped to their canonical key/value settings.
 *
 * @example
 * ```ts
 * const preset: CargoProfileSpec = { release: { lto: true } };
 * ```
 */
type CargoProfileSpec = {
  readonly [profileName: string]: { readonly [key: string]: CanonicalTomlValue; };
};

/**
 * Scanner profile: full optimization plus fail-closed panic/overflow behavior.
 *
 * @example
 * ```ts
 * console.log(CARGO_PROFILE_SCANNER.release);
 * ```
 */
const CARGO_PROFILE_SCANNER: CargoProfileSpec = {
  release: { lto: true, 'codegen-units': 1, 'opt-level': 3, panic: 'unwind', 'overflow-checks': true, strip: true, },
};

/**
 * Overflow-checked profile: full optimization with overflow checks but default panic.
 *
 * @example
 * ```ts
 * console.log(CARGO_PROFILE_OVERFLOW.release);
 * ```
 */
const CARGO_PROFILE_OVERFLOW: CargoProfileSpec = {
  release: { lto: true, 'codegen-units': 1, 'opt-level': 3, 'overflow-checks': true, strip: true, },
};

/**
 * Linter profile: full optimization, stripped, without panic/overflow overrides.
 *
 * @example
 * ```ts
 * console.log(CARGO_PROFILE_LINTER.release);
 * ```
 */
const CARGO_PROFILE_LINTER: CargoProfileSpec = {
  release: { lto: true, 'codegen-units': 1, 'opt-level': 3, strip: true, },
};

/**
 * Bench profile: full optimization, unstripped so symbolized profiles stay usable.
 *
 * @example
 * ```ts
 * console.log(CARGO_PROFILE_BENCH.release);
 * ```
 */
const CARGO_PROFILE_BENCH: CargoProfileSpec = {
  release: { lto: true, 'codegen-units': 1, 'opt-level': 3, },
};

/**
 * Music-player profile: symbol strip plus fat LTO, tuned in that crate's manifest.
 *
 * @example
 * ```ts
 * console.log(CARGO_PROFILE_MUSIC.release);
 * ```
 */
const CARGO_PROFILE_MUSIC: CargoProfileSpec = {
  release: { strip: 'symbols', lto: true, },
};

/**
 * Fuzz profile: unwinding panics in release and dev so libFuzzer captures crashes.
 *
 * @example
 * ```ts
 * console.log(CARGO_PROFILE_FUZZ.dev);
 * ```
 */
const CARGO_PROFILE_FUZZ: CargoProfileSpec = {
  release: { panic: 'unwind', },
  dev: { panic: 'unwind', },
};

/**
 * Crate directory to profile preset (present-seeded: only crates that already
 * declare a `[profile.*]` table appear here).
 *
 * @example
 * ```ts
 * console.log(CARGO_PROFILE_BY_DIR['package/linter/rust']);
 * ```
 */
const CARGO_PROFILE_BY_DIR: Record<string, CargoProfileSpec> = {
  'package/cli/forbidden-strings': CARGO_PROFILE_SCANNER,
  'package/rust-module/forbidden-regex': CARGO_PROFILE_SCANNER,
  'package/cli/nested-wayland-session': CARGO_PROFILE_OVERFLOW,
  'package/linter/rust': CARGO_PROFILE_LINTER,
  'package/rust-module/forbidden-regex.bench': CARGO_PROFILE_BENCH,
  'package/music-player/truepeak-core.bench': CARGO_PROFILE_BENCH,
  'package/music-player/desktop-app': CARGO_PROFILE_MUSIC,
  'package/rust-module/forbidden-regex.fuzz': CARGO_PROFILE_FUZZ,
  'package/fuzz/forbidden-strings': CARGO_PROFILE_FUZZ,
};

/**
 * Guarded enforcements identical for every crate: edition, license, publish,
 * the three lint keys, the shared dependency requirements, and the
 * published-crate repository and readme.
 *
 * @example
 * ```ts
 * console.log(CARGO_STATIC_ENFORCEMENTS.length);
 * ```
 */
const CARGO_STATIC_ENFORCEMENTS: readonly CargoEnforcement[] = [
  { guardPath: ['package',], path: ['package', 'edition',], value: CARGO_CANONICAL_EDITION, },
  { guardPath: ['package', 'license',], path: ['package', 'license',], value: CARGO_CANONICAL_LICENSE, },
  { guardPath: ['package', 'publish',], path: ['package', 'publish',], value: false, },
  ...Object.entries(CARGO_LINTS_CLIPPY_KEYS,)
    .map(function lintsEnforcement([key, value,],): CargoEnforcement {
      return { guardPath: ['lints', 'clippy',], path: ['lints', 'clippy', key,], value, };
    },),
  ...CARGO_SHARED_DEPENDENCIES.map(function dependencyEnforcement(
    { table, name, value, },
  ): CargoEnforcement {
    return { guardPath: [table, name,], path: [table, name,], value, };
  },),
  { guardPath: ['package', 'repository',], path: ['package', 'repository',], value: CARGO_REPOSITORY_URL, },
  { guardPath: ['package', 'repository',], path: ['package', 'readme',], value: CARGO_README_FILENAME, },
];

/**
 * Directory of a crate manifest (path without the trailing `/Cargo.toml`).
 *
 * @param manifestPath - Repo-relative manifest path from discovery
 *
 * @returns Crate directory path
 *
 * @example
 * ```ts
 * cargoPackageDir({ manifestPath: 'package/linter/rust/Cargo.toml' }); // 'package/linter/rust'
 * ```
 */
function cargoPackageDir({ manifestPath, }: { readonly manifestPath: string; },): string {
  return manifestPath.slice(
    0,
    manifestPath.lastIndexOf('/',),
  );
}

/**
 * Derives a published crate's homepage from its directory.
 *
 * @param manifestPath - Repo-relative manifest path from discovery
 *
 * @returns GitHub tree URL for that crate's directory
 *
 * @example
 * ```ts
 * cargoHomepage({ manifestPath: 'package/linter/rust/Cargo.toml' });
 * ```
 */
function cargoHomepage({ manifestPath, }: { readonly manifestPath: string; },): string {
  return `${CARGO_HOMEPAGE_TREE_BASE}/${cargoPackageDir({ manifestPath, },)}`;
}

/**
 * Profile enforcements for one crate, empty when it declares no profile.
 *
 * @param manifestPath - Repo-relative manifest path from discovery
 *
 * @returns Guarded enforcements for the crate's mapped profile preset
 *
 * @example
 * ```ts
 * cargoProfileEnforcements({ manifestPath: 'package/linter/rust/Cargo.toml' });
 * ```
 */
function cargoProfileEnforcements(
  { manifestPath, }: { readonly manifestPath: string; },
): readonly CargoEnforcement[] {
  /**
   * Mapped preset for this crate directory, absent when the crate owns no profile.
   */
  const preset = CARGO_PROFILE_BY_DIR[cargoPackageDir({ manifestPath, },)];
  if (preset === undefined)
    return [];

  return Object.entries(preset,)
    .flatMap(function profileTableEnforcements([profileName, keys,],): readonly CargoEnforcement[] {
      return Object.entries(keys,)
        .map(function profileKeyEnforcement([key, value,],): CargoEnforcement {
          return {
            guardPath: ['profile', profileName,],
            path: ['profile', profileName, key,],
            value,
          };
        },);
    },);
}

/**
 * Builds the canonical enforcement plan for one crate manifest.
 *
 * @param manifestPath - Repo-relative manifest path from discovery
 *
 * @returns Plan of guarded enforcements plus absent-block insertions
 *
 * @example
 * ```ts
 * buildCargoManifestPlan({ manifestPath: 'package/linter/rust/Cargo.toml' });
 * ```
 */
function buildCargoManifestPlan(
  { manifestPath, }: { readonly manifestPath: string; },
): CargoManifestPlan {
  return {
    enforcements: [
      ...CARGO_STATIC_ENFORCEMENTS,
      {
        guardPath: ['package', 'repository',],
        path: ['package', 'homepage',],
        value: cargoHomepage({ manifestPath, },),
      },
      ...cargoProfileEnforcements({ manifestPath, },),
    ],
    blocks: [
      { absentPath: ['lints', 'clippy',], text: CARGO_LINTS_BLOCK, },
      { absentPath: ['workspace',], text: CARGO_WORKSPACE_BLOCK, },
    ],
  };
}

/**
 * Enforces the canonical Cargo manifest spec across every first-party crate.
 * Bounded-depth globs cover the two-level crates and the three-level Android
 * crate without descending into gitignored `target/` trees.
 *
 * @example
 * ```ts
 * await generateCargoManifests();
 * ```
 */
async function generateCargoManifests(): Promise<void> {
  await manageCargoManifests({
    manifestGlobs: [
      'package/*/*/Cargo.toml',
      'package/*/*/*/Cargo.toml',
    ],
    spec: buildCargoManifestPlan,
  },);
}

await assertForbiddenRootContextAbsent();

await Promise.all([
  // CLAUDE.md must literally contain AGENTS.md content (Claude Code's @include is unreliable)
  overwrite({
    dest: './CLAUDE.md',
    content: `Generated from \`AGENTS.md\` by file-enforcer.

In-process subagents (the Agent tool,
including the general-purpose type) run inside this session and forward their results back to you reliably.
General-purpose subagents are allowed.
Caveat:
you cannot enumerate how many subagents are running,
and SendMessage steering is unreliable,
so fan out general-purpose subagents only in interactive sessions where the user watches and steers them in the Claude Code UI.
Rationale:
\`doc/decision/general-purpose-subagent-ban.md\`.

Use \`spawn-claude\` outside sandbox to launch a steerable child Claude Code session in a visible terminal window.
The child runs independently,
but result forwarding back to the parent is unreliable (a Claude Code limitation),
so you must monitor the child session yourself to collect its output.
Do not pass \`--cwd\`:
the child then will not read the repo \`CLAUDE.md\`,
and Claude Code's cwd handling is unreliable.

Use \`timeout 3600 pi --model openai-codex/gpt-5.6-sol --print --no-tools --no-skills --no-themes --thinking xhigh "<question>"\` alongside advisor,
never instead:
advisor reads the transcript,
sol reads only what you paste.
Paste whole files,
never prose.
\`timeout\` here takes SECONDS.
Background it;
never poll or kill it;
it may never return.

${await cat(['./AGENTS.md',],)}`,
  },),

  generateMiseToml(),

  generateForbiddenStringsRules(),

  overwrite({
    dest: './package/git-policy/cli/src/optional/repository-policy.ts',
    content: `// Generated from \`package/git-policy/repository/src/index.ts\` by file-enforcer; edit canonical source owner.\n${(await cat([
      './package/git-policy/repository/src/index.ts',
    ],))
      .replace(
        '@monochromatic-dev/git-policy-api/ts',
        '../api/index.ts',
      )}`,
  },),

  ...await Promise.all([
    'errors.ts',
    'index.ts',
    'materialize-candidates.ts',
    'scan-candidates.ts',
    'scanner-output.ts',
  ].map(async function mirrorForbiddenStringsPolicy(fileName,) {
    return overwrite({
      dest: `./package/git-policy/cli/src/optional/forbidden-strings/${fileName}`,
      content: `// Generated from \`package/git-policy/forbidden-strings/src/${fileName}\` by file-enforcer; edit canonical source owner.\n${(await cat([
        `./package/git-policy/forbidden-strings/src/${fileName}`,
      ],))
        .replace(
          '@monochromatic-dev/git-policy-api/ts',
          '../../api/index.ts',
        )}`,
    },);
  },),),

  generatePackageLicenseTexts(),

  generateCargoManifests(),

  generateResolvedBrowserslistTargets(),

  manageHarperLsp4ij(),

  mirrorSkills(),
  // Oxlint config: root oxlint.config.ts imports @monochromatic-dev/config-oxlint and adds jsPlugins.
  // JS plugins (tsdoc, no-restricted-syntax, stylistic) are referenced by path from the root config.
],);

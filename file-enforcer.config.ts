import {
  cat,
  overwrite,
  overwriteEach,
} from '@monochromatic-dev/dev-script-file-enforcer/ts';
import { glob, } from 'node:fs/promises';
import { homedir, } from 'node:os';
import {
  dirname,
  join,
} from 'node:path';

/**
 * Generates mise.toml from mise.no-env.toml with a dynamic [env] section
 * containing _.path entries for all workspace package bin directories.
 */
async function generateMiseToml(): Promise<void> {
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
        return `"${dir}"`;
      },)
      .join(',\n',)
  }
]
`;
  await overwrite(
    './mise.toml',
    `# Generated from mise.no-env.toml by file-enforcer.
${await cat(['./mise.no-env.toml',],)}
${envSection}`,
  );
}

/**
 * Extracts the `entry` string array from a tsdown config file.
 *
 * Two patterns are handled:
 *
 * 1. **Literal array**: `entry: [ './src/index.ts', './src/filter.ts' ]`
 *    Parsed via regex.
 * 2. **Pure re-export of a base config**:
 *    `export { default } from '@monochromatic-dev/config-tsdown/.client.ts';`
 *    The base config's default `entry` is inferred from which file is
 *    re-exported -- `.client.ts` defaults to `src/client.ts`, all other
 *    bases (`.node.ts`, `.ts`, `.browser.ts`) default to `src/index.ts`.
 *    See `packages/config/tsdown/src/index*.ts` for the upstream defaults.
 *
 * Computed entries or configs that spread the base and add extra entries
 * via JS logic are not handled; those would need an evaluator.
 *
 * @param source - Source code of the tsdown config file.
 * @returns Entry paths relative to the package directory, with leading
 *   `./` stripped. Empty array if neither pattern matches.
 *
 * @example
 * ```typescript
 * extractTsdownEntries(`defineConfig({ entry: ['./src/index.ts', './src/cli.ts'] })`);
 * // ['src/index.ts', 'src/cli.ts']
 *
 * extractTsdownEntries(`export { default } from '@monochromatic-dev/config-tsdown/.client.ts';`);
 * // ['src/client.ts']
 * ```
 */
function extractTsdownEntries(source: string,): string[] {
  const arrayMatch = source.match(/entry:\s*\[([\s\S]*?)\]/,);
  if (arrayMatch !== null) {
    const stringRegex = /['"`]([^'"`]+)['"`]/g;
    const entries: string[] = [];
    for (const m of arrayMatch[1].matchAll(stringRegex,)) {
      const raw = m[1];
      entries.push(raw.startsWith('./',) ? raw.slice(2,) : raw,);
    }
    return entries;
  }
  if (/from\s+['"`]@monochromatic-dev\/config-tsdown\/\.client\.ts['"`]/.test(source,)) {
    return ['src/client.ts',];
  }
  if (/from\s+['"`]@monochromatic-dev\/config-tsdown(?:\/\.[a-z]+\.ts|\/\.ts|)['"`]/.test(source,)) {
    return ['src/index.ts',];
  }
  return [];
}

/**
 * Generates `.fallowrc.json` by merging a static base config with entries
 * dynamically discovered from every `tsdown.*.config.ts` file in the workspace.
 *
 * Closes the gap between fallow's built-in tsdown plugin (which only matches
 * `tsdown.config.{ts,js,cjs,mjs}`) and this monorepo's convention of splitting
 * bundle targets into `tsdown.client.config.ts` / `tsdown.node.config.ts`
 * per package. Without this, any `.ts` file referenced only by a
 * non-default-named tsdown config is reported as unused by fallow.
 *
 * Disables fallow rules that overlap with oxlint or that oxc explicitly
 * declined as inherently noisy (`circular-dependencies`, `unresolved-imports`).
 *
 * @example
 * ```bash
 * bun file-enforcer.config.ts
 * bunx fallow --summary
 * ```
 */
async function generateFallowConfig(): Promise<void> {
  const tsdownConfigs = await Array.fromAsync(
    glob('packages/*/*/tsdown.*.config.ts',),
  );
  const dynamicEntries: string[] = [];
  for (const configPath of tsdownConfigs) {
    const source = await Bun.file(configPath,).text();
    const packageDir = dirname(configPath,);
    for (const entry of extractTsdownEntries(source,)) {
      dynamicEntries.push(join(packageDir, entry,),);
    }
  }
  dynamicEntries.sort();
  const config = {
    $schema: 'https://raw.githubusercontent.com/fallow-rs/fallow/main/schema.json',
    entry: [
      'src/index.{ts,tsx,js,jsx}',
      'src/main.{ts,tsx,js,jsx}',
      '**/mise.*.ts',
      '**/tsdown.*.config.{ts,js,cjs,mjs}',
      '**/src/cli.ts',
      'oxlint.config.ts',
      'oxlint-require-tsdoc.ts',
      'file-enforcer.config.ts',
      'playwright.*.config.ts',
      'vitest.config.ts',
      'vitest.workspace.ts',
      ...dynamicEntries,
    ],
    dynamicallyLoaded: [
      'packages/desktop-daemon/editord/src/client/**/*.ts',
      'packages/dev-script/inference-canary-viewer/src/client/**/*.ts',
      'packages/webapp-content/ssg-test/src/client/**/*.ts',
      'packages/webapp-productivity/done/src/client/**/*.ts',
      'packages/webapp-productivity/done-h-css-test/src/client/**/*.ts',
      'packages/webapp-productivity/doodle-widget/src/client/**/*.ts',
      'packages/webapp-search/exa-search/src/client*.ts',
      '**/*.css',
      '**/*.html',
    ],
    ignorePatterns: [
      '**/*.generated.ts',
      '**/dist/**',
      '**/node_modules/**',
      '**/.fallow/**',
      'packages/dev-script/file-enforcer/data/packages.generated.ts',
      'packages/duik/teto-generated/**',
    ],
    workspaces: { packages: ['packages/*/*',], },
    overrides: [
      {
        files: ['packages/test-fixture/**',],
        rules: {
          'unused-exports': 'off',
          'unused-files': 'off',
          'unused-types': 'off',
          'duplicate-exports': 'off',
        },
      },
      {
        files: ['packages/module/es/src/types/**',],
        rules: {
          'duplicate-exports': 'off',
          'unused-exports': 'off',
          'unused-files': 'off',
        },
      },
    ],
    rules: {
      'unused-dependencies': 'warn',
      'circular-dependencies': 'off',
      'unresolved-imports': 'off',
    },
  };
  await overwrite(
    './.fallowrc.json',
    `${JSON.stringify(config, null, 2,)}\n`,
  );
}

/**
 * Mirrors canonical skills from .agents/skills/ to .factory/skills/ and .claude/skills/
 * for legacy consumers.
 */
async function mirrorSkills(): Promise<void> {
  const skills = await cat('./.agents/skills/*/*.md',);
  await Promise.all([
    overwriteEach(
      './.factory/skills/*/*.md',
      skills,
    ),
    overwriteEach(
      './.claude/skills/*/*.md',
      skills,
    ),
  ],);
}

await Promise.all([
  // CLAUDE.md must literally contain AGENTS.md content (Claude Code's @include is unreliable)
  overwrite(
    './CLAUDE.md',
    `Generated from AGENTS.md by file-enforcer.
${await cat(['./AGENTS.md',],)}`,
  ),

  generateMiseToml(),

  generateFallowConfig(),

  mirrorSkills(),
  // Oxlint config: root oxlint.config.ts imports @monochromatic-dev/config-oxlint and adds jsPlugins.
  // JS plugins (tsdoc, no-restricted-syntax, stylistic) are referenced by path from the root config.
],);

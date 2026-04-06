import {
  cat,
  overwrite,
  overwriteEach,
} from '@monochromatic-dev/dev-script-file-enforcer/ts';
import { glob, } from 'node:fs/promises';
import { homedir, } from 'node:os';
import { join, } from 'node:path';

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

/**
 * Syncs spinner verbs from the curated word list to Claude Code settings.
 * Reads TODO.claude-code-words.contents.txt, capitalizes each word,
 * and sets `spinnerVerbs` in ~/.claude/settings.json with mode "replace".
 *
 * @example
 * // After editing TODO.claude-code-words.contents.txt, run file-enforcer to sync:
 * // mise run file-enforcer
 */
async function syncSpinnerVerbs(): Promise<void> {
  const wordsContent = await cat(['./TODO.claude-code-words.contents.txt',],);
  const verbs = wordsContent
    .split('\n',)
    .map(function trim(line,): string {
      return line.trim();
    },)
    .filter(function nonEmpty(line,): boolean {
      return line.length > 0;
    },)
    .map(function capitalize(word,): string {
      return word.charAt(0,).toUpperCase() + word.slice(1,);
    },);

  const settingsPath = join(homedir(), '.claude', 'settings.json',);
  const settingsRaw = await cat([settingsPath,],);
  const settings = JSON.parse(settingsRaw,) as Record<string, unknown>;
  settings.spinnerVerbs = { mode: 'replace', verbs, };

  await overwrite(settingsPath, JSON.stringify(settings, null, 2,) + '\n',);
}

await Promise.all([
  // CLAUDE.md must literally contain AGENTS.md content (Claude Code's @include is unreliable)
  overwrite(
    './CLAUDE.md',
    `Generated from AGENTS.md by file-enforcer.
${await cat(['./AGENTS.md',],)}`,
  ),

  generateMiseToml(),

  mirrorSkills(),

  syncSpinnerVerbs(),
  // Oxlint config: root oxlint.config.ts imports @monochromatic-dev/config-oxlint and adds jsPlugins.
  // JS plugins (tsdoc, no-restricted-syntax, stylistic) are referenced by path from the root config.
],);

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

await Promise.all([
  // CLAUDE.md must literally contain AGENTS.md content (Claude Code's @include is unreliable)
  overwrite(
    './CLAUDE.md',
    `Generated from AGENTS.md by file-enforcer.
    
    ### Spawning child Claude sessions

General purpose agents are banned because of bugs.

Use \`spawn-claude\` outside sandbox to launch steerable child Claude Code sessions in visible terminal windows.
The child session runs independently; results are forwarded back to the parent automatically via hooks.

\`\`\`bash
spawn-claude "implement feature X"
spawn-claude --cwd /some/path "fix the bug in module Y"
spawn-claude --extra-arguments "--model sonnet" "refactor this module"
\`\`\`

The command prints \`{"spawnId":"<uuid>"}\` on success.
Completed child results are injected into context automatically between tool calls.

${await cat(['./AGENTS.md',],)}`,
  ),

  generateMiseToml(),

  mirrorSkills(),
  // Oxlint config: root oxlint.config.ts imports @monochromatic-dev/config-oxlint and adds jsPlugins.
  // JS plugins (tsdoc, no-restricted-syntax, stylistic) are referenced by path from the root config.
],);

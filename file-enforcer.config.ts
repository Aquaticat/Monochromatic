import { glob, } from 'node:fs/promises';
import {
  cat,
  overwrite,
  overwriteEach,
} from '@monochromatic-dev/dev-script-file-enforcer/ts';

await Promise.all([
  // CLAUDE.md must literally contain AGENTS.md content (Claude Code's @include is unreliable)
  overwrite(
    './CLAUDE.md',
    await cat(['./AGENTS.md',],),
  ),

  // mise.toml = mise.no-env.toml + generated [env] section with dynamic _.path
  (async (): Promise<void> => {
    const base = await cat(['./mise.no-env.toml',],);
    const binDirs: string[] = [];
    for await (const dir of glob('packages/*/*/node_modules/.bin',)) {
      binDirs.push(dir,);
    }
    binDirs.sort();
    const pathEntries = [
      '  "node_modules/.bin"',
      ...binDirs.map(function quote(dir,): string {
        return `  "${dir}"`;
      },),
    ].join(',\n',);
    const envSection = `[env]
# .env file is optional - mise silently ignores missing files
# https://github.com/jdx/mise/blob/main/src/config/env_directive/file.rs#L155-L163
_.file = [{ path = ".env", redact = true }, { path = ".env.local", redact = true }]
_.path = [
${pathEntries},
]
`;
    await overwrite('./mise.toml', `${base}\n${envSection}`,);
  })(),

  // Canonical skills live in .agents/skills/; mirror them to .factory/skills/ for legacy consumers
  (async (): Promise<void> => {
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
  })(),
  // Oxlint config: root oxlint.config.ts imports @monochromatic-dev/config-oxlint and adds jsPlugins.
  // JS plugins (tsdoc, no-restricted-syntax, stylistic) are referenced by path from the root config.
],);

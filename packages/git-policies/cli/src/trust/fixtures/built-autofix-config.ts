/**
 * Trusted packed autofix fixture configuration.
 *
 * @module
 */
import { writeFile, } from 'node:fs/promises';

/**
 * Writes trusted fixture policy with canonical, composition, failure, and overlap modes.
 *
 * @param repository - disposable repository
 *
 * @example
 * ```ts
 * await writeAutofixConfig('/work/repo');
 * ```
 */
export async function writeAutofixConfig(repository: string,): Promise<void> {
  /**
   * Repository-root config path.
   */
  const configPath = `${repository}/cli-git.config.mjs`;
  await writeFile(
    configPath,
    `export default {
  plugins: {
    fixture: {
      name: 'fixture',
      policies: [{
        name: 'canonical',
        defaultSeverity: 'error',
        warnSafe: false,
        triggers: ['pre-forward'],
        check: async ({ context }) => {
          const candidates = await context.git.candidates();
          const candidate = candidates.find(({ path }) => path === 'selected.txt');
          if (candidate === undefined) return [];
          const value = new TextDecoder().decode(await candidate.bytes());
          if (value === 'good\\n') return [];
          if (value === 'throw\\n') throw new Error('fixture autofix failure');
          if (typeof candidate.revision === 'symbol') throw new Error('fixture needs tracked candidate');
          const oldLines = value.endsWith('\\n')
            ? value.slice(0, -1).split('\\n')
            : value.split('\\n');
          const finding = (replacement) => {
            const patch = [
              'diff --git a/selected.txt b/selected.txt',
              'index ' + candidate.revision + '..0000000000000000000000000000000000000000 100644',
              '--- a/selected.txt',
              '+++ b/selected.txt',
              '@@ -1,' + oldLines.length + ' +1 @@',
              ...oldLines.map((line) => '-' + line),
              '+' + replacement,
              '',
            ].join('\\n');
            return {
              code: 'noncanonical',
              message: 'selected content is not canonical',
              path: candidate.path,
              patch: {
                kind: 'git-unified',
                targetId: candidate.targetId,
                path: candidate.path,
                bytes: new TextEncoder().encode(patch),
              },
            };
          };
          return value === 'overlap\\n'
            ? [finding('first'), finding('second')]
            : [finding('good')];
        },
      }, {
        name: 'companion',
        defaultSeverity: 'error',
        warnSafe: false,
        triggers: ['pre-forward'],
        check: async ({ context }) => {
          const candidates = await context.git.candidates();
          const candidate = candidates.find(({ path }) => path === 'companion.txt');
          if (candidate === undefined) return [];
          const value = new TextDecoder().decode(await candidate.bytes());
          if (value === 'good companion\\n') return [];
          if (typeof candidate.revision === 'symbol') throw new Error('fixture needs tracked companion');
          const patch = [
            'diff --git a/companion.txt b/companion.txt',
            'index ' + candidate.revision + '..0000000000000000000000000000000000000000 100644',
            '--- a/companion.txt',
            '+++ b/companion.txt',
            '@@ -1 +1 @@',
            '-' + value.slice(0, -1),
            '+good companion',
            '',
          ].join('\\n');
          return [{
            code: 'companion-noncanonical',
            message: 'companion content is not canonical',
            path: candidate.path,
            patch: {
              kind: 'git-unified',
              targetId: candidate.targetId,
              path: candidate.path,
              bytes: new TextEncoder().encode(patch),
            },
          }];
        },
      }],
    },
  },
};
`,
  );
}

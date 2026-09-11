import { mkdtemp, rm, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import { fileURLToPath, } from 'node:url';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import spawn, { SubprocessError, } from 'nano-spawn';

/** Native compiled CLI, never a source import. */
const CLI = fileURLToPath(new URL('../dist/final/node/judge-fidelity-probe.mjs', import.meta.url));

/** Runs only zero-call preflight in an owned empty runs directory. */
async function preflight(extra: readonly string[]) {
  const directory = await mkdtemp(join(tmpdir(), 'reviewed-fidelity-cli-'));
  await using owned = { [Symbol.asyncDispose]: async () => {
    await rm(directory, { recursive: true, force: true });
  } };
  const options = { cwd: directory, env: {
    TRANSLATION_REPAIR_RUNS_DIR: directory,
    TRANSLATION_REPAIR_CORPUS_CLONE_DIR: directory,
    TRANSLATION_REPAIR_SYNTHETIC_API_KEY: 'fixture-only',
    TRANSLATION_REPAIR_CHARM_HYPER_API_KEY: '',
    TRANSLATION_REPAIR_OPENROUTER_API_KEY: '',
    TRANSLATION_REPAIR_AMAZON_BEDROCK_API_KEY: '',
  } };
  try {
    const result = await spawn(process.execPath, [CLI, '--cap', '0', '--candidates', 'deepseek-v4.1-flash', '--candidates-alone', ...extra], options);
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    if (!(error instanceof SubprocessError)) throw error;
    return { code: error.exitCode, stdout: error.stdout, stderr: error.stderr };
  }
}

await describe({
  name: '',
  children: [
    it({
      name: 'refuses an entry with no reviewed reference before any corpus or provider access',
      fn: async () => {
        const result = await preflight(['--only', 'not-reviewed-fixture']);
        expect(result.code).not.toBe(0);
        expect(result.stderr).toContain('reviewed fidelity reference');
        expect(result.stderr).toContain('request verification');
      },
    }),
    it({
      name: 'refuses unreviewed context rather than silently changing the meaning of a gold comparison',
      fn: async () => {
        const result = await preflight(['--context']);
        expect(result.code).not.toBe(0);
        expect(result.stderr).toContain('reviewed fidelity reference');
      },
    }),
    it({
      name: 'keeps zero-call candidate preflight distinct from a successful quality measurement',
      fn: async () => {
        const result = await preflight([]);
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('deepseek-v4.1-flash');
        expect(result.stdout).toContain('preflight only');
        expect(result.stdout).not.toContain('SPEND ');
      },
    }),
  ],
});

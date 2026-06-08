/**
 * Post-commit auto-push with a quiet success path.
 *
 * @remarks
 * Invoked by the hk `post-commit` hook (`node hk.auto-push.ts`). Pushes the
 * just-created commit to its upstream, creating the upstream branch on first
 * push via `--set-upstream origin HEAD`. On success only GitHub `remote:` lines
 * are printed; on failure the full push output is printed so a rejection, a
 * forbidden-strings block, or an offline error stays diagnosable. The push exit
 * code is propagated through {@link process.exitCode} so hk reports a failed
 * push as a failed step.
 *
 * Raw `console` rather than a tagged logger is intentional: the output must be
 * exactly git's lines with no tag prefixes. The command is passed to `shell:
 * true` as one fixed string (no args array) so Node resolves the `git` shim on
 * every platform, including Windows `.cmd`, without the DEP0190 warning that
 * args-plus-shell triggers; the string is a constant, so there is no injection
 * surface.
 */
import { spawnSync } from 'node:child_process';

/** Captured stdout, stderr, and exit status of the push. */
const result = spawnSync('git push --set-upstream origin HEAD', {
  encoding: 'utf8',
  shell: true,
});

if (result.error) {
  console.error(result.error.message);
  process.exitCode = 1;
} else {
  /**
   * Merged stdout and stderr of the push: git sends `remote:` lines, `To <url>`,
   * progress, and the nested pre-push hook output all to stderr, so both streams
   * must be joined before filtering.
   */
  const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;

  /** Push exit status; absent status (killed by signal) counts as failure. */
  const code = result.status ?? 1;

  /** On success, only the GitHub `remote:` lines; on failure, the full output. */
  const shown = code === 0
    ? combined
      .split('\n')
      .filter((line) => line.startsWith('remote: '))
      .join('\n')
    : combined;

  if (shown) {
    console.error(shown);
  }

  process.exitCode = code;
}

// The nested compositor every IDE check hosts the application in.
// What: the name to spawn (resolved through PATH, where mise installs the `cargo:monochromatic-nested-wayland-session`
// tool) and a check that the resolved build is current.
// Why: a build inside each worktree's target directory goes stale. A 0.1.1 copy kept running in several worktrees
// after 0.1.2 made the window launch minimized, and every check run through it opened a visible window on the user's
// desktop. The mise tool is one copy that `mise install` keeps current.
import { spawnSync } from 'node:child_process';

export const compositor = 'monochromatic-nested-wayland-session';

// 0.4.0 is the oldest version these checks have run against that launches the window minimized.
export const oldestCompositor = [0, 4, 0];

// Throws when no compositor is on PATH or the one found is older than `oldestCompositor`.
export function demandCurrentCompositor() {
  const result = spawnSync(compositor, ['--version'], { encoding: 'utf8' });
  if (result.error) {
    throw new Error('The nested compositor is not on PATH (' + result.error.message + '). Run `mise install`'
      + ' so the cargo:monochromatic-nested-wayland-session tool is installed, and start the check through `mise run`.');
  }
  const found = /(\d+)\.(\d+)\.(\d+)/.exec(result.stdout);
  if (found === null) throw new Error('Could not read a version from `' + compositor + ' --version` (status ' + result.status + '): '
      + result.stdout + result.stderr);
  const version = found.slice(1).map(Number);
  const older = oldestCompositor.reduce((verdict, part, index) => verdict ?? (version[index] === part ? null : version[index] < part), null);
  if (older === true) {
    throw new Error('The nested compositor on PATH is ' + version.join('.') + ', older than ' + oldestCompositor.join('.')
      + '. Older builds open a visible window on the host desktop. Run `mise install` to update the tool.');
  }
}

import {
  cat,
  overwrite,
  overwriteEach,
} from '@monochromatic-dev/dev-script-file-enforcer/ts';

// CLAUDE.md must literally contain AGENTS.md content (Claude Code's @include is unreliable)
await overwrite('./CLAUDE.md', await cat(['./AGENTS.md']));

// Canonical skills live in .agents/skills/; mirror them to .factory/skills/ for legacy consumers
await overwriteEach('./.factory/skills/*/*.md', './.agents/skills/*/*.md', await cat('./.agents/skills/*/*.md'));

// Oxlint config lives in the config package; copy canonical files to monorepo root
// await overwrite('./.oxlintrc.json', await cat(['./packages/config/oxlint/.oxlintrc.json']));
// Oxlint TSDoc plugin now lives at packages/config/oxlint-tsdoc and is referenced directly from .oxlintrc.json

import {
  cat,
  overwrite,
} from '@monochromatic-dev/dev-script-file-enforcer/ts';

// CLAUDE.md must literally contain AGENTS.md content (Claude Code's @include is unreliable)
await overwrite('./CLAUDE.md', await cat(['./AGENTS.md']));

// Oxlint config lives in the config package; copy canonical files to monorepo root
// await overwrite('./.oxlintrc.json', await cat(['./packages/config/oxlint/.oxlintrc.json']));
// await overwrite('./oxlint-require-tsdoc.ts', await cat(['./packages/config/oxlint/oxlint-require-tsdoc.ts']));

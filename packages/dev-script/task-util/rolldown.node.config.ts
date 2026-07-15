import { nodeConfig,
  type NodeFlavorConfig,
} from '@monochromatic-dev/config-rolldown/.node.ts';

/**
 * Node-side rolldown build for `dev-script-task-util`.
 *
 * Six bin entries, one per declared `bin` (task-command, task-append,
 * task-depends, task-oxlint, task-pnpm, task-tsc). Each lands under
 * `dist/final/node/` as `.mjs` with its shebang preserved. node-only
 * (node:fs/node:path, shells out to oxlint/tsc/pnpm). `package.json#bin`
 * still resolves to these built files for normal shell use. Bootstrap-critical
 * mise tasks use inline `node -e` dispatch (runWorkspaceNode) to call the built
 * file directly when present, otherwise the matching TypeScript source, so they
 * do not depend on pnpm `.bin` shims.
 */
const config: NodeFlavorConfig = nodeConfig({
  input: [
      './src/command.ts',
      './src/append.ts',
      './src/depends.ts',
      './src/oxlint-wrapper.ts',
      './src/pnpm-filter.ts',
      './src/tsc-filter.ts',
    ],
},);

export default config;

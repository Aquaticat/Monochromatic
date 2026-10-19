/**
 Runtime installation scripts and execution commands.

 Each supported JS runtime has an install script (fetched via curl)
 and a command pattern for executing test files.
 */

import type { Runtime, } from './types.ts';

//region Runtime install scripts

/**
 Shell fragment that installs mise, the version manager used to install node.
 */
const MISE_INSTALL = 'curl -fsSL https://mise.run | sh';

/**
 Puts mise on `PATH` for the rest of the container shell;
 `mise.run` installs the binary under `$HOME/.local/bin`.
 */
const MISE_PATH = 'export PATH="$HOME/.local/bin:$PATH"';

/**
 mise flags shared by the node install and exec commands.
 `MISE_TRUSTED_CONFIG_PATHS` trusts the repo mount so mise reads `mise.toml`;
 `MISE_SOPS_STRICT` keeps a checkout with a gitignored `.env.local.json`
 from failing when the age key that decrypts it is absent in the container.
 */
const MISE_CONFIG_ENV = 'MISE_QUIET=1 MISE_TERMINAL_PROGRESS=false MISE_SOPS_STRICT=false MISE_TRUSTED_CONFIG_PATHS=/workspace';

/**
 Install commands for each supported runtime.
 All use curl to fetch an installer script and pipe to a shell.

 Post-install, the runtime binary is available at a predictable path
 under `$HOME` (bun: `$HOME/.bun/bin/bun`, deno: `$HOME/.deno/bin/deno`).
 The node entry instead bootstraps mise in `/workspace` and installs node
 from the mounted repo config, never from a hardcoded version.
 */
const RUNTIME_INSTALL: Record<Runtime, string> = {
  bun: 'curl -fsSL https://bun.sh/install | bash',
  deno: 'curl -fsSL https://deno.land/install.sh | sh',
  node: `${MISE_INSTALL} && ${MISE_PATH} && cd /workspace && ${MISE_CONFIG_ENV} mise install node`,
};

/**
 Absolute path to the runtime binary after installation.
 Uses `$HOME` variable so it resolves correctly for both root and non-root users.
 Node has no such fixed path: it runs through `mise exec`, see {@link runtimeExecCommand}.
 */
const RUNTIME_BIN: Record<Exclude<Runtime, 'node'>, string> = {
  bun: '$HOME/.bun/bin/bun',
  deno: '$HOME/.deno/bin/deno',
};

/**
 Returns the shell command to install a JS runtime inside a container.

 @param runtime - Runtime to install

 @returns shell command string

 @example
 ```ts
 runtimeInstallCommand('bun');
 // 'curl -fsSL https://bun.sh/install | bash'

 runtimeInstallCommand('node');
 // 'curl -fsSL https://mise.run | sh && export PATH="$HOME/.local/bin:$PATH" && cd /workspace && MISE_SOPS_STRICT=false MISE_TRUSTED_CONFIG_PATHS=/workspace mise install node'
 ```
 */
export function runtimeInstallCommand(runtime: Runtime,): string {
  return RUNTIME_INSTALL[runtime];
}

/**
 Returns the shell command to execute a file with the given runtime.

 Node is executed through `mise exec`, which resolves the version installed
 from the repo config and runs it against the file.

 @param runtime - Runtime to use

 @param filePath - Absolute path to the file inside the container

 @returns shell command string

 @example
 ```ts
 runtimeExecCommand({ runtime: 'bun', filePath: '/workspace/test.ts' });
 // '$HOME/.bun/bin/bun run /workspace/test.ts'

 runtimeExecCommand({ runtime: 'node', filePath: '/workspace/test.ts' });
 // 'MISE_SOPS_STRICT=false MISE_TRUSTED_CONFIG_PATHS=/workspace $HOME/.local/bin/mise exec node -- node /workspace/test.ts'
 ```
 */
export function runtimeExecCommand({
  runtime,
  filePath,
}: {
  readonly runtime: Runtime;
  readonly filePath: string;
},): string {
  if (runtime === 'node') {
    return `${MISE_CONFIG_ENV} $HOME/.local/bin/mise exec node -- node ${filePath}`;
  }

  /**
   Captured for reuse across the deno-specific and default branches below.
   */
  const bin = RUNTIME_BIN[runtime];

  if (runtime === 'deno')
    return `${bin} run --allow-all ${filePath}`;

  return `${bin} run ${filePath}`;
}

//endregion Runtime install scripts

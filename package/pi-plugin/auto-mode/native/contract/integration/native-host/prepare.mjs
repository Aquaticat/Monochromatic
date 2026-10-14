import {
  readFileSync,
  writeFileSync
} from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sdk } from '../current-sdk/paths.ts';

export class NativeHostBuildError extends Error {}

//region Exact upstream call sites route through the maintained constructor owner.

function replaceOnce({
  source,
  before,
  after
}) {
  if (source.split(before)
    .length
    !== 2)
    throw new NativeHostBuildError(`Native host transformation requires exactly one original call site: ${  before}`);
  return source.replace(
    before,
    after
  );
}

/** Rebase static imports and native dynamic imports without changing their selection. */
function rebase({
  source,
  original
}) {
  return source.replaceAll(
    /(from |import\()(["'])(\.[^"']+)\2/gu,
    (
      _match,
      prefix,
      quote,
      specifier
    ) => prefix + quote
      + new URL(
        specifier,
        original
      ).href
      + quote
  );
}

export function prepareNativeHost({ output }) {
  const bootstrap = JSON.stringify(new URL(
    'bootstrap.mjs',
    import.meta.url
  ).href);
  const reload = JSON.stringify(new URL(
    'resource-reload.mjs',
    import.meta.url
  ).href);
  const paths = {
    main: 'main.js',
    services: 'core/agent-session-services.js',
    runtime: 'core/agent-session-runtime.js',
    codemode: 'extensions/codemode/index.js',
  };
  for (const [name, relative] of Object.entries(paths)) {
    const path = join(
      sdk,
      'dist',
      relative
    );
    let source = readFileSync(
      path,
      'utf8'
    );
    if (name === 'main') {
      source = replaceOnce({
        source,
        before: 'import chalk from "chalk";',
        after: `import chalk from ${  JSON.stringify(pathToFileURL(createRequire(path)
          .resolve('chalk'))
          .href)  };`
      });
      source = replaceOnce({
        source,
        before: 'import { assertValidSessionId, SessionManager } from "./core/session-manager.js";',
        after: `import { assertValidSessionId } from "./core/session-manager.js";\n`
          + `import { ownedManagers as SessionManager } from ${  bootstrap  };`
      });
    } else if (name === 'runtime') {
      source = replaceOnce({
        source,
        before: 'import { SessionManager } from "./session-manager.js";',
        after: `import { ownedManagers as SessionManager, disposeHostSession } from ${  bootstrap  };`
      });
      const disposal = '        this.session.dispose();';
      if (source.split(disposal)
        .length
        !== 3)
        throw new NativeHostBuildError('Native runtime must retain both replacement and terminal disposal calls');
      source = source.replaceAll(
        disposal,
        '        await disposeHostSession(this.session);'
      );
    } else if (name === 'codemode') {
      const definition = JSON.stringify(pathToFileURL(join(
        output,
        'program-definition.mjs'
      ))
        .href);
      source = replaceOnce({
        source,
        before: 'import { createCodemodeToolDefinition } from "./tool.js";',
        after: `import { createOwnedCodemodeDefinition as createCodemodeToolDefinition } from ${  definition  };`
      });
      source = replaceOnce({
        source,
        before: '        pi.registerTool({\n            ...createCodemodeToolDefinition({',
        after: '        pi.registerTool(createCodemodeToolDefinition({'
      });
      source = replaceOnce({
        source,
        before: '            }),\n            defaultActive: false,\n        });',
        after: '            }));'
      });
    } else {
      source = replaceOnce({
        source,
        before: 'import { DefaultResourceLoader, } from "./resource-loader.js";',
        after: `import { createHostResourceLoader, createHostSession as createAgentSession } from ${  bootstrap  };\n`
          + `import { reloadHostResource } from ${  reload  };`
      });
      source = replaceOnce({
        source,
        before: 'import { createAgentSession } from "./sdk.js";',
        after: ''
      });
      source = replaceOnce({
        source,
        before: 'new DefaultResourceLoader({',
        after: 'createHostResourceLoader({'
      });
      source = replaceOnce({
        source,
        before: 'await resourceLoader.reload(options.resourceLoaderReloadOptions);',
        after: 'await reloadHostResource(resourceLoader, options.resourceLoaderReloadOptions);'
      });
    }
    writeFileSync(
      join(
        output,
        `host-${  name  }.mjs`
      ),
      rebase({
        source,
        original: pathToFileURL(path)
      }),
      { mode: 0o600 }
    );
  }
}

//endregion

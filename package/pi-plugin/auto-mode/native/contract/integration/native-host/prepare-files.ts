/**
 Capture and emit the finite qualified host module set around pure native source transformations.

 @module
 */
import {
  readFile,
  writeFile
} from 'node:fs/promises';
import { join } from 'node:path';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { sdk } from '../current-sdk/paths.ts';

//region The qualified module set is fixed before source transformation

/**
 Original upstream entry points required by native host ownership.
 */
const modules = [
  {
    name: 'main',
    relative: 'main.js'
  },
  {
    name: 'services',
    relative: 'core/agent-session-services.js'
  },
  {
    name: 'runtime',
    relative: 'core/agent-session-runtime.js'
  },
  {
    name: 'codemode',
    relative: 'extensions/codemode/index.js'
  },
] as const;

/**
 Closed module identities cannot introduce an arbitrary output pathname.
 */
type NativeHostModuleName = (typeof modules)[number]['name'];

/**
 Source bytes retain their original path for dependency rebasing.
 */
export type NativeHostSource = {
  /**
   Qualified upstream entry point.
   */
  readonly name: NativeHostModuleName;
  /**
   Original resolution base.
   */
  readonly path: string;
  /**
   Original module bytes before any source transformation.
   */
  readonly source: string;
};

/**
 Transformed source is emitted only after all original call-site checks finish.
 */
export type NativeHostOutput = {
  /**
   Qualified generated module name.
   */
  readonly name: NativeHostModuleName;
  /**
   Source preserving the maintained native owner connections.
   */
  readonly source: string;
};

/**
 File diagnostics remain attributable to this finite build stage.
 */
const l = tagged({ tag: 'auto-mode-native-host-files' });

/**
 Read the independent qualified inputs before synchronous transformations inspect them.

 @returns original module sources with their native resolution bases

 @example
 ```ts
 const sources = await readNativeHostSources();
 ```
 */
export async function readNativeHostSources(): Promise<readonly NativeHostSource[]> {
  /**
   Each input read retains the enclosing capture boundary.
   */
  const rl = tagged({
    tag: readNativeHostSources.name,
    l
  });
  rl.debug('capturing qualified native host sources');
  return await Promise.all(modules.map(async function readHostModule({
    name,
    relative
  }): Promise<NativeHostSource> {
    /**
     Original file reads have their own diagnostic boundary.
     */
    const readLog = tagged({
      tag: readHostModule.name,
      l: rl
    });
    /**
     Only fixed upstream paths participate in this capture.
     */
    const path = join(
      sdk,
      'dist',
      relative
    );
    readLog.debug(`reading original host module: ${name}`);
    return {
      name,
      path,
      source: await readFile(
        path,
        'utf8'
      )
    };
  }));
}

/**
 Emit independent module files only after their original source checks succeed.

 @param output - native generated module directory

 @param sources - validated transformed modules with closed output names

 @example
 ```ts
 await writeNativeHostSources({ output, sources });
 ```
 */
export async function writeNativeHostSources({
  output,
  sources
}: {
  readonly output: string;
  readonly sources: readonly NativeHostOutput[];
}): Promise<void> {
  /**
   Each output write retains its enclosing emission boundary.
   */
  const rl = tagged({
    tag: writeNativeHostSources.name,
    l
  });
  rl.debug('writing validated native host modules');
  await Promise.all(sources.map(async function writeHostModule({
    name,
    source
  }): Promise<void> {
    /**
     Each generated file has a separate diagnostic boundary.
     */
    const writeLog = tagged({
      tag: writeHostModule.name,
      l: rl
    });
    writeLog.debug(`writing generated host module: ${name}`);
    await writeFile(
      join(
        output,
        `host-${name}.mjs`
      ),
      source,
      { mode: 0o600 }
    );
  }));
}

//endregion The qualified module set is fixed before source transformation

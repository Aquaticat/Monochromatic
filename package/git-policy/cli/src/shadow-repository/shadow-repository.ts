/**
 Per-transaction shadow repository at `<git-common-dir>/cli-git/shadow/<transaction-id>`.

 The shadow is a separate repository rather than a registered worktree,
 so `git worktree list` never shows it and preparation creates no ref in the real repository.
 Its own object store receives the objects native `git commit` writes,
 and `objects/info/alternates` names the real object directory,
 so a real `git prune` cannot delete a pending commit
 and a prune inside the shadow cannot delete real objects.

 @module
 */
import {
  chmod,
  mkdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  type InvocationCapture,
  shadowRepositoryPath,
} from '../policy-engine/commit-transaction-capture.ts';
import { runTransactionGit, } from '../policy-engine/commit-transaction-git.ts';
import {
  formatShadowConfig,
  readRepositoryFormat,
} from './shadow-config.ts';
import { copyConclusionState, } from './shadow-conclusion-state.ts';
import { linkShadowEntries, } from './shadow-links.ts';
import {
  REPOSITORY_REDIRECT_VARIABLES,
  writeShadowRefs,
} from './shadow-refs.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Private directory mode.
 */
const PRIVATE_DIRECTORY_MODE = 0o700;

/**
 Private file mode.
 */
const PRIVATE_FILE_MODE = 0o600;

/**
 Creates the shadow repository of one published transaction.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @param capture - invocation capture

 @param transactionId - published transaction ID

 @param transactionDirectory - published transaction directory

 @returns absolute shadow repository path

 @example
 ```ts
 await createShadowRepository({ gitPath: '/usr/bin/git', cwd: '/repo', capture, transactionId, transactionDirectory });
 ```
 */
export async function createShadowRepository({
  gitPath,
  cwd,
  capture,
  transactionId,
  transactionDirectory,
}: Readonly<{
  gitPath: string;
  cwd: string;
  capture: InvocationCapture;
  transactionId: string;
  transactionDirectory: string;
}>,): Promise<string> {
  /**
   Tagged shadow logger.
   */
  const rl = tagged({
    tag: createShadowRepository.name,
    l,
  },);
  /**
   Derived shadow path.
   */
  const shadowPath = shadowRepositoryPath({
    commonDir: capture.commonDir,
    transactionId,
  },);
  await mkdir(
    dirname(shadowPath,),
    {
      recursive: true,
      mode: PRIVATE_DIRECTORY_MODE,
    },
  );
  await runTransactionGit({
    gitPath,
    cwd: capture.commonDir,
    args: [
      'init',
      '--bare',
      '--quiet',
      '--template=',
      `--object-format=${capture.objectFormat}`,
      ...(capture.refFormat === 'reftable' ? ['--ref-format=reftable',] : []),
      shadowPath,
    ],
    unsetEnvironment: REPOSITORY_REDIRECT_VARIABLES,
  },);
  await chmod(
    shadowPath,
    PRIVATE_DIRECTORY_MODE,
  );
  /**
   Repository format copied from the real common config.
   */
  const format = await readRepositoryFormat({
    gitPath,
    commonDir: capture.commonDir,
  },);
  await Promise.all([
    writeFile(
      join(
        shadowPath,
        'config',
      ),
      formatShadowConfig({
        format,
        commonDir: capture.commonDir,
        worktreeRoot: capture.repositoryRoot,
      },),
      { mode: PRIVATE_FILE_MODE, },
    ),
    writeFile(
      join(
        shadowPath,
        'objects',
        'info',
        'alternates',
      ),
      `${capture.objectDirectory}\n`,
      { mode: PRIVATE_FILE_MODE, },
    ),
    linkShadowEntries({
      shadowPath,
      commonDir: capture.commonDir,
      gitDir: capture.gitDir,
    },),
  ],);
  await copyConclusionState({
    gitPath,
    cwd,
    gitDir: capture.gitDir,
    shadowPath,
    transactionDirectory,
    refFormat: capture.refFormat,
  },);
  await writeShadowRefs({
    gitPath,
    cwd,
    shadowPath,
    capture,
  },);
  rl.debug(`created shadow repository ${shadowPath}`,);
  return shadowPath;
}

/**
 Removes a shadow repository without following its links into the real repository.

 `rm` removes a symbolic link or junction itself rather than its target.

 @param shadowPath - shadow repository

 @example
 ```ts
 await removeShadowRepository('/repo/.git/cli-git/shadow/0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10');
 ```
 */
export async function removeShadowRepository(shadowPath: string,): Promise<void> {
  await rm(
    shadowPath,
    {
      recursive: true,
      force: true,
    },
  );
  l.debug(`removed shadow repository ${shadowPath}`,);
}

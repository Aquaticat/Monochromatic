import { devNull, } from 'node:os';

import { childEnvironment, } from './child-process-environment.ts';

//region Intrinsic corpus Git context
// A pin names physical objects in its own clone, never inherited repository state.

/**
 Native read flags shared by corpus text, bytes, listings and naming history.
 Lazy object retrieval would mutate the clone and contact a remote.

 @example
 ```ts
 const args = [...CORPUS_GIT_FLAGS, '-C', pin.cloneDir, 'show', spec];
 ```
 */
export const CORPUS_GIT_FLAGS: readonly string[] = [
  '--no-replace-objects',
  '--no-lazy-fetch',
  '--literal-pathspecs',
];

/**
 Repository-routing variables identified by Git's environment.c local_repo_env,
 plus namespace and pathspec overrides that can change literal read scope.
 */
const REPOSITORY_ENVIRONMENT: ReadonlySet<string> = new Set([
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_CONFIG',
  'GIT_CONFIG_PARAMETERS',
  'GIT_CONFIG_COUNT',
  'GIT_OBJECT_DIRECTORY',
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_IMPLICIT_WORK_TREE',
  'GIT_GRAFT_FILE',
  'GIT_INDEX_FILE',
  'GIT_NO_REPLACE_OBJECTS',
  'GIT_REPLACE_REF_BASE',
  'GIT_PREFIX',
  'GIT_SHALLOW_FILE',
  'GIT_COMMON_DIR',
  'GIT_NAMESPACE',
  'GIT_LITERAL_PATHSPECS',
  'GIT_GLOB_PATHSPECS',
  'GIT_NOGLOB_PATHSPECS',
  'GIT_ICASE_PATHSPECS',
],);

/**
 Whether a variable's name routes git to another repository or injects
 configuration.

 @param name - variable's name

 @returns Whether the corpus child must not inherit it

 @example
 ```ts
 const routed = routesRepository({ name: 'GIT_DIR', },); // true
 ```
 */
function routesRepository({ name, }: { readonly name: string; },): boolean {
  if (REPOSITORY_ENVIRONMENT.has(name,))
    return true;
  if (name.startsWith('GIT_CONFIG_KEY_',))
    return true;
  return name.startsWith('GIT_CONFIG_VALUE_',);
}

/**
 Isolates every corpus subprocess from inherited repository routing and grafts,
 and from every credential and setting of the package.
 Guards are assigned after inheritance, so callers cannot override them.
 No process-global environment is mutated or logged.

 EVERY REMOVED NAME IS STATED AS `undefined`, NOT LEFT OUT: `nano-spawn` merges
 this object over the process's own environment, so a name left out came back
 from the parent and `GIT_DIR` reached the child of its listing, while node's
 `execFile` read the same object as replacing the environment.

 GIT SPEAKS THE C LOCALE. A failed corpus read is classified by the English
 words git prints (`corpus-source.ts`), and git translates its messages into
 the caller's language: measured with git 2.55 on a throwaway repository, a
 path absent at a held commit printed `Schwerwiegend: Pfad ... existiert nicht
 in ...` under `LANGUAGE=de` with an English `LANG`, and under `LANG` or
 `LC_MESSAGES` set to German, which the reader classed as another failure.
 `LC_ALL=C` overrides all three, so git prints its own English whatever the
 caller's locale says; the caller's other locale variables are kept as they
 are.

 @param environment - inherited process context, injectable for verification

 @returns Owned environment with intrinsic-object, no-fetch and C-locale
 semantics

 @example
 ```ts
 const env = corpusGitEnvironment();
 ```
 */
export function corpusGitEnvironment({ environment = process.env, }: {
  readonly environment?: Readonly<NodeJS.ProcessEnv>;
} = {},): NodeJS.ProcessEnv {
  /**
   Preserve unrelated process settings without exposing their values in logs.
   */
  const inherited = childEnvironment({ parent: environment, },);
  for (const name of Object.keys(inherited,)) {
    if (routesRepository({ name, },))
      inherited[name] = undefined;
  }
  return {
    ...inherited,
    GIT_GRAFT_FILE: devNull,
    GIT_NO_REPLACE_OBJECTS: '1',
    GIT_NO_LAZY_FETCH: '1',
    LC_ALL: 'C',
  };
}

//endregion Intrinsic corpus Git context

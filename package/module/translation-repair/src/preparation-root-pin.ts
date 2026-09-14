import { isAbsolute, resolve, } from 'node:path';
import { CORPUS_COMMIT_SHA, type CorpusPin, } from './corpus-source.ts';
import { PreparationRootError, } from './preparation-root-error.ts';

//region Independent corpus authority before other argument getters

/**
 * Snapshots independent corpus authority and pins path resolution before asynchronous work or logger callbacks.
 *
 * @param input - public arguments viewed only through their independent corpus configuration
 *
 * @param origin - process location captured before any public argument getter
 *
 * @returns Owned corpus configuration with stable absolute paths
 *
 * @throws PreparationRootError when the pin is unsupported or cannot be snapshotted
 *
 * @example
 * ```ts
 * const fixed = preparationRootPin({ input, origin });
 * ```
 */
export function preparationRootPin({
  input,
  origin,
}: {
  readonly input: { readonly pin: CorpusPin };
  readonly origin: string;
},): CorpusPin {
  try {
    /**
     * Corpus paths are configuration data, not instructions read from the frozen selection document.
     */
    const fixed = structuredClone(input.pin,);
    if ((fixed.commitSha !== CORPUS_COMMIT_SHA) || ((typeof fixed.cloneDir) !== 'string')
      || (fixed.cloneDir
        .trim()
        .length
        === 0)
      || ((fixed.gitPath !== undefined) && (((typeof fixed.gitPath) !== 'string') || (!isAbsolute(fixed.gitPath,)))))
      throw new PreparationRootError({ kind: 'corpus-identity', },);
    return {
      cloneDir: resolve(
        origin,
        fixed.cloneDir,
      ),
      commitSha: fixed.commitSha,
      ...fixed.gitPath === undefined ? {} : { gitPath: fixed.gitPath, },
    };
  }
  catch (error) {
    if (error instanceof PreparationRootError)
      throw error;
    // Native clone/getter details are not required to explain a rejected independent pin.
    throw new PreparationRootError({ kind: 'corpus-identity', },);
  }
}

//endregion Independent corpus authority before other argument getters

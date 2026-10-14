/**
 Qualified native build inputs and shared diagnostics.

 @module
 */
import {
  tagged,
  type Logger,
} from '@monochromatic-dev/module-logger/ts';

//region Native transformations require their measured upstream release

/**
 Exact source revision used by the maintained transformation acceptance tests.
 */
export const qualifiedRelease = {
  version: '1.1.0',
  commit: 'abe508e1b89912adde45528136c3221eb69acdd7',
} as const;

/**
 Source or installed dependency drift prevents native artifact generation.
 */
export class NativeSourceBuildError extends Error {
  /**
   Distinguish build qualification failures from native policy decisions.
   */
  override readonly name = 'NativeSourceBuildError';
}

/**
 Build diagnostics contain file locations and release metadata, never credentials.
 */
export const nativeBuildLog: Logger = tagged({ tag: 'auto-mode-native-build', },);

//endregion Native transformations require their measured upstream release

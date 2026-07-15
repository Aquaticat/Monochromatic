/**
 * Re-export of `wait` from `@monochromatic-dev/module-async-time`,
 * aliased to `$` to preserve the taxonomy convention.
 *
 * The implementation lives in `module-async-time`; this file keeps the
 * `t object/t promise/.../wait` slot in the `module-es` taxonomy so the
 * namespace export `types.object.promise.from.number.wait.positional.portable.$`
 * continues to resolve.
 *
 * @see {@link import('@monochromatic-dev/module-async-time/ts').wait}
 */
export { wait as $, } from '@monochromatic-dev/module-async-time/ts';
